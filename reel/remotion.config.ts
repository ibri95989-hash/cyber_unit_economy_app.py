import {Config} from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(96);
Config.setCodec('h264');
Config.setCrf(16);
Config.setChromiumOpenGlRenderer('angle');
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(60000);
