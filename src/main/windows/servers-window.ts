import { createLocalWindow } from './local-renderer';

export const openOnboarding = () => createLocalWindow('/onboarding', { width: 520, height: 420 });
// La route s'appelle toujours /servers pour des raisons d'historique, mais la
// page est devenue la fenetre de reglages complete (serveurs, raccourcis, a
// propos) : le nom de la fonction suit l'usage, pas la route.
export const openSettingsWindow = () =>
  createLocalWindow('/servers', { width: 780, height: 560, minWidth: 680, minHeight: 460 });
