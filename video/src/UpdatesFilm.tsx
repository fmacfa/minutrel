import {
  AbsoluteFill,
  Composition,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { Video } from '@remotion/media';
import { C, Kick, Logo, SmallLabel, clamp, pos } from './DesignEN';
import { Soundtrack, type VoiceClip } from './AudioEN';
import source from './updates/catalog.json';

type Scene = {
  key: string;
  title: string;
  role: string;
  atFrame: number;
  length: number;
  step: number;
  layout: string;
  source: string;
  trim: number;
};
type Film = {
  id: number;
  composition: string;
  title: string;
  shortTitle: string;
  summary: string;
  durationInFrames: number;
  scenes: Scene[];
  voice: VoiceClip[];
};
const catalog = source as Film[];
const notes: Record<string, [string, string][]> = {
  record: [
    ['Project', 'Atlas'],
    ['Subcategory', 'Client review'],
    ['Example duration', '45 minutes'],
  ],
  budget: [
    ['Project budget', '40 hours'],
    ['Deadline', 'Optional target date'],
    ['Project overview', 'Recorded and remaining time'],
  ],
  action: [
    ['Action', 'Review identity concepts'],
    ['Assignee', 'Jordan Lee'],
    ['Estimate', '6 hours'],
  ],
  link: [
    ['Subcategory', 'Client review'],
    ['Action', 'Review identity concepts'],
    ['Example duration', '30 minutes'],
  ],
  rate: [
    ['Team member', 'Jordan Lee'],
    ['Example rate', '€85 per hour'],
    ['Access', 'Administrator'],
  ],
  approve: [
    ['Team member', 'Jordan Lee'],
    ['Submitted time', '4 hours'],
    ['Reviewer', 'Manager'],
  ],
};

const Motif = ({ id, color }: { id: number; color: string }) => (
  <svg
    viewBox="0 0 360 360"
    width="360"
    height="360"
    fill="none"
    stroke={color}
    strokeWidth="8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="342" height="342" rx="64" strokeOpacity=".29" />
    {id === 13 ? (
      <>
        <path d="M82 103h73l20 25h104v142H82z" />
        <path d="M119 172h120m-120 37h93m-93 37h75" />
        <circle cx="263" cy="246" r="8" fill={color} />
      </>
    ) : id === 14 ? (
      <>
        <circle cx="156" cy="169" r="78" strokeOpacity=".3" />
        <path d="M156 91a78 78 0 0 1 78 78M156 120v51l30 17" />
        <path d="M209 239h68m-68 37h50m-69-37h1m-1 37h1" />
      </>
    ) : id === 15 ? (
      <>
        <path d="M87 93v182h187M138 94v180m49-180v180m49-180v180" strokeOpacity=".32" />
        <path d="M104 130h102m-51 57h117m-75 56h72" strokeWidth="22" />
        <circle cx="104" cy="130" r="5" fill={C.ink} stroke="none" />
      </>
    ) : (
      <>
        <rect x="97" y="86" width="167" height="188" rx="19" />
        <path d="M133 128h94m-94 43h68m-68 44h45" />
        <circle cx="251" cy="249" r="40" fill={C.ink} />
        <path d="m232 250 13 13 23-26" />
      </>
    )}
  </svg>
);

const Cover = ({ film, end }: { film: Film; end: boolean }) => {
  const frame = useCurrentFrame();
  const color = end ? C.ink : C.paper;
  const accent = end ? C.green : C.lime;
  return (
    <AbsoluteFill style={{ background: end ? C.lime : C.ink, color }}>
      <div style={pos(96, 60)}>
        <Logo width={245} reverse={!end} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 79,
          right: 98,
          fontSize: 21,
          color: end ? C.green : '#bbcec6',
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        DEVELOPMENT PREVIEW
      </div>
      <Kick delay={0} distance={24} style={pos(96, 245, 1190)}>
        <SmallLabel color={accent}>GUIDE {film.id} / NOVEMBER 2026</SmallLabel>
        <div
          style={{
            marginTop: 25,
            fontSize: 89,
            fontWeight: 800,
            lineHeight: 1.055,
            letterSpacing: -4.3,
          }}
        >
          {end ? 'Keep exploring Minutrel.' : film.title}
        </div>
      </Kick>
      <Kick
        delay={9}
        distance={15}
        style={{
          ...pos(100, 658, 1190),
          fontSize: 33,
          lineHeight: 1.45,
          fontWeight: 600,
          color: end ? C.ink : '#d4e4dc',
        }}
      >
        {end ? 'Source and guides · github.com/fmacfa/minutrel' : film.summary}
      </Kick>
      <div
        style={{
          ...pos(1392, 302),
          transform: `translateY(${interpolate(frame, [0, 35], [19, 0], clamp)}px)`,
        }}
      >
        <Motif id={film.id} color={accent} />
      </div>
      <div
        style={{
          ...pos(100, 870),
          fontSize: 19,
          letterSpacing: 2.2,
          color: end ? C.green : '#a8c3b9',
          fontWeight: 800,
        }}
      >
        OPEN SOURCE · PROJECT TIME TRACKING
      </div>
    </AbsoluteFill>
  );
};

const Screen = ({ film, scene }: { film: Film; scene: Scene }) => {
  const frame = useCurrentFrame();
  const fit = scene.layout === 'fit';
  const width = fit ? 1136 : 1728;
  const scale = width / 1440;
  const crop = fit ? 0 : scene.key === 'review' ? 65 : 80;
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
      <div style={pos(96, 47)}>
        <Logo width={174} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 96,
          top: 58,
          fontSize: 18,
          color: C.slate,
          fontWeight: 800,
          letterSpacing: 1.65,
        }}
      >
        {film.shortTitle.toUpperCase()}
      </div>
      <div
        style={{
          ...pos(96, 104, 1728),
          display: 'flex',
          alignItems: 'end',
          justifyContent: 'space-between',
        }}
      >
        <Kick distance={10}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2.2, color: C.green }}>
            STEP {String(scene.step).padStart(2, '0')} /{' '}
            {String(film.scenes.length - 2).padStart(2, '0')}
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 46,
              letterSpacing: -1.5,
              fontWeight: 800,
              lineHeight: 1.13,
            }}
          >
            {scene.title}
          </div>
        </Kick>
        {scene.role && (
          <div
            style={{
              background: '#e5eee5',
              borderRadius: 18,
              padding: '10px 17px',
              color: C.green,
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {scene.role}
          </div>
        )}
      </div>
      <div
        style={{
          ...pos(96, 199, width),
          height: 744,
          overflow: 'hidden',
          border: `1px solid ${C.line}`,
          borderRadius: 18,
          background: C.white,
          boxShadow: '0 18px 50px #142c3816',
        }}
      >
        <div
          style={{
            height: 34,
            padding: '0 17px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#e9f0e8',
            color: C.slate,
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ width: 8, height: 8, background: '#a8bbae', borderRadius: '50%' }}
            />
          ))}
          <span style={{ marginLeft: 12 }}>Minutrel · Demo Studio</span>
          <span style={{ marginLeft: 'auto' }}>Fictional data</span>
        </div>
        <div style={{ position: 'relative', overflow: 'hidden', height: 710 }}>
          <Video
            src={staticFile(scene.source)}
            trimBefore={Math.round(scene.trim * 30)}
            muted
            style={{
              position: 'absolute',
              left: 0,
              top: -crop * scale,
              width,
              height: 900 * scale,
            }}
            objectFit="fill"
          />
        </div>
      </div>
      {fit && (
        <div style={{ ...pos(1270, 275, 554), display: 'grid', gap: 18 }}>
          {(notes[scene.key] ?? []).map(([label, value], index) => (
            <Kick
              key={label}
              delay={index * 4 + 3}
              distance={12}
              style={{
                padding: '25px 27px',
                border: `1px solid ${C.line}`,
                borderRadius: 21,
                background: index === 0 ? '#e7efe7' : C.white,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: 1.8,
                  color: C.green,
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 31,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: -0.55,
                  marginTop: 7,
                }}
              >
                {value}
              </div>
            </Kick>
          ))}
        </div>
      )}
      <div
        style={{
          ...pos(96, 947, 1728),
          height: 4,
          borderRadius: 3,
          background: '#e0e8e0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(100 * (frame + 1)) / scene.length}%`,
            height: '100%',
            background: C.green,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const Captions = ({ film }: { film: Film }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const cue = film.voice.find((v) => t >= v.at && t < v.at + v.duration + 0.07);
  const current = film.scenes.find((s) => frame >= s.atFrame && frame < s.atFrame + s.length);
  const intro = current?.key === 'intro';
  if (!cue) return null;
  return (
    <div
      style={{
        ...pos(96, 968, 1728),
        minHeight: 53,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '7px 0',
        color: intro ? C.paper : C.ink,
      }}
    >
      <span
        style={{
          borderRadius: 7,
          padding: '5px 8px',
          color: intro ? C.ink : C.white,
          background: intro ? C.lime : C.green,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        EN
      </span>
      <span style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25 }}>{cue.text}</span>
    </div>
  );
};

const UpdateFilm = ({ filmId }: { filmId: number }) => {
  const film = catalog.find((item) => item.id === filmId);
  if (!film) throw new Error('Unknown update film');
  return (
    <AbsoluteFill style={{ fontFamily: 'Manrope, sans-serif', background: C.paper }}>
      {film.scenes.map((scene) => (
        <Sequence
          key={scene.key}
          from={scene.atFrame}
          durationInFrames={scene.length}
          name={scene.title || scene.key}
        >
          {scene.layout === 'cover' ? (
            <Cover film={film} end={scene.key === 'outro'} />
          ) : (
            <Screen film={film} scene={scene} />
          )}
        </Sequence>
      ))}
      <Captions film={film} />
      <Soundtrack voice={film.voice} music="audio/en-v2/tutorial-score.wav" tutorial />
    </AbsoluteFill>
  );
};

export const UpdateCompositions = () => (
  <>
    {catalog.map((film) => (
      <Composition
        key={film.id}
        id={film.composition}
        component={UpdateFilm}
        defaultProps={{ filmId: film.id }}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={film.durationInFrames}
      />
    ))}
  </>
);
