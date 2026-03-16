type MotifProps = {
  width?: number;
  color?: string;
  opacity?: number;
};

export const BrowserGlyph = ({width = 120, color = 'currentColor', opacity = 1}: MotifProps) => {
  const height = Math.round(width * 0.72);

  return (
    <svg width={width} height={height} viewBox="0 0 120 86" fill="none" style={{opacity}}>
      <rect x="1" y="1" width="118" height="84" rx="14" stroke={color} strokeWidth="1.6" />
      <line x1="1" y1="22" x2="119" y2="22" stroke={color} strokeWidth="1.2" />
      <circle cx="16" cy="12" r="3" fill={color} />
      <circle cx="26" cy="12" r="3" fill={color} />
      <circle cx="36" cy="12" r="3" fill={color} />
      <rect x="16" y="35" width="88" height="6" rx="3" fill={color} />
      <rect x="16" y="49" width="54" height="6" rx="3" fill={color} />
      <rect x="16" y="63" width="74" height="6" rx="3" fill={color} />
    </svg>
  );
};

export const CursorGlyph = ({width = 28, color = 'currentColor', opacity = 1}: MotifProps) => {
  const height = Math.round(width * 1.25);

  return (
    <svg width={width} height={height} viewBox="0 0 28 35" fill="none" style={{opacity}}>
      <path
        d="M5 2.5V28L12 21.5L18 33L22.2 31L16 18.5L25 16.8L5 2.5Z"
        fill={color}
        fillOpacity="0.14"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />
    </svg>
  );
};

export const ChecklistGlyph = ({width = 88, color = 'currentColor', opacity = 1}: MotifProps) => {
  const height = Math.round(width * 0.82);

  return (
    <svg width={width} height={height} viewBox="0 0 88 72" fill="none" style={{opacity}}>
      <rect x="1" y="1" width="86" height="70" rx="14" stroke={color} strokeWidth="1.6" />
      <rect x="15" y="16" width="9" height="9" rx="2.4" stroke={color} strokeWidth="1.4" />
      <path d="M17 20.5L19.5 23L23.5 18.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="31" y="18" width="38" height="5" rx="2.5" fill={color} />
      <rect x="15" y="32" width="9" height="9" rx="2.4" stroke={color} strokeWidth="1.4" />
      <path d="M17 36.5L19.5 39L23.5 34.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="31" y="34" width="30" height="5" rx="2.5" fill={color} />
      <rect x="15" y="48" width="9" height="9" rx="2.4" stroke={color} strokeWidth="1.4" />
      <rect x="31" y="50" width="44" height="5" rx="2.5" fill={color} />
    </svg>
  );
};
