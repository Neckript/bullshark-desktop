import { useEffect, useState } from 'react';
import { Onboarding } from './pages/Onboarding';
import { Servers } from './pages/Servers';
import { SharePicker } from './pages/SharePicker';

export const Router = () => {
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || '/onboarding');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace('#', ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (hash.startsWith('/servers')) return <Servers />;
  if (hash.startsWith('/share-picker')) return <SharePicker />;
  return <Onboarding />;
};
