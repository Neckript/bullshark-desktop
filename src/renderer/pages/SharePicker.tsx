import { useEffect, useState } from 'react';
import type { SourceDto } from '../../shared/types';

export const SharePicker = () => {
  const [sources, setSources] = useState<SourceDto[]>([]);

  useEffect(() => {
    void window.shell.screen.getSources().then(setSources);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void window.shell.screen.cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h3 style={{ marginTop: 0 }}>Share your screen</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxHeight: 380, overflow: 'auto' }}>
        {sources.map((s) => (
          <button
            key={s.id}
            onClick={() => void window.shell.screen.choose(s.id)}
            style={{ textAlign: 'left', padding: 8, cursor: 'pointer', border: '1px solid #ccc', borderRadius: 6, background: '#fff' }}
          >
            <img src={s.thumbnailDataUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'contain', background: '#000', borderRadius: 4 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12 }}>
              {s.appIconDataUrl && <img src={s.appIconDataUrl} alt="" style={{ width: 16, height: 16 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            </div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button onClick={() => void window.shell.screen.cancel()}>Cancel</button>
      </div>
    </div>
  );
};
