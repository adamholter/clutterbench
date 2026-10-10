import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { Launch } from './Launch.jsx';

const Root = () => <Composition id="Launch" component={Launch} durationInFrames={660} fps={30} width={1920} height={1080} />;
registerRoot(Root);
