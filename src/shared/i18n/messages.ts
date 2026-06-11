import type { Locale } from './locales';

export const ERROR_CODES = [
  'empty',
  'invalid',
  'scheme',
  'http-not-allowed',
  'cert-untrusted',
  'dns-failure',
  'connection-refused',
  'timeout',
  'server-error',
  'unreachable',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

type Catalogue = Record<ErrorCode, Record<Locale, string>>;

export const MESSAGES: Catalogue = {
  empty: {
    en: 'Please enter a server URL.',
    fr: "Saisis l'URL de ton serveur.",
    es: 'Introduce la URL de tu servidor.',
    it: "Inserisci l'URL del tuo server.",
    ru: 'Введите URL вашего сервера.',
    zh: '请输入服务器地址。',
    cs: 'Zadejte adresu URL svého serveru.',
  },
  invalid: {
    en: "That doesn't look like a valid URL.",
    fr: 'Cette URL ne semble pas valide.',
    es: 'Esa URL no parece válida.',
    it: 'Questo URL non sembra valido.',
    ru: 'Это не похоже на корректный URL.',
    zh: '这看起来不是有效的网址。',
    cs: 'Tato adresa URL nevypadá platně.',
  },
  scheme: {
    en: 'Only HTTPS servers are supported.',
    fr: 'Seuls les serveurs HTTPS sont pris en charge.',
    es: 'Solo se admiten servidores HTTPS.',
    it: 'Sono supportati solo server HTTPS.',
    ru: 'Поддерживаются только серверы HTTPS.',
    zh: '仅支持 HTTPS 服务器。',
    cs: 'Podporovány jsou pouze servery HTTPS.',
  },
  'http-not-allowed': {
    en: "Bullshark requires HTTPS — voice and notifications don't work over HTTP. Put your server behind an HTTPS proxy.",
    fr: "Bullshark nécessite HTTPS — la voix et les notifications ne fonctionnent pas en HTTP. Place ton serveur derrière un proxy HTTPS.",
    es: 'Bullshark requiere HTTPS: la voz y las notificaciones no funcionan por HTTP. Coloca tu servidor detrás de un proxy HTTPS.',
    it: 'Bullshark richiede HTTPS: voce e notifiche non funzionano via HTTP. Metti il tuo server dietro un proxy HTTPS.',
    ru: 'Bullshark требует HTTPS — голос и уведомления не работают по HTTP. Разместите сервер за HTTPS-прокси.',
    zh: 'Bullshark 需要 HTTPS——语音和通知在 HTTP 下无法使用。请将服务器置于 HTTPS 代理之后。',
    cs: 'Bullshark vyžaduje HTTPS – hlas a oznámení přes HTTP nefungují. Umístěte server za HTTPS proxy.',
  },
  'cert-untrusted': {
    en: "The server's certificate isn't trusted. Put your server behind a proxy with a valid certificate (Cloudflare, or Caddy + Let's Encrypt).",
    fr: "Le certificat du serveur n'est pas reconnu. Place ton serveur derrière un proxy avec un certificat valide (Cloudflare, ou Caddy + Let's Encrypt).",
    es: "El certificado del servidor no es de confianza. Coloca tu servidor detrás de un proxy con un certificado válido (Cloudflare, o Caddy + Let's Encrypt).",
    it: "Il certificato del server non è attendibile. Metti il tuo server dietro un proxy con un certificato valido (Cloudflare, o Caddy + Let's Encrypt).",
    ru: 'Сертификат сервера не является доверенным. Разместите сервер за прокси с действительным сертификатом (Cloudflare или Caddy + Let\'s Encrypt).',
    zh: "服务器的证书不受信任。请将服务器置于具有有效证书的代理之后（Cloudflare，或 Caddy + Let's Encrypt）。",
    cs: "Certifikát serveru není důvěryhodný. Umístěte server za proxy s platným certifikátem (Cloudflare nebo Caddy + Let's Encrypt).",
  },
  'dns-failure': {
    en: "Couldn't find that server. Check the address for typos.",
    fr: "Serveur introuvable. Vérifie l'adresse (fautes de frappe).",
    es: 'No se encontró el servidor. Revisa la dirección por si hay errores.',
    it: "Server non trovato. Controlla l'indirizzo per eventuali errori.",
    ru: 'Сервер не найден. Проверьте адрес на опечатки.',
    zh: '找不到该服务器。请检查地址是否有误。',
    cs: 'Server nebyl nalezen. Zkontrolujte adresu, zda neobsahuje překlepy.',
  },
  'connection-refused': {
    en: "The server refused the connection. Check it's running and the port is reachable.",
    fr: "Le serveur a refusé la connexion. Vérifie qu'il tourne et que le port est accessible.",
    es: 'El servidor rechazó la conexión. Comprueba que está en marcha y que el puerto es accesible.',
    it: 'Il server ha rifiutato la connessione. Verifica che sia in esecuzione e che la porta sia raggiungibile.',
    ru: 'Сервер отклонил подключение. Убедитесь, что он запущен и порт доступен.',
    zh: '服务器拒绝了连接。请确认它正在运行且端口可访问。',
    cs: 'Server odmítl připojení. Ověřte, že běží a že je port dostupný.',
  },
  timeout: {
    en: 'The server took too long to respond. Check the address and your network.',
    fr: "Le serveur a mis trop de temps à répondre. Vérifie l'adresse et ta connexion.",
    es: 'El servidor tardó demasiado en responder. Revisa la dirección y tu red.',
    it: "Il server ha impiegato troppo tempo a rispondere. Controlla l'indirizzo e la rete.",
    ru: 'Сервер слишком долго не отвечает. Проверьте адрес и сеть.',
    zh: '服务器响应超时。请检查地址和网络。',
    cs: 'Server odpovídal příliš dlouho. Zkontrolujte adresu a síť.',
  },
  'server-error': {
    en: 'The server responded with an error. It may be misconfigured or still starting up.',
    fr: 'Le serveur a renvoyé une erreur. Il est peut-être mal configuré ou en cours de démarrage.',
    es: 'El servidor respondió con un error. Puede estar mal configurado o iniciándose.',
    it: 'Il server ha risposto con un errore. Potrebbe essere mal configurato o in fase di avvio.',
    ru: 'Сервер ответил с ошибкой. Возможно, он неправильно настроен или запускается.',
    zh: '服务器返回错误。可能配置有误或正在启动。',
    cs: 'Server odpověděl chybou. Možná je špatně nakonfigurován nebo se spouští.',
  },
  unreachable: {
    en: "Couldn't reach the server. Check the address and your network.",
    fr: "Impossible de joindre le serveur. Vérifie l'adresse et ta connexion.",
    es: 'No se pudo contactar con el servidor. Revisa la dirección y tu red.',
    it: 'Impossibile raggiungere il server. Controlla l\'indirizzo e la rete.',
    ru: 'Не удалось подключиться к серверу. Проверьте адрес и сеть.',
    zh: '无法连接到服务器。请检查地址和网络。',
    cs: 'Server není dostupný. Zkontrolujte adresu a síť.',
  },
};

export const t = (code: string, locale: Locale): string => {
  const entry = MESSAGES[code as ErrorCode] ?? MESSAGES.unreachable;
  return entry[locale] ?? entry.en;
};
