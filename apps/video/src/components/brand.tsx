import {memooTheme} from '../theme';

type BrandSymbolProps = {
  size?: number;
  opacity?: number;
};

export const BrandSymbol = ({size = 48, opacity = 1}: BrandSymbolProps) => {
  const dot = size * 0.34;
  const gap = size * 0.08;
  const pillHeight = size * 0.28;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(2, ${dot}px)`,
        gridTemplateRows: `repeat(2, auto)`,
        gap,
        opacity,
      }}
    >
      <span
        style={{
          width: dot,
          height: dot,
          borderRadius: 999,
          background: memooTheme.blue,
          display: 'block',
        }}
      />
      <span
        style={{
          width: dot,
          height: dot,
          borderRadius: 999,
          background: memooTheme.teal,
          display: 'block',
        }}
      />
      <span
        style={{
          width: dot * 2 + gap,
          height: pillHeight,
          borderRadius: 999,
          background: memooTheme.sand,
          display: 'block',
        }}
      />
    </div>
  );
};

type BrandLockupProps = {
  size?: number;
  label?: string;
  subtitle?: string;
};

export const BrandLockup = ({
  size = 48,
  label = 'memoo',
  subtitle = 'UI Navigator for repeated browser work',
}: BrandLockupProps) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 18,
      }}
    >
      <BrandSymbol size={size} />
      <div style={{display: 'grid', gap: 4}}>
        <div
          style={{
            color: memooTheme.text,
            fontFamily: memooTheme.fontFamily,
            fontSize: size * 0.94,
            fontWeight: 900,
            letterSpacing: '-0.06em',
            lineHeight: 0.9,
            textTransform: 'lowercase',
          }}
        >
          {label}
        </div>
        <div
          style={{
            color: memooTheme.muted,
            fontFamily: memooTheme.fontFamily,
            fontSize: size * 0.24,
            fontWeight: 700,
            letterSpacing: '0.14em',
            lineHeight: 1,
            textTransform: 'uppercase',
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
};
