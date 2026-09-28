#!/usr/bin/env bash
#
# Regenere les icones derivees depuis le master `logo-source.png`.
#
#   bash build/make-icons.sh
#
# Produit :
#   build/icon.png            1024x1024, art nettoye, centre  (macOS / Linux)
#   build/icon.ico            16/24/32/48/64/128/256          (Windows)
#   build/tray/normal.png     32x32                            (tray, etat normal)
#   build/tray/mic-muted.png  32x32                            (tray, micro coupe)
#   build/tray/notif-muted.png 32x32                           (tray, notifs coupees)
#
# Pourquoi ce script existe : le master porte trois arcs d'eau autour du requin.
# A 16-32 px ils ne se lisent plus comme du mouvement, seulement comme du bruit
# cyan a gauche du sujet. On les retire, et on maitrise soi-meme la reduction
# vers chaque taille au lieu de laisser electron-builder reduire du 1024 : c'est
# `win.icon` dans electron-builder.yml qui pointe sur l'.ico produit ici.
#
# Deux mesures a ne pas re-deriver de tete :
#   - les arcs sont a G >= 232, le cyan du requin plafonne a G = 219. Le seuil de
#     88 % (224) les separe. Un seuil plus bas mange le ventre et les nageoires.
#   - la tete du requin porte des reflets au-dessus de 224 : le seuil ne doit
#     donc s'appliquer QUE sur la moitie gauche (x < 450), ou les arcs vivent.
# Et un piege : ne PAS ajouter d'`-unsharp` apres reduction. Teste, ca pique des
# halos blancs dans les petites tailles au lieu de les preciser.
#
# ImageMagick est installe par `scoop install imagemagick`. C'est un portable :
# sans ces variables il ne trouve pas ses coders (RegistryKeyLookupFailed).

set -euo pipefail

cd "$(dirname "$0")"

export MAGICK_HOME="${MAGICK_HOME:-$HOME/scoop/apps/imagemagick/current}"
export MAGICK_CONFIGURE_PATH="$MAGICK_HOME"
export MAGICK_CODER_MODULE_PATH="$MAGICK_HOME/modules/coders"
export PATH="$MAGICK_HOME:$PATH"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. Retirer les arcs d'eau : masque = pixels tres verts (G > 224) de la moitie
#    gauche, retires de la couche alpha.
magick logo-source.png -alpha off -channel G -separate +channel \
  -threshold 88% -negate "$TMP/bright.png"
magick -size 1024x1024 xc:white -fill black -draw "rectangle 0,0 449,1023" "$TMP/left.png"
magick "$TMP/bright.png" "$TMP/left.png" -compose Lighten -composite "$TMP/keep.png"
magick logo-source.png -alpha extract "$TMP/alpha.png"
magick "$TMP/alpha.png" "$TMP/keep.png" -compose Multiply -composite "$TMP/alpha2.png"
magick logo-source.png "$TMP/alpha2.png" -alpha off -compose CopyOpacity -composite "$TMP/noarc.png"

# 2. Ne garder que la plus grande composante connexe : le requin. Ce qui reste
#    du masque n'est que des miettes d'arcs de quelques dizaines de pixels.
#    Dilatation de 2 px avant multiplication, sinon le seuil de 20 % coupe net
#    les bords adoucis du sujet.
magick "$TMP/noarc.png" -alpha extract -threshold 20% \
  -define connected-components:keep-top=1 \
  -define connected-components:mean-color=true \
  -connected-components 8 -threshold 50% -morphology Dilate Disk:2 "$TMP/big.png"
magick "$TMP/noarc.png" -alpha extract "$TMP/alpha3.png"
magick "$TMP/alpha3.png" "$TMP/big.png" -compose Multiply -composite "$TMP/alpha4.png"
magick "$TMP/noarc.png" "$TMP/alpha4.png" -alpha off -compose CopyOpacity -composite "$TMP/shark.png"

# 3. Recadrer au plus juste puis recentrer sur une toile carree.
magick "$TMP/shark.png" -trim +repage -background none -gravity center \
  -extent 1024x1024 icon.png

# 4. Les tailles Windows, reduites une par une en Lanczos.
magick icon.png -filter Lanczos \
  -define icon:auto-resize=256,128,64,48,32,24,16 icon.ico

# 5. Les trois etats du tray. Ce ne sont que des teintes du meme requin :
#    -modulate prend brightness,saturation,hue (100 = inchange, 200 = +180 deg).
mkdir -p tray
magick icon.png -filter Lanczos -resize 32x32 tray/normal.png
magick icon.png -modulate 100,115,190 -filter Lanczos -resize 32x32 tray/mic-muted.png
magick icon.png -modulate 95,20,100 -filter Lanczos -resize 32x32 tray/notif-muted.png

echo "icones regenerees :"
magick identify icon.png icon.ico tray/normal.png tray/mic-muted.png tray/notif-muted.png
