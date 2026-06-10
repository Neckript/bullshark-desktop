import { createLocalWindow } from './local-renderer';

export const openOnboarding = () => createLocalWindow('/onboarding', { width: 520, height: 420 });
export const openServersManager = () => createLocalWindow('/servers', { width: 560, height: 640 });
