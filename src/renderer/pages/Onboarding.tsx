import { useState } from 'react';

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
