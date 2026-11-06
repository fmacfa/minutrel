import { Audio } from '@remotion/media';
import { staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { clamp } from './DesignEN';
export type VoiceClip = { file: string; at: number; duration: number; text: string; id: string };
export const Soundtrack = ({
  voice,
  music,
  tutorial = false,
}: {
  voice: VoiceClip[];
  music: string;
  tutorial?: boolean;
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = f / fps;
  let activity = 0;
  for (const clip of voice) {
    const a = interpolate(
      t,
      [clip.at - 0.16, clip.at, clip.at + clip.duration, clip.at + clip.duration + 0.35],
      [0, 1, 1, 0],
      clamp,
    );
    activity = Math.max(activity, a);
  }
  const base = tutorial ? 0.34 : 0.58;
  const under = tutorial ? 0.15 : 0.23;
  const fade = interpolate(
    f,
    [0, 8, durationInFrames - 22, durationInFrames - 1],
    [0, 1, 1, 0],
    clamp,
  );
  return (
    <>
      <Audio src={staticFile(music)} volume={(base + (under - base) * activity) * fade} />
      {voice.map((v) => (
        <Audio
          key={v.id}
          from={Math.round(v.at * fps)}
          durationInFrames={Math.ceil(v.duration * fps) + 1}
          src={staticFile(v.file)}
          volume={0.96}
        />
      ))}
    </>
  );
};
