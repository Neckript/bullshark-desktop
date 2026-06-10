import { useState } from 'react';

declare global {
  interface Window {
    shell: {
      servers: {
        list: () => Promise<import('../../shared/types').ServerEntry[]>;
        add: (url: string, label: string) => Promise<{ ok: boolean; reason?: string; id?: string }>;
        update: (id: string, patch: Partial<import('../../shared/types').ServerEntry>) => Promise<{ ok: boolean; reason?: string }>;
        remove: (id: string) => Promise<{ ok: boolean }>;
        switchTo: (id: string) => Promise<{ ok: boolean }>;
        validateUrl: (url: string) => Promise<{ ok: boolean; reason?: string; url?: string }>;
      };
      prefs: {
        get: () => Promise<import('../../shared/types').Prefs>;
        set: (patch: Partial<import('../../shared/types').Prefs>) => Promise<void>;
      };
      onServersChanged: (cb: () => void) => () => void;
    };
  }
}

export const Onboarding = () => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async () => {
    setStatus('Checking…');
    const res = await window.shell.servers.add(url, '');
    if (res.ok && res.id) {
      await window.shell.servers.switchTo(res.id);
      window.close();
    } else {
      setStatus(`Could not add server: ${res.reason}`);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>Connect to your Bullshark server</h2>
      <p>Enter the URL of your Bullshark instance.</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://chat.example.com" style={{ width: '100%', padding: 8 }} />
      <button onClick={onSubmit} style={{ marginTop: 12 }}>Connect</button>
      {status && <p>{status}</p>}
    </div>
  );
};
