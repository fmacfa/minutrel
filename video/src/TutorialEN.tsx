import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Video } from '@remotion/media';
import { C, clamp, pos, Logo, Kick, Word, SmallLabel } from './DesignEN';
import { Soundtrack } from './AudioEN';
import timing from './timing-en-v2.json';

const cues = [
  {
    marker: 'Projects',
    step: 1,
    title: 'Give every session a project.',
    help: 'Choose the project you are working on.',
    crop: 20,
  },
  {
    marker: 'Choose',
    step: 1,
    title: 'Choose Atlas. Add a task.',
    help: 'Overview → project → optional task.',
    crop: 75,
  },
  {
    marker: 'Describe',
    step: 1,
    title: 'Describe the work.',
    help: 'A few words now will make the session easier to recognise later.',
    crop: 95,
  },
  {
    marker: 'Start',
    step: 2,
    title: 'Start tracking.',
    help: 'Your time is now linked to Atlas.',
    crop: 95,
  },
  {
    marker: 'Pause',
    step: 2,
    title: 'Pause for a break.',
    help: 'Paused time is excluded from your working time.',
    crop: 95,
  },
  {
    marker: 'Resume',
    step: 2,
    title: 'Continue the same session.',
    help: 'Resume when you are ready to work again.',
    crop: 95,
  },
  {
    marker: 'Finish',
    step: 2,
    title: 'Finish to save the session.',
    help: 'Closing a window does not stop the timer.',
    crop: 95,
  },
  {
    marker: 'History',
    step: 3,
    title: 'Review your time entries.',
    help: 'Your completed sessions appear in the selected month.',
    crop: 60,
  },
  {
    marker: 'Manual',
    step: 3,
    title: 'Add time you forgot to track.',
    help: 'Choose a date, enter a duration and describe the work.',
    crop: 105,
  },
  {
    marker: 'SaveTime',
    step: 3,
    title: 'Keep your totals complete.',
    help: 'Save the entry to include it in your totals.',
    crop: 100,
  },
  {
    marker: 'Journal',
    step: 4,
    title: 'Add the story behind the hours.',
    help: 'Your work journal keeps the context.',
    crop: 65,
  },
  {
    marker: 'Note',
    step: 4,
    title: 'Record what moved forward.',
    help: 'Keep a result, a decision or the next step.',
    crop: 125,
  },
  {
    marker: 'Share',
    step: 4,
    title: 'Choose what to share.',
    help: 'Notes are private by default. Shared notes can appear in team reports.',
    crop: 125,
  },
  {
    marker: 'Reports',
    step: 5,
    title: 'See the month clearly.',
    help: 'Completed time, by project and by person.',
    crop: 100,
  },
  {
    marker: 'Period',
    step: 5,
    title: 'Choose the month and team.',
    help: 'Collective exports require an administrator account.',
    crop: 100,
  },
  {
    marker: 'Export',
    step: 5,
    title: 'Take the report with you.',
    help: 'Export a PDF, a CSV or a ZIP archive.',
    crop: 100,
  },
];
const Intro = () => (
  <AbsoluteFill style={{ background: C.ink, color: C.paper }}>
    <div style={pos(96, 60)}>
      <Logo reverse width={275} />
    </div>
    <div style={pos(98, 225)}>
      <SmallLabel color={C.lime}>MINUTREL / YOUR FIRST SESSION</SmallLabel>
      <Word delay={2} size={91} style={{ marginTop: 30 }}>
        FROM PROJECT
      </Word>
      <Word delay={6} size={91} color={C.lime}>
        TO A CLEAR REPORT.
      </Word>
    </div>
    <div style={{ ...pos(100, 584, 1720), display: 'flex', gap: 28 }}>
      {[
        { title: 'On your own', text: 'A personal workspace on your computer.' },
        { title: 'With your team', text: 'A shared workspace on your own server.' },
      ].map((m, i) => (
        <Kick
          key={m.title}
          delay={16 + i * 6}
          style={{
            flex: 1,
            padding: '30px 34px',
            borderRadius: 19,
            border: '1px solid #48616a',
            background: i ? '#1c3b43' : '#19343e',
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 800, color: C.lime }}>{m.title}</div>
          <div style={{ fontSize: 27, marginTop: 15, color: '#d4e2dc' }}>{m.text}</div>
        </Kick>
      ))}
    </div>
    <Kick delay={30} style={{ ...pos(103, 826), fontSize: 24, color: '#c2d3cc' }}>
      This walkthrough: a demo team workspace, using an administrator account.
    </Kick>
    <div style={{ ...pos(103, 964), fontSize: 26, fontWeight: 600 }}>
      PROJECT → TIMER → TIME ENTRIES → NOTES → REPORT
    </div>
  </AbsoluteFill>
);

const Screen = ({
  crop,
  width,
  height,
  top,
}: {
  crop: number;
  width: number;
  height: number;
  top: number;
}) => {
  const scale = width / 1440;
  return (
    <div
      style={{
        ...pos((1920 - width) / 2, top, width),
        height,
        borderRadius: 17,
        border: '1px solid #cdd9d1',
        overflow: 'hidden',
        background: 'white',
        boxShadow: '0 20px 55px #142c3816',
      }}
    >
      <div
        style={{
          height: 34,
          background: '#eaf0e9',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 18px',
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 9, height: 9, borderRadius: 9, background: '#a9bcb1' }} />
        ))}
        <span style={{ fontSize: 15, fontWeight: 600, color: C.slate, marginLeft: 25 }}>
          Minutrel / Demo Studio
        </span>
        <span style={{ fontSize: 14, color: C.slate, marginLeft: 'auto' }}>
          Fictional demo data
        </span>
      </div>
      <div style={{ position: 'relative', height: height - 34, overflow: 'hidden' }}>
        <div
          style={{ position: 'absolute', left: 0, top: -crop * scale, width, height: 900 * scale }}
        >
          <Video
            src={staticFile('captures/minutrel-tutorial-en-v2.webm')}
            trimBefore={Math.round(timing.trim * 30)}
            muted
            style={{ width, height: 900 * scale }}
            objectFit="fill"
          />
        </div>
      </div>
    </div>
  );
};

const Walkthrough = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const timed = cues.map((c) => ({
    ...c,
    time: (timing.markers as Record<string, number>)[c.marker],
  }));
  const cue = [...timed].reverse().find((c) => c.time <= t) ?? timed[0];
  const index = timed.indexOf(cue);
  const previous = timed[Math.max(0, index - 1)];
  const baseCrop = interpolate(t, [cue.time, cue.time + 0.4], [previous.crop, cue.crop], clamp);
  const modal = Math.max(
    ...[
      ['Manual', 'SaveTime'],
      ['Note', 'Reports'],
    ].map(([a, b]) =>
      interpolate(
        t,
        [
          (timing.markers as Record<string, number>)[a] + 0.6,
          (timing.markers as Record<string, number>)[a] + 1.1,
          (timing.markers as Record<string, number>)[b] - 0.3,
          (timing.markers as Record<string, number>)[b] + 0.4,
        ],
        [0, 1, 1, 0],
        clamp,
      ),
    ),
  );
  const report = interpolate(
    t,
    [timing.markers.Reports + 0.7, timing.markers.Reports + 1.2],
    [0, 1],
    clamp,
  );
  const globalT = timing.intro + t;
  const voice = timing.voice.find((v) => globalT >= v.at && globalT <= v.at + v.duration + 0.18);
  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink }}>
      <div style={pos(80, 30)}>
        <Logo width={210} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 80,
          top: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 17,
        }}
      >
        {['Project', 'Timer', 'Time entries', 'Notes', 'Report'].map((name, i) => (
          <div
            key={name}
            style={{
              display: 'flex',
              gap: 9,
              alignItems: 'center',
              fontSize: 18,
              fontWeight: 600,
              color: i < cue.step ? C.green : '#8a9891',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 100,
                background: i < cue.step ? C.green : '#e3e9e0',
                color: i < cue.step ? 'white' : C.slate,
                fontSize: 15,
              }}
            >
              {i + 1}
            </span>
            {name}
          </div>
        ))}
      </div>
      <div style={pos(83, 104)}>
        <SmallLabel color={C.green}>STEP {cue.step} OF 5</SmallLabel>
        <div
          style={{
            fontSize: 49,
            fontWeight: 800,
            letterSpacing: -1.7,
            lineHeight: 1.15,
            marginTop: 13,
          }}
        >
          {cue.title}
        </div>
      </div>
      <Screen
        crop={baseCrop}
        top={220 - modal * 9}
        height={708 + modal * 35 + report * 14}
        width={1760 - modal * 220 - report * 105}
      />
      <div
        style={{
          ...pos(90, 957, 1735),
          fontSize: 26,
          fontWeight: 600,
          lineHeight: 1.42,
          maxHeight: 82,
        }}
      >
        {voice?.text ?? cue.help}
      </div>
      <div style={{ ...pos(90, 1040), fontSize: 17, color: C.slate }}>
        MINUTREL · ENGLISH WALKTHROUGH · ADMINISTRATOR VIEW
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 5,
          width: interpolate(t, [0, timing.duration], [0, 1920], clamp),
          background: C.green,
        }}
      />
    </AbsoluteFill>
  );
};

const Outro = () => (
  <AbsoluteFill style={{ background: C.ink, color: C.paper }}>
    <div style={pos(96, 60)}>
      <Logo reverse width={280} />
    </div>
    <div style={pos(99, 268)}>
      <SmallLabel color={C.lime}>READY FOR YOUR NEXT PROJECT</SmallLabel>
      <Word size={95} delay={2} style={{ marginTop: 28 }}>
        TRACK YOUR WORK.
      </Word>
      <Word size={95} delay={7} color={C.lime}>
        UNDERSTAND YOUR TIME.
      </Word>
    </div>
    <Kick delay={18} style={{ ...pos(103, 654), display: 'flex', gap: 19, fontSize: 29 }}>
      {['Choose a project', 'Track time', 'Add context', 'Review'].map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 19 }}>
          <span style={{ color: C.lime, fontWeight: 800 }}>{String(i + 1).padStart(2, '0')}</span>
          {s}
          {i < 3 ? <span style={{ color: '#54716a' }}>→</span> : null}
        </div>
      ))}
    </Kick>
    <Kick
      delay={30}
      style={{
        ...pos(105, 827),
        fontSize: 35,
        fontWeight: 800,
        padding: '21px 30px',
        background: C.lime,
        color: C.ink,
        borderRadius: 15,
      }}
    >
      Your next session starts here. ↗
    </Kick>
    <div style={{ ...pos(106, 1001), fontSize: 21, color: '#bed0c6' }}>
      Minutrel · Open-source time tracking · Solo & teams
    </div>
  </AbsoluteFill>
);

export const TutorialEN = () => (
  <AbsoluteFill style={{ fontFamily: 'Manrope', background: C.ink }}>
    <Sequence from={0} durationInFrames={Math.round(timing.intro * 30)}>
      <Intro />
    </Sequence>
    <Sequence
      from={Math.round(timing.intro * 30)}
      durationInFrames={Math.round(timing.duration * 30)}
    >
      <Walkthrough />
    </Sequence>
    <Sequence
      from={Math.round((timing.intro + timing.duration) * 30)}
      durationInFrames={Math.round(timing.outro * 30)}
    >
      <Outro />
    </Sequence>
    <Soundtrack voice={timing.voice} music="audio/en-v2/tutorial-score.wav" tutorial />
  </AbsoluteFill>
);
