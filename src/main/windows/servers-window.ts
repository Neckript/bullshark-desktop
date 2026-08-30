import { createLocalWindow } from './local-renderer';

export const openOnboarding = () => createLocalWindow('/onboarding', { width: 520, height: 420 });
export const openServersManager = () =>
  createLocalWindow('/servers', { width: 780, height: 560, minWidth: 680, minHeight: 460 });
