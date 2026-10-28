import './theme.js';
import { startDevHarness } from '@az-umbraco-preview/renderer-shared/dev-harness.ts';
import { bootstrap } from './packages.js';

startDevHarness({ ...bootstrap, major: 17 });
