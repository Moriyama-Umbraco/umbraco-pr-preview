import './theme.js';
import { startRenderer } from '@az-umbraco-preview/renderer-shared';
import { bootstrap } from './packages.js';

startRenderer({ ...bootstrap, major: 18 });
