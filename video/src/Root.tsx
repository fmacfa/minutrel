import { Composition } from 'remotion';
import { PresentationEN } from './PresentationEN';
import { TutorialEN } from './TutorialEN';
import timing from './timing-en-v2.json';
import { SeriesFilm } from './SeriesFilm';
import series from './series/catalog.json';
export const Root = () => (
  <>
    <Composition
      id="MinutrelPresentationEN"
      component={PresentationEN}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={timing.presentationSeconds * 30}
    />
    <Composition
      id="MinutrelTutorialEN"
      component={TutorialEN}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={Math.round(timing.total * 30)}
    />
    {series
      .filter((f) => f.ready)
      .map((f) => (
        <Composition
          key={f.id}
          id={f.composition}
          component={SeriesFilm}
          defaultProps={{ filmId: f.id }}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={Math.round(f.total * 30)}
        />
      ))}
  </>
);
