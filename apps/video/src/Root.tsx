import {Composition, Folder} from 'remotion';

import {
  MEMOO_BRAND_STORY_DURATION,
  MemooBrandStory,
  type MemooBrandStoryProps,
} from './MemooBrandStory';

const defaultProps = {
  challengeTag: '#GeminiLiveAgentChallenge',
} satisfies MemooBrandStoryProps;

export const RemotionRoot = () => {
  return (
    <Folder name="Memoo">
      <Composition
        id="MemooBrandStory"
        component={MemooBrandStory}
        durationInFrames={MEMOO_BRAND_STORY_DURATION}
        fps={30}
        width={1600}
        height={900}
        defaultProps={defaultProps}
      />
    </Folder>
  );
};
