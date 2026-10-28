import * as SDK from 'azure-devops-extension-sdk';
import { loadPullRequest } from './ado/load-pull-request.js';
import './compare/compare-app.element.js';

const app = document.querySelector('upr-compare-app')!;
// Renderers are packaged next to this page, one per supported Umbraco major.
app.rendererUrls = {
	17: new URL('renderer-v17/index.html', location.href).href,
	18: new URL('renderer-v18/index.html', location.href).href,
};

SDK.init({ loaded: false, applyTheme: true });
SDK.ready()
	.then(() => {
		SDK.notifyLoadSucceeded();
		return loadPullRequest((status) => (app.status = status));
	})
	.then((data) => (app.data = data))
	.catch((e: Error) => {
		console.error(e);
		app.error = `Could not load the Umbraco preview: ${e.message}`;
	});
