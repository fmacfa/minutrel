import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video } from '@remotion/media';
import { C, pos, Logo, SmallLabel, Kick, Icon } from './DesignEN';
import { Soundtrack } from './AudioEN';
import rawCatalog from './series/catalog.json';
type Scene = {
  key: string;
  title?: string;
  text: string;
  index: number;
  count: number;
  at: number;
  length: number;
  duration: number;
  visual: string;
  shots: string[];
  crop: number;
  trim: number;
  source?: string;
  bullets?: string[];
  code?: string[];
};
type Film = {
  id: number;
  shortTitle: string;
  title: string;
  icon: string;
  scenes: Scene[];
  voice: { id: string; file: string; text: string; at: number; duration: number }[];
  total: number;
};
const catalog = rawCatalog as Film[];
const Heading = ({ film, scene }: { film: Film; scene: Scene }) => (
  <>
    <div style={pos(80, 28)}>
      <Logo width={207} />
    </div>
    <div
      style={{
        position: 'absolute',
        right: 82,
        top: 47,
        fontSize: 20,
        fontWeight: 600,
        color: C.slate,
      }}
    >
      MINUTREL / {film.shortTitle.toUpperCase()}
    </div>
    <div style={pos(83, 105)}>
      <SmallLabel color={C.green}>
        STEP {scene.index} OF {scene.count}
      </SmallLabel>
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: -1.7,
          lineHeight: 1.15,
          marginTop: 12,
          maxWidth: 1750,
        }}
      >
        {scene.title}
      </div>
    </div>
  </>
);
const Caption = ({ film }: { film: Film }) => {
  const f = useCurrentFrame(),
    t = f / 30;
  const current = film.scenes.find((s) => t >= s.at && t < s.at + s.length);
  if (current?.visual === 'intro' || current?.visual === 'outro') return null;
  const v = film.voice.find((v) => t >= v.at && t <= v.at + v.duration + 0.25);
  return (
    <div
      style={{
        ...pos(90, 953, 1735),
        fontSize: 26,
        lineHeight: 1.42,
        fontWeight: 600,
        color: C.ink,
      }}
    >
      {v?.text}
    </div>
  );
};
const Cover = ({ film, scene, end = false }: { film: Film; scene: Scene; end?: boolean }) => (
  <AbsoluteFill style={{ background: end ? C.lime : C.ink, color: end ? C.ink : C.paper }}>
    <div style={pos(96, 58)}>
      <Logo reverse={!end} width={265} />
    </div>
    <div style={pos(100, 243, 1500)}>
      <SmallLabel color={end ? C.green : C.lime}>
        MINUTREL / GUIDE {String(film.id).padStart(2, '0')}
      </SmallLabel>
      <Kick
        delay={2}
        style={{
          fontSize: 87,
          lineHeight: 1.08,
          fontWeight: 800,
          letterSpacing: -3.3,
          maxWidth: 1450,
          marginTop: 28,
        }}
      >
        {end ? 'Your next step starts here.' : film.title}
      </Kick>
    </div>
    <Kick
      delay={15}
      style={{
        ...pos(104, 653, 1560),
        fontSize: 35,
        lineHeight: 1.45,
        fontWeight: 600,
        color: end ? C.ink : '#d5e3dc',
      }}
    >
      {scene.text}
    </Kick>
    <Kick delay={10} style={{ ...pos(1540, 80), color: end ? C.green : C.lime }}>
      <Icon name={film.icon as 'laptop'} size={240} />
    </Kick>
    <div
      style={{ ...pos(105, 986), fontSize: 23, fontWeight: 600, color: end ? C.green : '#bdcec4' }}
    >
      OPEN-SOURCE TIME TRACKING · SOLO & TEAMS
    </div>
  </AbsoluteFill>
);
const Captured = ({ scene }: { scene: Scene }) => {
  const f = useCurrentFrame(),
    { fps } = useVideoConfig();
  const shotIndex = Math.min(
    scene.shots.length - 1,
    Math.floor(f / Math.max(1, (scene.length * fps) / scene.shots.length)),
  );
  const shot = scene.shots[Math.max(0, shotIndex)];
  const modal = [
    'member',
    'roles',
    'project',
    'add',
    'edit',
    'note',
    'privacy',
    'draft',
    'approve',
    'access',
    'scope',
    'engines',
    'map',
    'read',
  ].includes(scene.key);
  const width = scene.key === 'engines' ? 1200 : modal ? 1540 : 1760,
    scale = width / 1440,
    height = modal ? 734 : 709;
  const top = modal ? 211 : 220;
  return (
    <div
      style={{
        ...pos((1920 - width) / 2, top, width),
        height,
        border: '1px solid #cbd8cf',
        borderRadius: 17,
        overflow: 'hidden',
        background: 'white',
        boxShadow: '0 20px 55px #142c3815',
      }}
    >
      <div
        style={{
          height: 34,
          padding: '0 19px',
          background: '#eaf0e9',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 9, height: 9, borderRadius: 9, background: '#a9bbb0' }} />
        ))}
        <span style={{ fontSize: 15, color: C.slate, marginLeft: 20, fontWeight: 600 }}>
          Minutrel / {scene.visual === 'native' ? 'Desktop app' : 'Demo Studio'}
        </span>
        <span style={{ fontSize: 14, color: C.slate, marginLeft: 'auto' }}>
          Fictional demo data
        </span>
      </div>
      <div style={{ position: 'relative', height: height - 34, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: -scene.crop * scale, width }}>
          {scene.visual === 'capture' && scene.source ? (
            <Video
              src={staticFile(scene.source)}
              trimBefore={Math.round(scene.trim * fps)}
              muted
              style={{ width, height: 900 * scale }}
              objectFit="fill"
            />
          ) : shot ? (
            <Img src={staticFile(shot)} style={{ display: 'block', width, height: 'auto' }} />
          ) : null}
        </div>
      </div>
    </div>
  );
};
const Mini = ({ scene }: { scene: Scene }) => {
  const f = useCurrentFrame();
  const index = Math.min(
    scene.shots.length - 1,
    Math.floor(f / Math.max(1, (scene.length * 30) / scene.shots.length)),
  );
  return (
    <>
      <Kick
        delay={2}
        style={{
          ...pos(112, 330, 650),
          fontSize: 75,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: -2.5,
        }}
      >
        {scene.key === 'open' ? (
          <>
            THE TIMER.
            <br />
            <span style={{ color: C.green }}>WITHIN REACH.</span>
          </>
        ) : scene.key === 'pause' ? (
          <>
            PAUSE.
            <br />
            <span style={{ color: C.green }}>THEN RESUME.</span>
          </>
        ) : (
          <>
            FINISH.
            <br />
            <span style={{ color: C.green }}>TIME SAVED.</span>
          </>
        )}
      </Kick>
      <div
        style={{
          ...pos(897, 300, 880),
          height: 550,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Img
          src={staticFile(scene.shots[index])}
          style={{
            display: 'block',
            maxWidth: 880,
            maxHeight: 550,
            width: 'auto',
            height: 'auto',
            borderRadius: 24,
            boxShadow: '0 25px 65px #142c3820',
          }}
        />
      </div>
      <div style={{ ...pos(118, 760), fontSize: 27, color: C.slate }}>
        Same session. Same project.
      </div>
    </>
  );
};
const Diagram = ({ scene }: { scene: Scene }) => (
  <div style={{ ...pos(130, 300, 1660), display: 'flex', gap: 30 }}>
    {(scene.bullets ?? ['Your computer', 'Your team server', 'Your workspace']).map((s, i) => (
      <Kick
        key={s}
        delay={i * 6}
        style={{
          flex: 1,
          minHeight: 420,
          padding: '45px 35px',
          borderRadius: 23,
          background: i === 1 ? C.ink : 'white',
          border: `1px solid ${C.line}`,
          color: i === 1 ? C.paper : C.ink,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 800, color: i === 1 ? C.lime : C.green }}>
          {String(i + 1).padStart(2, '0')}
        </div>
        <div style={{ margin: '35px 0', color: i === 1 ? C.lime : C.green }}>
          <Icon name={i === 0 ? 'laptop' : i === 1 ? 'team' : 'report'} size={95} />
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.25 }}>{s}</div>
      </Kick>
    ))}
  </div>
);
const Code = ({ scene }: { scene: Scene }) => (
  <div
    style={{
      ...pos(135, 244, 1650),
      border: '1px solid #36535b',
      background: C.ink,
      borderRadius: 22,
      overflow: 'hidden',
      boxShadow: '0 20px 45px #142c3819',
    }}
  >
    <div
      style={{
        height: 49,
        background: '#1f3c46',
        padding: '12px 26px',
        color: '#b7d0c4',
        fontSize: 20,
        fontWeight: 600,
      }}
    >
      TERMINAL / MINUTREL APPLICATION FOLDER
    </div>
    <div style={{ padding: '33px 40px 40px', minHeight: 545 }}>
      {(scene.code ?? []).map((line, i) => (
        <Kick
          key={i}
          delay={i * 3}
          distance={13}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 32,
            lineHeight: 1.62,
            color: line.startsWith('#') ? '#9bb6a9' : line.startsWith('http') ? C.lime : '#f0f5eb',
            whiteSpace: 'pre',
          }}
        >
          {line || ' '}
        </Kick>
      ))}
    </div>
  </div>
);
const Body = ({ film, scene }: { film: Film; scene: Scene }) => (
  <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
    <Heading film={film} scene={scene} />
    {scene.visual === 'mini' ? (
      <Mini scene={scene} />
    ) : scene.visual === 'diagram' ? (
      <Diagram scene={scene} />
    ) : scene.visual === 'code' ? (
      <Code scene={scene} />
    ) : (
      <Captured scene={scene} />
    )}
    <div style={{ ...pos(90, 1040), fontSize: 17, color: C.slate }}>
      MINUTREL · ENGLISH GUIDE ·{' '}
      {scene.visual === 'native' || scene.visual === 'mini'
        ? 'CAPTURED FROM THE DESKTOP APP'
        : 'DEMONSTRATION WORKSPACE'}
    </div>
  </AbsoluteFill>
);
export const SeriesFilm = ({ filmId }: { filmId: number }) => {
  const film = catalog.find((f) => f.id === filmId)!;
  return (
    <AbsoluteFill style={{ fontFamily: 'Manrope', background: C.ink }}>
      {film.scenes.map((scene) => (
        <Sequence
          key={scene.key}
          from={Math.round(scene.at * 30)}
          durationInFrames={Math.round(scene.length * 30)}
        >
          {scene.visual === 'intro' || scene.visual === 'outro' ? (
            <Cover film={film} scene={scene} end={scene.visual === 'outro'} />
          ) : (
            <Body film={film} scene={scene} />
          )}
        </Sequence>
      ))}
      <Caption film={film} />
      <Soundtrack voice={film.voice} music="audio/en-v2/tutorial-score.wav" tutorial />
    </AbsoluteFill>
  );
};
