import type { CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Video } from '@remotion/media';
import { loadFont } from '@remotion/fonts';
import { C, FPS, INTRO_SECONDS, OUTRO_SECONDS, SOURCE, tutorialCues } from './film';
import timing from './timing.json';

for (const [file, weight] of [
  ['Regular', '400'],
  ['SemiBold', '600'],
  ['ExtraBold', '800'],
]) {
  loadFont({ family: 'Manrope', url: staticFile(`fonts/Manrope-${file}.ttf`), weight });
}
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const abs = (left: number, top: number, width?: number): CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width,
});
const Logo = ({ reverse = false, width = 225 }: { reverse?: boolean; width?: number }) => (
  <Img
    src={staticFile(`brand/minutrel-${reverse ? 'reverse' : 'primary'}.svg`)}
    style={{ width, display: 'block' }}
  />
);
const Reveal = ({
  children,
  delay = 0,
  style = {},
}: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 24, stiffness: 120 } });
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(f, [delay, delay + 12], [0, 1], clamp),
        transform: `translateY(${(1 - s) * 24}px)`,
      }}
    >
      {children}
    </div>
  );
};
const Label = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
  <div
    style={{
      fontSize: 21,
      fontWeight: 800,
      letterSpacing: 3,
      color: dark ? C.lime : C.green,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);
const Pill = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
  <div
    style={{
      padding: '14px 24px',
      borderRadius: 100,
      border: `1px solid ${dark ? '#496069' : C.line}`,
      color: dark ? C.paper : C.ink,
      fontSize: 24,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}
  >
    <span style={{ width: 9, height: 9, borderRadius: 9, background: dark ? C.lime : C.green }} />
    {children}
  </div>
);

const Thread = ({ dark = false }: { dark?: boolean }) => {
  const f = useCurrentFrame();
  return (
    <svg
      style={{
        position: 'absolute',
        right: -60,
        top: 40,
        width: 1040,
        height: 960,
        opacity: dark ? 0.35 : 0.13,
      }}
      viewBox="0 0 1000 1000"
    >
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M 90 ${260 + i * 140} H 300 Q 380 ${260 + i * 140} 380 ${340 + i * 140} V ${510 + i * 90} Q 380 ${590 + i * 90} 460 ${590 + i * 90} H 920`}
          fill="none"
          stroke={i === 1 ? C.lime : C.green}
          strokeWidth={i === 1 ? 5 : 2}
          strokeDasharray={1400}
          strokeDashoffset={interpolate(f, [0, 70], [1400, 0], clamp)}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={850}
          cy={590 + i * 90}
          r={i === 1 ? 12 : 7}
          fill={i === 1 ? C.lime : C.green}
        />
      ))}
    </svg>
  );
};

const Intro = ({ tutorial = false }: { tutorial?: boolean }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink, color: C.paper }}>
      <Thread dark />
      <div style={abs(100, 60)}>
        <Logo reverse width={260} />
      </div>
      <Reveal delay={4} style={abs(105, tutorial ? 205 : 260, 1510)}>
        <Label dark>
          {tutorial ? 'PRISE EN MAIN · 5 ÉTAPES' : 'LE TEMPS DE VOS PROJETS, ENSEMBLE.'}
        </Label>
        <div
          style={{
            fontSize: tutorial ? 91 : 110,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: -4,
            marginTop: 32,
            maxWidth: 1480,
          }}
        >
          {tutorial ? (
            <>
              Votre première session,
              <br />
              <span style={{ color: C.lime }}>du projet au bilan.</span>
            </>
          ) : (
            <>
              Faites de la place
              <br />
              au travail <span style={{ color: C.lime }}>qui compte.</span>
            </>
          )}
        </div>
      </Reveal>
      {tutorial ? (
        <Reveal delay={35} style={abs(108, 610, 1690)}>
          <div style={{ display: 'flex', gap: 26 }}>
            {[
              { title: 'Seul sur ordinateur', text: 'Un espace personnel, sans serveur.' },
              { title: 'Avec votre équipe', text: 'Un espace partagé sur votre serveur.' },
            ].map((card, i) => (
              <div
                key={card.title}
                style={{
                  width: 690,
                  padding: '24px 30px',
                  border: '1px solid #425860',
                  borderRadius: 20,
                  background: i ? '#1c3a44' : '#18323c',
                }}
              >
                <div style={{ color: C.lime, fontSize: 29, fontWeight: 800 }}>{card.title}</div>
                <div style={{ fontSize: 24, marginTop: 9, color: '#d7e2df' }}>{card.text}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 23, marginTop: 35, color: '#d7e2df' }}>
            Dans cette vidéo : un espace d’équipe, avec un compte administrateur.
          </div>
        </Reveal>
      ) : (
        <Reveal delay={20} style={abs(108, 755)}>
          <div style={{ display: 'flex', gap: 18 }}>
            <Pill dark>Par projet</Pill>
            <Pill dark>Seul ou en équipe</Pill>
            <Pill dark>Libre</Pill>
          </div>
        </Reveal>
      )}
      <div style={{ ...abs(108, 1002), fontSize: 20, color: '#b9cbc9' }}>
        Minutrel · Suivi du temps par projet
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 5,
          background: C.lime,
          width: interpolate(f, [0, tutorial ? 300 : 150], [0, 1920], clamp),
        }}
      />
    </AbsoluteFill>
  );
};

const Browser = ({
  trim = 0,
  crop = 65,
  src = SOURCE,
  still,
  top = 220,
  height = 730,
  width = 1760,
}: {
  trim?: number;
  crop?: number;
  src?: string;
  still?: string;
  top?: number;
  height?: number;
  width?: number;
}) => {
  const scale = width / 1440;
  return (
    <div
      style={{
        ...abs((1920 - width) / 2, top, width),
        height,
        borderRadius: 18,
        overflow: 'hidden',
        background: 'white',
        border: '1px solid #d1dad5',
        boxShadow: '0 20px 50px #142c3816',
      }}
    >
      <div
        style={{
          height: 36,
          background: '#edf0eb',
          borderBottom: `1px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 7,
        }}
      >
        {[0, 1, 2].map((n) => (
          <span key={n} style={{ width: 9, height: 9, borderRadius: 9, background: '#adbbb4' }} />
        ))}
        <span style={{ marginLeft: 24, fontSize: 15, fontWeight: 600, color: C.slate }}>
          Minutrel / Atelier Démo
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 14, color: C.slate }}>Données fictives</span>
      </div>
      <div style={{ position: 'relative', height: height - 36, overflow: 'hidden' }}>
        <div
          style={{ position: 'absolute', left: 0, top: -crop * scale, width, height: 900 * scale }}
        >
          {still ? (
            <Img src={staticFile(still)} style={{ width, height: 900 * scale }} />
          ) : (
            <Video
              src={staticFile(src)}
              trimBefore={Math.round(trim * FPS)}
              muted
              style={{ width, height: 900 * scale }}
              objectFit="fill"
            />
          )}
        </div>
      </div>
    </div>
  );
};

const DemoScene = ({ kind }: { kind: 'timer' | 'reports' }) => (
  <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
    <div style={abs(82, 43)}>
      <Logo width={200} />
    </div>
    <Reveal delay={3} style={abs(82, 115)}>
      <Label>{kind === 'timer' ? '01 / SUIVRE LE TRAVAIL' : '02 / COMPRENDRE LE MOIS'}</Label>
      <div style={{ fontSize: 53, fontWeight: 800, letterSpacing: -1.8, marginTop: 12 }}>
        {kind === 'timer'
          ? 'Un projet. Un clic. Le temps est suivi.'
          : 'Des temps précis. Un bilan clair.'}
      </div>
    </Reveal>
    <Browser
      trim={
        timing.trim +
        timing.markers[kind === 'timer' ? 'Demarrer' : 'Rapports'] +
        (kind === 'timer' ? 0 : 5.2)
      }
      crop={100}
      top={238}
      height={kind === 'timer' ? 700 : 738}
    />
    <Reveal delay={12} style={abs(92, kind === 'timer' ? 982 : 1000)}>
      <div style={{ fontSize: 29, color: C.slate }}>
        {kind === 'timer'
          ? 'Démarrez, mettez en pause, reprenez.'
          : 'Temps par projet · Notes partagées · Exports PDF et CSV'}
      </div>
    </Reveal>
  </AbsoluteFill>
);

const WidgetScene = () => (
  <AbsoluteFill style={{ background: C.ink, color: C.paper }}>
    <Thread dark />
    <div style={abs(100, 60)}>
      <Logo reverse width={225} />
    </div>
    <Reveal delay={3} style={abs(105, 292, 850)}>
      <Label dark>LE MINI CHRONO</Label>
      <div
        style={{ fontSize: 88, fontWeight: 800, letterSpacing: -3, lineHeight: 1.1, marginTop: 25 }}
      >
        Gardez le temps
        <br />
        <span style={{ color: C.lime }}>à portée de main.</span>
      </div>
      <p style={{ fontSize: 30, lineHeight: 1.5, color: '#d7e2df', maxWidth: 700, marginTop: 28 }}>
        Le compteur vous accompagne
        <br />
        pendant que vous travaillez.
      </p>
    </Reveal>
    <Reveal
      delay={10}
      style={{
        ...abs(1010, 270, 780),
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: '0 35px 80px #0004',
      }}
    >
      <Img src={staticFile('stills/widget.png')} style={{ display: 'block', width: 780 }} />
    </Reveal>
    <div style={{ ...abs(1015, 952), fontSize: 22, color: '#b9cbc9' }}>
      Application ordinateur · Navigateurs compatibles
    </div>
  </AbsoluteFill>
);

const Modes = () => (
  <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
    <div style={abs(100, 60)}>
      <Logo width={250} />
    </div>
    <Reveal delay={3} style={abs(105, 218)}>
      <Label>VOTRE FAÇON DE TRAVAILLER</Label>
      <div
        style={{ fontSize: 85, fontWeight: 800, letterSpacing: -3, lineHeight: 1.1, marginTop: 25 }}
      >
        Seul ou en équipe.
        <br />
        <span style={{ color: C.green }}>Vous gardez la main.</span>
      </div>
    </Reveal>
    <div style={{ ...abs(105, 530, 1710), display: 'flex', gap: 30 }}>
      {[
        {
          n: '01',
          title: 'Sur votre ordinateur',
          lines: ['Un espace personnel autonome.', 'Sans serveur ni compte en ligne.'],
        },
        {
          n: '02',
          title: 'Avec votre équipe',
          lines: ['Un espace partagé et autohébergé.', 'Dans le navigateur ou sur ordinateur.'],
        },
      ].map((v, i) => (
        <Reveal
          key={v.n}
          delay={10 + i * 8}
          style={{
            flex: 1,
            padding: '35px 40px',
            background: i ? C.ink : 'white',
            color: i ? C.paper : C.ink,
            border: `1px solid ${C.line}`,
            borderRadius: 22,
          }}
        >
          <span style={{ fontSize: 23, fontWeight: 800, color: i ? C.lime : C.green }}>{v.n}</span>
          <div style={{ fontSize: 39, fontWeight: 800, margin: '20px 0' }}>{v.title}</div>
          {v.lines.map((l) => (
            <div key={l} style={{ fontSize: 26, lineHeight: 1.65, color: i ? '#d7e2df' : C.slate }}>
              {l}
            </div>
          ))}
        </Reveal>
      ))}
    </div>
    <Reveal delay={25} style={abs(108, 944)}>
      <div style={{ display: 'flex', gap: 42, fontSize: 24, fontWeight: 600, color: C.green }}>
        <span>Logiciel libre</span>
        <span>Vos projets</span>
        <span>Votre infrastructure</span>
      </div>
    </Reveal>
  </AbsoluteFill>
);

const Outro = ({ tutorial = false }: { tutorial?: boolean }) => (
  <AbsoluteFill style={{ background: C.ink, color: C.paper }}>
    <Thread dark />
    <div style={abs(100, 60)}>
      <Logo reverse width={280} />
    </div>
    <Reveal delay={4} style={abs(108, 285, 1600)}>
      <Label dark>{tutorial ? 'VOUS ÊTES PRÊT' : 'MINUTREL'}</Label>
      <div
        style={{
          fontSize: 100,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: -3.6,
          marginTop: 28,
        }}
      >
        {tutorial ? (
          <>
            Du temps suivi.
            <br />
            <span style={{ color: C.lime }}>Un travail qui se raconte.</span>
          </>
        ) : (
          <>
            Le temps de vos projets,
            <br />
            <span style={{ color: C.lime }}>ensemble.</span>
          </>
        )}
      </div>
    </Reveal>
    <Reveal delay={18} style={abs(112, 662)}>
      <div style={{ fontSize: 34, color: '#d7e2df' }}>
        {tutorial
          ? 'Projet → Chronomètre → Temps → Notes → Rapport'
          : 'Commencez par votre premier projet.'}
      </div>
    </Reveal>
    <Reveal delay={26} style={abs(112, 802)}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 40,
          background: C.lime,
          color: C.ink,
          borderRadius: 16,
          padding: '22px 31px',
          fontSize: 30,
          fontWeight: 800,
        }}
      >
        {tutorial ? 'À vous de jouer' : 'Découvrez Minutrel'}
        <span style={{ fontSize: 37 }}>↗</span>
      </div>
    </Reveal>
    <div style={{ ...abs(112, 1000), fontSize: 21, color: '#b9cbc9' }}>
      Minutrel · Logiciel libre · Données de démonstration fictives
    </div>
  </AbsoluteFill>
);

export const Presentation = () => (
  <AbsoluteFill style={{ fontFamily: 'Manrope', background: C.ink }}>
    <Sequence from={0} durationInFrames={150}>
      <Intro />
    </Sequence>
    <Sequence from={150} durationInFrames={210}>
      <DemoScene kind="timer" />
    </Sequence>
    <Sequence from={360} durationInFrames={150}>
      <WidgetScene />
    </Sequence>
    <Sequence from={510} durationInFrames={300}>
      <DemoScene kind="reports" />
    </Sequence>
    <Sequence from={810} durationInFrames={210}>
      <Modes />
    </Sequence>
    <Sequence from={1020} durationInFrames={180}>
      <Outro />
    </Sequence>
  </AbsoluteFill>
);

const Walkthrough = () => {
  const f = useCurrentFrame();
  const seconds = f / FPS;
  const cues = tutorialCues.map((c) => ({
    ...c,
    time: timing.markers[c.marker as keyof typeof timing.markers] ?? 0,
  }));
  const cue = [...cues].reverse().find((c) => c.time <= seconds) ?? cues[0];
  const index = cues.indexOf(cue);
  const previous = cues[Math.max(0, index - 1)];
  const crop = interpolate(
    f,
    [Math.round(cue.time * FPS), Math.round(cue.time * FPS) + 18],
    [previous.crop, cue.crop],
    clamp,
  );
  const modal = Math.max(
    ...[
      ['AjoutManuel', 'SauverManuel'],
      ['NouvelleNote', 'SauverNote'],
    ].map(([a, b]) =>
      interpolate(
        seconds,
        [
          (timing.markers as Record<string, number>)[a] + 0.6,
          (timing.markers as Record<string, number>)[a] + 1.1,
          (timing.markers as Record<string, number>)[b] + 0.6,
          (timing.markers as Record<string, number>)[b] + 1.1,
        ],
        [0, 1, 1, 0],
        clamp,
      ),
    ),
  );
  const report = interpolate(
    seconds,
    [timing.markers.Rapports + 0.6, timing.markers.Rapports + 1.1],
    [0, 1],
    clamp,
  );
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
      <div style={abs(80, 30)}>
        <Logo width={205} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 80,
          top: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 13,
        }}
      >
        {['Projet', 'Chrono', 'Temps', 'Notes', 'Rapport'].map((name, i) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              color: i < cue.step ? C.green : '#85938e',
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 29,
                height: 29,
                borderRadius: 29,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: i < cue.step ? C.green : '#e4e9e3',
                color: i < cue.step ? 'white' : C.slate,
                fontSize: 16,
              }}
            >
              {i + 1}
            </span>
            {name}
            {i < 4 ? <span style={{ color: C.line, marginLeft: 2 }}>—</span> : null}
          </div>
        ))}
      </div>
      <div style={abs(83, 105)}>
        <Label>PRISE EN MAIN / ÉTAPE {cue.step} SUR 5</Label>
        <div style={{ fontSize: 49, fontWeight: 800, letterSpacing: -1.8, marginTop: 10 }}>
          {cue.title}
        </div>
      </div>
      <Browser
        trim={timing.trim}
        crop={report ? crop * (1 - report) + 100 * report : crop}
        top={220 - modal * 10}
        height={718 + modal * 28 + report * 10}
        width={1760 - modal * 220 - report * 100}
      />
      <div style={{ ...abs(90, 964, 1720), fontSize: 28, fontWeight: 800, lineHeight: 1.3 }}>
        {cue.line}
      </div>
      <div style={{ ...abs(90, 1009, 1720), fontSize: 23, color: C.slate, lineHeight: 1.3 }}>
        {cue.detail}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 5,
          background: C.green,
          width: interpolate(f, [0, timing.duration * FPS], [0, 1920], clamp),
        }}
      />
    </AbsoluteFill>
  );
};

export const Tutorial = () => (
  <AbsoluteFill style={{ fontFamily: 'Manrope', background: C.ink }}>
    <Sequence from={0} durationInFrames={INTRO_SECONDS * FPS}>
      <Intro tutorial />
    </Sequence>
    <Sequence from={INTRO_SECONDS * FPS} durationInFrames={Math.round(timing.duration * FPS)}>
      <Walkthrough />
    </Sequence>
    <Sequence
      from={Math.round((INTRO_SECONDS + timing.duration) * FPS)}
      durationInFrames={OUTRO_SECONDS * FPS}
    >
      <Outro tutorial />
    </Sequence>
  </AbsoluteFill>
);
