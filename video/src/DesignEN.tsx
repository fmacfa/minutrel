import type { CSSProperties, ReactNode } from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/fonts';
export { C, FPS } from './film';
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
for (const [file, weight] of [
  ['Regular', '400'],
  ['SemiBold', '600'],
  ['ExtraBold', '800'],
])
  loadFont({ family: 'Manrope', url: staticFile(`fonts/Manrope-${file}.ttf`), weight });
export const pos = (left: number, top: number, width?: number): CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width,
});
export const Logo = ({ reverse = false, width = 245 }: { reverse?: boolean; width?: number }) => (
  <Img
    src={staticFile(`brand/minutrel-${reverse ? 'reverse' : 'primary'}.svg`)}
    style={{ width, display: 'block' }}
  />
);
export const Kick = ({
  children,
  delay = 0,
  style = {},
  distance = 90,
}: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
  distance?: number;
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { stiffness: 240, damping: 23, mass: 0.7 } });
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(f, [delay, delay + 5], [0, 1], clamp),
        transform: `translateY(${(1 - p) * distance}px)`,
      }}
    >
      {children}
    </div>
  );
};
export const Word = ({
  children,
  delay = 0,
  size = 126,
  color,
  style = {},
}: {
  children: ReactNode;
  delay?: number;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) => (
  <div style={{ overflow: 'hidden', paddingBottom: 10, ...style }}>
    <Kick
      delay={delay}
      distance={130}
      style={{
        fontSize: size,
        fontWeight: 800,
        letterSpacing: -size * 0.045,
        lineHeight: 1.04,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Kick>
  </div>
);
export const SmallLabel = ({ children, color }: { children: ReactNode; color: string }) => (
  <div
    style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3.1, textTransform: 'uppercase', color }}
  >
    {children}
  </div>
);
export const Icon = ({
  name,
  size = 82,
  color = 'currentColor',
}: {
  name: 'play' | 'note' | 'report' | 'laptop' | 'team';
  size?: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    stroke={color}
    strokeWidth="5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {name === 'play' ? (
      <>
        <circle cx="50" cy="50" r="39" />
        <path d="M42 31 69 50 42 69Z" fill={color} stroke="none" />
      </>
    ) : name === 'note' ? (
      <>
        <rect x="16" y="12" width="68" height="77" rx="9" />
        <path d="M31 34H68M31 49H68M31 64H53" />
      </>
    ) : name === 'report' ? (
      <>
        <path d="M15 15V85H88" />
        <path d="M33 70V48M52 70V30M72 70V14" strokeWidth="11" />
      </>
    ) : name === 'laptop' ? (
      <>
        <rect x="20" y="15" width="60" height="48" rx="5" />
        <path d="M20 63 7 81Q6 88 15 88H85Q94 88 93 81L80 63M41 78H59" />
      </>
    ) : (
      <>
        <circle cx="50" cy="26" r="12" />
        <circle cx="20" cy="43" r="9" />
        <circle cx="80" cy="43" r="9" />
        <path d="M30 82V64Q30 46 50 46Q70 46 70 64V82M6 83V71Q6 55 20 55M94 83V71Q94 55 80 55" />
      </>
    )}
  </svg>
);
