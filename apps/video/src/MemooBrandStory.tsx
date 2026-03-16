import type React from 'react';

import {AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';

import {BrandSymbol} from './components/brand';
import {BrowserGlyph, ChecklistGlyph, CursorGlyph} from './components/motifs';
import {useMemooFonts} from './fonts';
import {memooTheme} from './theme';

export type MemooBrandStoryProps = {
  challengeTag: string;
};

const FPS = 30;

const sceneDurations = {
  intro: 13 * FPS,
  workspace: 9 * FPS,
  ai: 10 * FPS,
  voice: 10 * FPS,
  execution: 11 * FPS,
  connectivity: 6 * FPS,
  proof: 13 * FPS,
  close: 14 * FPS,
} as const;

const sceneStarts = {
  intro: 0,
  workspace: sceneDurations.intro,
  ai: sceneDurations.intro + sceneDurations.workspace,
  voice: sceneDurations.intro + sceneDurations.workspace + sceneDurations.ai,
  execution: sceneDurations.intro + sceneDurations.workspace + sceneDurations.ai + sceneDurations.voice,
  connectivity:
    sceneDurations.intro +
    sceneDurations.workspace +
    sceneDurations.ai +
    sceneDurations.voice +
    sceneDurations.execution,
  proof:
    sceneDurations.intro +
    sceneDurations.workspace +
    sceneDurations.ai +
    sceneDurations.voice +
    sceneDurations.execution +
    sceneDurations.connectivity,
  close:
    sceneDurations.intro +
    sceneDurations.workspace +
    sceneDurations.ai +
    sceneDurations.voice +
    sceneDurations.execution +
    sceneDurations.connectivity +
    sceneDurations.proof,
} as const;

export const MEMOO_BRAND_STORY_DURATION =
  sceneDurations.intro +
  sceneDurations.workspace +
  sceneDurations.ai +
  sceneDurations.voice +
  sceneDurations.execution +
  sceneDurations.connectivity +
  sceneDurations.proof +
  sceneDurations.close;

const HOOK_TEXT = 'Memoo is ......';
const QUESTION_TEXT = 'What is Memoo?';
const HOOK_TYPE_START = 38;
const HOOK_CHAR_INTERVAL = 6;
const HOOK_RESOLVE_FRAME = 156;
const HOOK_TYPING_DURATION = HOOK_RESOLVE_FRAME - HOOK_TYPE_START + 8;
const STRIKE_FRAMES = [194, 232, 270] as const;
const AVATAR_FRAMES = [220, 248, 276] as const;

const songSrc = staticFile('audio/song.mp3');
const keyboardTypingSrc = staticFile('sfx/keyboard-typing.mp3');
const pencilScratchSrc = staticFile('sfx/pencil-scratch.mp3');
const ease = Easing.bezier(0.22, 1, 0.36, 1);

const tween = (frame: number, start: number, duration: number, from: number, to: number) =>
  interpolate(frame, [start, start + duration], [from, to], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const sceneOpacity = (frame: number, duration: number) => {
  const fadeIn = tween(frame, 0, 12, 0, 1);
  const fadeOut = tween(frame, Math.max(duration - 16, 0), 16, 1, 0);
  return Math.min(fadeIn, fadeOut);
};

const float = (frame: number, speed: number, amplitude: number, offset = 0) =>
  Math.sin((frame + offset) / speed) * amplitude;

const Background = ({frame, accent}: {frame: number; accent: string}) => (
  <>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: memooTheme.backgroundElevated,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(circle at 18% 22%, rgba(31,92,132,0.06), transparent 30%), radial-gradient(circle at 82% 16%, rgba(27,139,130,0.06), transparent 24%), radial-gradient(circle at 76% 82%, rgba(217,138,63,0.07), transparent 24%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: -56 + float(frame, 42, 18),
        top: 96 + float(frame, 34, 16, 4),
        width: 300,
        height: 300,
        borderRadius: 999,
        background: `radial-gradient(circle, ${accent}14 0%, ${accent}00 72%)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        right: -52 + float(frame, 40, 16, 8),
        bottom: 34 + float(frame, 36, 14, 10),
        width: 260,
        height: 260,
        borderRadius: 999,
        background: `radial-gradient(circle, ${memooTheme.sand}12 0%, ${memooTheme.sand}00 72%)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 28,
        borderRadius: 40,
        border: `1px solid ${memooTheme.lineSoft}`,
      }}
    />
  </>
);

const TransitionMask = ({
  frame,
  accent,
  direction,
}: {
  frame: number;
  accent: string;
  direction: 'left' | 'right' | 'up';
}) => {
  const progress = tween(frame, 0, 22, 0, 1);
  const transform =
    direction === 'left'
      ? `translateX(${interpolate(progress, [0, 1], [0, -102])}%)`
      : direction === 'up'
        ? `translateY(${interpolate(progress, [0, 1], [0, -102])}%)`
        : `translateX(${interpolate(progress, [0, 1], [0, 102])}%)`;
  const glowStyle =
    direction === 'up'
      ? {
          left: 0,
          right: 0,
          bottom: -24,
          height: 164,
          background: `linear-gradient(to top, ${accent}40 0%, ${accent}12 36%, transparent 100%)`,
        }
      : direction === 'right'
        ? {
            top: 0,
            right: -24,
            bottom: 0,
            width: 164,
            background: `linear-gradient(to left, ${accent}42 0%, ${accent}12 36%, transparent 100%)`,
          }
        : {
            top: 0,
            left: -24,
            bottom: 0,
            width: 164,
            background: `linear-gradient(to right, ${accent}42 0%, ${accent}12 36%, transparent 100%)`,
          };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 8,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -18,
          background: memooTheme.backgroundElevated,
          borderRadius: 56,
          boxShadow: `0 24px 90px ${accent}14`,
          transform,
        }}
      >
        <div
          style={{
            position: 'absolute',
            filter: 'blur(4px)',
            ...glowStyle,
          }}
        />
      </div>
    </div>
  );
};

const Scene = ({
  frame,
  duration,
  accent,
  transition,
  children,
}: {
  frame: number;
  duration: number;
  accent: string;
  transition?: 'left' | 'right' | 'up';
  children: React.ReactNode;
}) => (
  <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
    <Background frame={frame} accent={accent} />
    {children}
    {transition ? <TransitionMask frame={frame} accent={accent} direction={transition} /> : null}
  </AbsoluteFill>
);

const Label = ({children}: {children: React.ReactNode}) => (
  <div
    style={{
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: memooTheme.muted,
    }}
  >
    {children}
  </div>
);

const Panel = ({
  children,
  style,
  background = '#fff',
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  background?: string;
}) => (
  <div
    style={{
      borderRadius: 30,
      border: `1px solid ${memooTheme.lineSoft}`,
      background,
      boxShadow: memooTheme.shadowSoft,
      ...style,
    }}
  >
    {children}
  </div>
);

const MemooLogo = ({size = 88}: {size?: number}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 20,
    }}
  >
    <BrandSymbol size={size} />
    <div
      style={{
        fontSize: size * 1.08,
        fontWeight: 900,
        letterSpacing: '-0.08em',
        lineHeight: 0.9,
        color: memooTheme.text,
        textTransform: 'lowercase',
      }}
    >
      memoo
    </div>
  </div>
);

const FlatAvatar = ({
  name,
  role,
  delay,
  compact = false,
}: {
  name: string;
  role: string;
  delay: number;
  compact?: boolean;
}) => {
  const frame = useCurrentFrame();
  const opacity = tween(frame, delay, 16, 0, 1);
  const avatarSize = compact ? 78 : 112;
  const radius = compact ? 38 : 54;
  const faceRadius = compact ? 13 : 18;
  const strokeWidth = compact ? 2 : 2.5;

  return (
    <div
      style={{
        display: 'grid',
        justifyItems: 'center',
        gap: 10,
        opacity,
      }}
    >
      <svg width={avatarSize} height={avatarSize} viewBox="0 0 112 112" fill="none">
        <circle cx="56" cy="56" r={radius} fill="#fff" stroke={memooTheme.lineStrong} strokeWidth="2" />
        <circle cx="56" cy="44" r={faceRadius} fill="none" stroke={memooTheme.text} strokeWidth={strokeWidth} />
        <path d="M28 86C33 72 43 66 56 66C69 66 79 72 84 86" stroke={memooTheme.text} strokeWidth={strokeWidth} strokeLinecap="round" />
        <circle cx="48" cy="42" r="2.5" fill={memooTheme.text} />
        <circle cx="64" cy="42" r="2.5" fill={memooTheme.text} />
        <path d="M49 52C52 55 60 55 63 52" stroke={memooTheme.text} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      {compact ? null : <div style={{fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em'}}>{name}</div>}
      {compact ? null : <div style={{fontSize: 15, color: memooTheme.muted}}>{role}</div>}
    </div>
  );
};

const StrikeTag = ({
  text,
  from,
}: {
  text: string;
  from: number;
}) => {
  const frame = useCurrentFrame();
  const reveal = tween(frame, from - 2, 8, 0, 1);
  const settleY = tween(frame, from - 2, 8, 10, 0);
  const strikePrimary = tween(frame, from + 1, 8, 0.12, 1);
  const strikeSecondary = tween(frame, from + 4, 9, 0.08, 1);

  return (
    <div
      style={{
        display: 'inline-flex',
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: '-0.04em',
        color: memooTheme.text,
        opacity: reveal,
        transform: `translateY(${settleY}px)`,
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          paddingRight: 12,
        }}
      >
        {text}
        <div
          style={{
            position: 'absolute',
            left: -4,
            top: '53%',
            width: 'calc(100% + 8px)',
            height: 4,
            borderRadius: 999,
            background: memooTheme.sand,
            opacity: 0.92,
            transform: `rotate(-2.4deg) scaleX(${strikePrimary})`,
            transformOrigin: 'left center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: -1,
            top: '56%',
            width: 'calc(100% + 4px)',
            height: 2.5,
            borderRadius: 999,
            background: memooTheme.sand,
            opacity: 0.52,
            transform: `rotate(-0.8deg) scaleX(${strikeSecondary})`,
            transformOrigin: 'left center',
          }}
        />
      </span>
    </div>
  );
};

const ClipIcon = ({kind}: {kind: 'browser' | 'checklist' | 'cursor'}) => {
  if (kind === 'checklist') {
    return <ChecklistGlyph width={92} color={memooTheme.text} opacity={0.22} />;
  }

  if (kind === 'cursor') {
    return <CursorGlyph width={58} color={memooTheme.text} opacity={1} />;
  }

  return <BrowserGlyph width={112} color={memooTheme.text} opacity={0.22} />;
};

const ClipSlot = ({
  label,
  note,
  kind = 'browser',
  height = 360,
  title,
  minimal = false,
}: {
  label: string;
  note: string;
  kind?: 'browser' | 'checklist' | 'cursor';
  height?: number;
  title?: string;
  minimal?: boolean;
}) => (
  <Panel
    background="#fff"
    style={{
      padding: minimal ? 16 : 20,
      minHeight: height,
      display: 'grid',
      gridTemplateRows: minimal ? '1fr' : 'auto auto 1fr auto',
      gap: minimal ? 0 : 14,
    }}
  >
    {minimal ? null : (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <Label>{label}</Label>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 999,
            background: memooTheme.backgroundElevated,
            fontSize: 14,
            fontWeight: 800,
            color: memooTheme.muted,
          }}
        >
          Real product clip
        </div>
      </div>
    )}

    {minimal || !title ? null : (
      <div
        style={{
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: '-0.05em',
          lineHeight: 0.98,
        }}
      >
        {title}
      </div>
    )}

    <div
      style={{
        borderRadius: 24,
        border: `1px dashed ${memooTheme.lineStrong}`,
        background: memooTheme.backgroundElevated,
        display: 'grid',
        placeItems: 'center',
        padding: 28,
      }}
    >
      <div style={{display: 'grid', placeItems: 'center', gap: minimal ? 10 : 16, textAlign: 'center'}}>
        <ClipIcon kind={kind} />
        {minimal ? null : (
          <div
            style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '-0.04em',
              color: memooTheme.text,
            }}
          >
            Drop Memoo footage here
          </div>
        )}
      </div>
    </div>

    {minimal ? null : (
      <div
        style={{
          fontSize: 18,
          color: memooTheme.muted,
          lineHeight: 1.36,
        }}
      >
        {note}
      </div>
    )}
  </Panel>
);

const IntroScene = () => {
  const frame = useCurrentFrame();
  const questionOpacity = Math.min(tween(frame, 0, 16, 0, 1), tween(frame, HOOK_TYPE_START - 10, 14, 1, 0));
  const questionY = tween(frame, 0, 18, 16, 0);
  const isTypingStarted = frame >= HOOK_TYPE_START;
  const visibleCharacters = Math.max(
    0,
    Math.min(HOOK_TEXT.length, Math.floor((frame - HOOK_TYPE_START) / HOOK_CHAR_INTERVAL) + 1)
  );
  const typedText = HOOK_TEXT.slice(0, visibleCharacters);
  const showCursor = isTypingStarted && (visibleCharacters < HOOK_TEXT.length || Math.floor(frame / 10) % 2 === 0);
  const introSettleX = tween(frame, 0, 16, 14, 0);
  const exitLeft = tween(frame, HOOK_RESOLVE_FRAME + 6, 22, 0, -1480);
  const hookTranslateX = frame < HOOK_RESOLVE_FRAME - 8 ? introSettleX : exitLeft;
  const logoOpacity = tween(frame, HOOK_RESOLVE_FRAME - 2, 18, 0, 1);
  const logoY = tween(frame, HOOK_RESOLVE_FRAME - 2, 18, 22, 0);
  const railOpacity = tween(frame, STRIKE_FRAMES[0] - 18, 18, 0, 1);
  const railY = tween(frame, STRIKE_FRAMES[0] - 18, 18, 20, 0);

  return (
    <Scene frame={frame} duration={sceneDurations.intro} accent={memooTheme.blue} transition="right">
      <Sequence from={HOOK_TYPE_START - 2} durationInFrames={HOOK_TYPING_DURATION}>
        <Audio
          src={keyboardTypingSrc}
          trimAfter={HOOK_TYPING_DURATION}
          volume={(f) =>
            interpolate(f, [0, 8, HOOK_TYPING_DURATION - 10, HOOK_TYPING_DURATION], [0, 0.28, 0.28, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      </Sequence>
      {STRIKE_FRAMES.map((strikeFrame, index) => (
        <Sequence key={strikeFrame} from={strikeFrame - 1} durationInFrames={18}>
          <Audio
            src={pencilScratchSrc}
            trimBefore={index * 2}
            trimAfter={index * 2 + 18}
            volume={0.3}
            playbackRate={1.04}
          />
        </Sequence>
      ))}

      <div
        style={{
          position: 'absolute',
          inset: '120px 82px 120px',
          display: 'grid',
          gridTemplateRows: '1fr auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '35%',
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: '-0.05em',
              color: memooTheme.text,
              opacity: questionOpacity,
              transform: `translate(-50%, -50%) translateY(${questionY}px)`,
            }}
          >
            {QUESTION_TEXT}
          </div>

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              color: memooTheme.blue,
              fontSize: 88,
              fontWeight: 900,
              letterSpacing: '0.04em',
              lineHeight: 0.9,
              whiteSpace: 'nowrap',
              opacity: isTypingStarted ? 1 : 0,
              transform: `translate(-50%, -50%) translateX(${hookTranslateX}px)`,
            }}
          >
            <span>{typedText}</span>
            <span style={{opacity: showCursor ? 1 : 0}}>|</span>
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              opacity: logoOpacity,
              transform: `translateY(${logoY}px)`,
            }}
          >
            <MemooLogo size={88} />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 0.8fr',
            alignItems: 'end',
            gap: 42,
            paddingTop: 26,
            borderTop: `1px solid ${memooTheme.lineSoft}`,
            opacity: railOpacity,
            transform: `translateY(${railY}px)`,
          }}
        >
          <div style={{display: 'grid', gap: 16, alignContent: 'end'}}>
            <StrikeTag text="Macro recorder" from={STRIKE_FRAMES[0]} />
            <StrikeTag text="Just automation" from={STRIKE_FRAMES[1]} />
            <StrikeTag text="Random AI clicking" from={STRIKE_FRAMES[2]} />
          </div>

          <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 12}}>
            <FlatAvatar name="Nora" role="Revenue Ops" delay={AVATAR_FRAMES[0]} compact />
            <FlatAvatar name="Sam" role="Support" delay={AVATAR_FRAMES[1]} compact />
            <FlatAvatar name="Iris" role="Growth" delay={AVATAR_FRAMES[2]} compact />
          </div>
        </div>
      </div>
    </Scene>
  );
};

const WorkspaceScene = () => {
  const frame = useCurrentFrame();

  return (
    <Scene frame={frame} duration={sceneDurations.workspace} accent={memooTheme.teal} transition="left">
      <div
        style={{
          position: 'absolute',
          inset: '76px 76px',
        }}
      >
        <ClipSlot
          label="Clip 02"
          note="Real Memoo workspace with sidebar navigation, shared playbooks, recent runs, and operating context in one place."
          kind="browser"
          height={748}
          minimal
        />
      </div>
    </Scene>
  );
};

const AIScene = () => {
  const frame = useCurrentFrame();

  return (
    <Scene frame={frame} duration={sceneDurations.ai} accent={memooTheme.blue} transition="up">
      <div
        style={{
          position: 'absolute',
          inset: '76px 76px',
        }}
      >
        <ClipSlot
          label="Clip 03"
          note="Real compile or playbook-generation moment where Memoo turns the request into structured steps."
          kind="checklist"
          height={748}
          minimal
        />
      </div>
    </Scene>
  );
};

const VoiceScene = () => {
  const frame = useCurrentFrame();

  return (
    <Scene frame={frame} duration={sceneDurations.voice} accent={memooTheme.teal} transition="right">
      <div
        style={{
          position: 'absolute',
          inset: '76px 76px',
        }}
      >
        <ClipSlot
          label="Clip 04"
          note="Real capture with voice context and the resulting structured steps or clarifications."
          kind="browser"
          height={748}
          minimal
        />
      </div>
    </Scene>
  );
};

const ExecutionScene = () => {
  const frame = useCurrentFrame();

  return (
    <Scene frame={frame} duration={sceneDurations.execution} accent={memooTheme.blue} transition="up">
      <div
        style={{
          position: 'absolute',
          inset: '76px 76px',
          display: 'grid',
          gridTemplateColumns: '0.88fr 1.12fr',
          gap: 16,
        }}
      >
        <ClipSlot
          label="Clip 05A"
          note="Real Memoo run UI with progress, steps and logs."
          kind="checklist"
          height={748}
          minimal
        />
        <ClipSlot
          label="Clip 05B"
          note="Real sandbox browser replay showing the workflow being completed."
          kind="browser"
          height={748}
          minimal
        />
      </div>
    </Scene>
  );
};

const ConnectivityScene = () => {
  const frame = useCurrentFrame();

  return (
    <Scene frame={frame} duration={sceneDurations.connectivity} accent={memooTheme.sand} transition="left">
      <div
        style={{
          position: 'absolute',
          inset: '76px 76px',
        }}
      >
        <ClipSlot
          label="Clip 06"
          note="Real search, answer or workflow lookup inside Memoo, with connected tools in context."
          kind="cursor"
          height={748}
          minimal
        />
      </div>
    </Scene>
  );
};

const ProofScene = () => {
  const frame = useCurrentFrame();

  return (
    <Scene frame={frame} duration={sceneDurations.proof} accent={memooTheme.teal} transition="right">
      <div
        style={{
          position: 'absolute',
          inset: '76px 76px',
        }}
      >
        <ClipSlot
          label="Clip 07"
          note="Real logs, screenshot evidence, shared playbooks or the dashboard view showing repeated successful runs."
          kind="checklist"
          height={748}
          minimal
        />
      </div>
    </Scene>
  );
};

const CloseScene = ({challengeTag}: {challengeTag: string}) => {
  const frame = useCurrentFrame();
  const checks = [
    {label: 'Copy data between tools', from: 30},
    {label: 'Open the same tabs again', from: 58},
    {label: 'Export another report', from: 86},
    {label: 'Update the CRM manually', from: 114},
  ];

  return (
    <Scene frame={frame} duration={sceneDurations.close} accent={memooTheme.sand}>
      <div
        style={{
          position: 'absolute',
          inset: '120px 86px 120px',
          display: 'grid',
          placeItems: 'center',
          gap: 22,
        }}
      >
        <Label>Busywork</Label>

        <Panel background="#fff" style={{padding: '30px 34px', width: 760}}>
          <div style={{display: 'grid', gap: 16}}>
            {checks.map((item) => {
              const done = tween(frame, item.from, 12, 0, 1);

              return (
                <div
                  key={item.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 14,
                    alignItems: 'center',
                    opacity: tween(frame, item.from - 8, 12, 0, 1),
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      border: `2px solid ${done > 0.5 ? memooTheme.teal : memooTheme.lineStrong}`,
                      background: done > 0.5 ? memooTheme.teal : 'transparent',
                    }}
                  />
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      color: done > 0.5 ? memooTheme.muted : memooTheme.text,
                      textDecoration: done > 0.5 ? 'line-through' : 'none',
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              );
            })}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 14,
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: `2px solid ${memooTheme.sand}`,
                }}
              />
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  letterSpacing: '-0.05em',
                  color: memooTheme.text,
                }}
              >
                Work that matters
              </div>
            </div>
          </div>
        </Panel>

        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            gap: 18,
            marginTop: 18,
          }}
        >
          <MemooLogo size={78} />
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              letterSpacing: '-0.06em',
              lineHeight: 0.96,
              textAlign: 'center',
              maxWidth: 900,
            }}
          >
            Memoo remembers how work gets done so your team can focus on what matters.
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: memooTheme.muted,
            }}
          >
            <BrandSymbol size={24} />
            {challengeTag}
          </div>
        </div>
      </div>
    </Scene>
  );
};

export const MemooBrandStory = ({challengeTag}: MemooBrandStoryProps) => {
  useMemooFonts();

  return (
    <AbsoluteFill
      style={{
        background: memooTheme.backgroundElevated,
        color: memooTheme.text,
        fontFamily: memooTheme.fontFamily,
        overflow: 'hidden',
      }}
    >
      <Audio
        src={songSrc}
        volume={(frame) =>
          interpolate(
            frame,
            [0, 60, MEMOO_BRAND_STORY_DURATION - 90, MEMOO_BRAND_STORY_DURATION],
            [0, 0.16, 0.16, 0],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }
          )
        }
      />

      <Sequence from={sceneStarts.intro} durationInFrames={sceneDurations.intro}>
        <IntroScene />
      </Sequence>

      <Sequence from={sceneStarts.workspace} durationInFrames={sceneDurations.workspace}>
        <WorkspaceScene />
      </Sequence>

      <Sequence from={sceneStarts.ai} durationInFrames={sceneDurations.ai}>
        <AIScene />
      </Sequence>

      <Sequence from={sceneStarts.voice} durationInFrames={sceneDurations.voice}>
        <VoiceScene />
      </Sequence>

      <Sequence from={sceneStarts.execution} durationInFrames={sceneDurations.execution}>
        <ExecutionScene />
      </Sequence>

      <Sequence from={sceneStarts.connectivity} durationInFrames={sceneDurations.connectivity}>
        <ConnectivityScene />
      </Sequence>

      <Sequence from={sceneStarts.proof} durationInFrames={sceneDurations.proof}>
        <ProofScene />
      </Sequence>

      <Sequence from={sceneStarts.close} durationInFrames={sceneDurations.close}>
        <CloseScene challengeTag={challengeTag} />
      </Sequence>
    </AbsoluteFill>
  );
};
