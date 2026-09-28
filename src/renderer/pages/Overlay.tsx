import { useEffect, useState } from 'react';
import type { OverlayParticipant, OverlayPayload } from '../../shared/types';

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const Row = ({ participant }: { participant: OverlayParticipant }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 8px',
      borderRadius: 8,
      background: 'rgba(0, 0, 0, 0.55)',
      // The speaking ring mirrors the in-app green highlight.
      outline: participant.speaking ? '2px solid #3ba55d' : '2px solid transparent',
      opacity: participant.speaking ? 1 : 0.85
    }}
  >
    <div
      style={{
        position: 'relative',
        width: 28,
        height: 28,
        flex: '0 0 auto',
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#5865f2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: '#fff'
      }}
    >
      {participant.avatarUrl ? (
        <img
          src={participant.avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initials(participant.name)
      )}
    </div>
    <span
      style={{
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 13,
        color: '#fff'
      }}
    >
      {participant.name}
    </span>
    {participant.micMuted && (
      <span style={{ fontSize: 12, color: '#ed4245' }} aria-label="muted">
        ✕
      </span>
    )}
  </div>
);

export const Overlay = () => {
  const [payload, setPayload] = useState<OverlayPayload>({
    inVoice: false,
    participants: []
  });

  useEffect(() => {
    // The overlay window is transparent; keep the document from painting an
    // opaque background over the game underneath.
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    const unsubscribe = window.shell.overlay.onParticipants(setPayload);

    return () => {
      unsubscribe();
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none'
      }}
    >
      {payload.participants.map((participant) => (
        <Row key={participant.userId} participant={participant} />
      ))}
    </div>
  );
};
