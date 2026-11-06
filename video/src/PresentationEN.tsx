import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from 'remotion';
import { C, clamp, pos, Logo, Kick, Word, SmallLabel, Icon } from './DesignEN';
import { Soundtrack } from './AudioEN';
import narration from './voice-en-v2.json';

const Grid = ({ dark = false }: { dark?: boolean }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `radial-gradient(${dark ? '#57716c' : '#b8c7bd'} 1.2px, transparent 1.2px)`,
      backgroundSize: '32px 32px',
      opacity: dark ? 0.17 : 0.22,
    }}
  />
);
const Frame = ({ number, dark = false }: { number: string; dark?: boolean }) => (
  <>
    <div style={pos(94, 52)}>
      <Logo reverse={dark} width={260} />
    </div>
    <div
      style={{
        position: 'absolute',
        right: 98,
        top: 72,
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: 2,
        color: dark ? C.lime : C.green,
      }}
    >
      {number} / 05
    </div>
  </>
);
const Clock = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f - 2, fps, config: { stiffness: 180, damping: 20 } });
  const angle = interpolate(f, [0, 68, 120], [0, 280, 360], clamp);
  return (
    <div
      style={{
        ...pos(1190, 210, 620),
        height: 620,
        transform: `scale(${0.7 + 0.3 * enter}) rotate(${(1 - enter) * -25}deg)`,
      }}
    >
      <svg width="620" height="620" viewBox="0 0 620 620">
        <circle cx="310" cy="310" r="289" fill={C.green} />
        <circle cx="310" cy="310" r="250" fill="none" stroke="#43a297" strokeWidth="2" />
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M310 60V82"
            transform={`rotate(${i * 30} 310 310)`}
            stroke={C.lime}
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
        <g transform={`rotate(${angle} 310 310)`}>
          <path d="M310 310V130" stroke={C.lime} strokeWidth="17" strokeLinecap="round" />
        </g>
        <path d="M310 310 425 365" stroke="white" strokeWidth="15" strokeLinecap="round" />
        <circle cx="310" cy="310" r="17" fill="white" />
      </svg>
      <div
        style={{
          ...pos(160, 408, 300),
          background: C.lime,
          padding: '17px 26px',
          textAlign: 'center',
          borderRadius: 12,
          fontSize: 33,
          fontWeight: 800,
          transform: 'rotate(-5deg)',
          color: C.ink,
        }}
      >
        EVERY PROJECT.
      </div>
    </div>
  );
};
const Definition = () => (
  <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
    <Grid />
    <Frame number="01" />
    <div style={pos(96, 238)}>
      <SmallLabel color={C.green}>MEET MINUTREL</SmallLabel>
      <Word size={175} delay={0} style={{ marginTop: 28 }}>
        TIME
      </Word>
      <Word size={175} delay={4}>
        TRACKING.
      </Word>
      <Kick
        delay={9}
        style={{
          display: 'inline-block',
          fontSize: 62,
          fontWeight: 800,
          color: C.paper,
          background: C.green,
          padding: '12px 25px',
          marginTop: 18,
          transformOrigin: 'left',
        }}
      >
        BY PROJECT.
      </Kick>
    </div>
    <Clock />
    <Kick delay={16} style={{ ...pos(101, 949), fontSize: 34, fontWeight: 600 }}>
      Open source. For people and teams.
    </Kick>
  </AbsoluteFill>
);

const Track = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.ink, color: C.paper }}>
      <Grid dark />
      <Frame number="02" dark />
      <div style={pos(96, 230)}>
        <SmallLabel color={C.lime}>FROM HOURS TO UNDERSTANDING</SmallLabel>
        <Word delay={0} size={108} style={{ marginTop: 35 }}>
          TRACK WORK.
        </Word>
        <Word delay={5} size={108}>
          KEEP CONTEXT.
        </Word>
      </div>
      {[
        { name: 'DESIGN', time: '2h 30', note: 'Exploring the first ideas', color: C.lime },
        { name: 'BUILD', time: '1h 45', note: 'Making the next version', color: '#b9dfd3' },
        { name: 'RESEARCH', time: '45 min', note: 'Finding the right direction', color: C.paper },
      ].map((p, i) => {
        const s = spring({ frame: f - 8 - i * 7, fps, config: { damping: 18, stiffness: 200 } });
        const origin = i % 2 ? 1 : -1;
        return (
          <div
            key={p.name}
            style={{
              ...pos(1040, 223 + i * 195, 780),
              height: 170,
              padding: '26px 30px',
              background: p.color,
              color: C.ink,
              borderRadius: 17,
              opacity: interpolate(f, [8 + i * 7, 13 + i * 7], [0, 1], clamp),
              transform: `translateX(${(1 - s) * 550}px) rotate(${(1 - s) * origin * 12}deg)`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 43,
                fontWeight: 800,
                letterSpacing: -1,
              }}
            >
              <span>{p.name}</span>
              <span>{p.time}</span>
            </div>
            <div style={{ fontSize: 25, marginTop: 15, opacity: 0.75 }}>{p.note}</div>
          </div>
        );
      })}
      <div style={{ ...pos(98, 738), display: 'flex', gap: 20, alignItems: 'center' }}>
        {(['play', 'note', 'report'] as const).map((n, i) => (
          <Kick
            key={n}
            delay={20 + i * 8}
            style={{ display: 'flex', alignItems: 'center', gap: 22 }}
          >
            <div
              style={{
                width: 130,
                height: 130,
                border: '1px solid #4b6669',
                borderRadius: 23,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.lime,
              }}
            >
              <Icon name={n} size={67} />
            </div>
            {i < 2 ? <span style={{ color: '#7c9995', fontSize: 33 }}>→</span> : null}
          </Kick>
        ))}
      </div>
      <Kick delay={40} style={{ ...pos(100, 953), fontSize: 32, color: '#d4e1dc' }}>
        A project. A session. A record of what moved forward.
      </Kick>
    </AbsoluteFill>
  );
};

const Reports = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.green, color: 'white' }}>
      <Grid dark />
      <Frame number="03" dark />
      <div style={pos(96, 245)}>
        <SmallLabel color={C.lime}>A CLEARER VIEW OF YOUR WORK</SmallLabel>
        <Word size={128} delay={0} style={{ marginTop: 30 }}>
          MAKE YOUR
        </Word>
        <Word size={128} delay={4}>
          MONTH
        </Word>
        <Word size={128} delay={8} color={C.lime}>
          ADD UP.
        </Word>
      </div>
      <Kick
        delay={8}
        style={{
          ...pos(1060, 228, 740),
          padding: '28px 34px 34px',
          borderRadius: 23,
          background: C.paper,
          color: C.ink,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: 2, color: C.green }}>
            ONE CLEAR PICTURE
          </span>
          <span style={{ fontSize: 88, fontWeight: 800, letterSpacing: -4 }}>5h</span>
        </div>
        {[
          ['Design', '2h 30', 1],
          ['Build', '1h 45', 0.7],
          ['Research', '45 min', 0.3],
        ].map(([label, time, n], i) => (
          <div key={label} style={{ marginTop: 35 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 30,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              <span>{label}</span>
              <span>{time}</span>
            </div>
            <div
              style={{ height: 25, background: '#dde7de', borderRadius: 100, overflow: 'hidden' }}
            >
              <div
                style={{
                  height: 25,
                  width: `${Number(n) * 100 * interpolate(f, [22 + i * 7, 43 + i * 7], [0, 1], clamp)}%`,
                  background: i === 0 ? C.green : i === 1 ? '#7f9241' : '#b3774c',
                  borderRadius: 100,
                }}
              />
            </div>
          </div>
        ))}
      </Kick>
      <Kick
        delay={30}
        style={{ ...pos(1070, 832), fontSize: 28, fontWeight: 600, color: '#dcece1' }}
      >
        Time by project. Context for the team.
      </Kick>
      <div style={{ ...pos(100, 920), display: 'flex', gap: 18 }}>
        {['PDF', 'CSV', 'ZIP'].map((s, i) => (
          <Kick
            key={s}
            delay={23 + i * 5}
            style={{
              fontSize: 31,
              fontWeight: 800,
              border: '1px solid #bde2d1',
              padding: '13px 25px',
              borderRadius: 12,
            }}
          >
            {s} ↗
          </Kick>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Modes = () => {
  const f = useCurrentFrame();
  const divider = interpolate(f, [0, 12], [0, 1080], clamp);
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 0,
          width: 960,
          height: 1080,
          background: C.ink,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 958,
          top: 0,
          width: 4,
          height: divider,
          background: C.lime,
        }}
      />
      <Frame number="04" />
      <div
        style={{
          position: 'absolute',
          right: 98,
          top: 72,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 2,
          color: C.lime,
        }}
      >
        04 / 05
      </div>
      <div style={pos(100, 236)}>
        <Word delay={0} size={136}>
          SOLO.
        </Word>
        <Kick delay={8} style={{ fontSize: 35, marginTop: 18, color: C.slate }}>
          On your computer.
        </Kick>
      </div>
      <div style={{ ...pos(1055, 236), color: C.paper }}>
        <Word delay={7} size={122}>
          TOGETHER.
        </Word>
        <Kick delay={15} style={{ fontSize: 35, marginTop: 28, color: '#d7e5df' }}>
          On your own server.
        </Kick>
      </div>
      <Kick delay={15} style={{ ...pos(318, 485), color: C.green }}>
        <Icon name="laptop" size={310} />
      </Kick>
      <Kick delay={22} style={{ ...pos(1280, 485), color: C.lime }}>
        <Icon name="team" size={310} />
      </Kick>
      <Kick delay={25} style={{ ...pos(103, 842), fontSize: 50, fontWeight: 800, color: C.green }}>
        LOCAL. NO SERVER NEEDED.
      </Kick>
      <Kick delay={30} style={{ ...pos(1058, 842), fontSize: 50, fontWeight: 800, color: C.lime }}>
        SHARED. SELF-HOSTED.
      </Kick>
      <Kick delay={40} style={{ ...pos(102, 956), fontSize: 29, color: C.slate }}>
        Start independently.
      </Kick>
      <Kick delay={45} style={{ ...pos(1058, 956), fontSize: 29, color: '#d7e5df' }}>
        Choose where your team’s data lives.
      </Kick>
    </AbsoluteFill>
  );
};

const End = () => {
  const f = useCurrentFrame();
  const pop = interpolate(f, [15, 26, 40], [0.8, 1.08, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.lime, color: C.ink }}>
      <Grid />
      <Frame number="05" />
      <div style={pos(96, 236)}>
        <Word delay={0} size={128}>
          YOUR PROJECTS.
        </Word>
        <Word delay={6} size={128}>
          YOUR TIME.
        </Word>
        <Word delay={12} size={128}>
          YOUR DATA.
        </Word>
      </div>
      <Kick
        delay={16}
        style={{
          ...pos(1280, 306, 470),
          height: 470,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: C.ink,
          borderRadius: 70,
          overflow: 'hidden',
          transformOrigin: 'center',
        }}
      >
        <Img
          src={staticFile('brand/minutrel-app.png')}
          style={{ width: 470, height: 470, transform: `scale(${pop})` }}
        />
      </Kick>
      <Kick delay={25} style={{ ...pos(103, 844), fontSize: 43, fontWeight: 800 }}>
        Time tracking. On your terms.
      </Kick>
      <Kick
        delay={32}
        style={{
          ...pos(104, 947),
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          fontSize: 28,
          fontWeight: 600,
        }}
      >
        <span style={{ padding: '13px 23px', background: C.ink, color: C.paper, borderRadius: 11 }}>
          Discover Minutrel ↗
        </span>
        <span>Open source · Solo & teams</span>
      </Kick>
    </AbsoluteFill>
  );
};

export const PresentationEN = () => (
  <AbsoluteFill style={{ fontFamily: 'Manrope', background: C.paper }}>
    <Sequence from={0} durationInFrames={120}>
      <Definition />
    </Sequence>
    <Sequence from={120} durationInFrames={150}>
      <Track />
    </Sequence>
    <Sequence from={270} durationInFrames={150}>
      <Reports />
    </Sequence>
    <Sequence from={420} durationInFrames={210}>
      <Modes />
    </Sequence>
    <Sequence from={630} durationInFrames={150}>
      <End />
    </Sequence>
    <Soundtrack voice={narration.presentation} music="audio/en-v2/presentation-score.wav" />
  </AbsoluteFill>
);
