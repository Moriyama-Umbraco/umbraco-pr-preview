/**
 * Stand-in for `<umb-app>` / `<umb-backoffice>`: registers the core manifests and provides the global contexts
 * that property editors expect, without a server, router or auth flow. Adapted from the Storybook host in
 * Umbraco.Web.UI.Client/.storybook/preview.js.
 */
import { css, html, customElement } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import { UmbBooleanState } from '@umbraco-cms/backoffice/observable-api';
import { UmbExtensionsApiInitializer, type ManifestBase } from '@umbraco-cms/backoffice/extension-api';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { UmbModalManagerContext } from '@umbraco-cms/backoffice/modal';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { umbLocalizationRegistry } from '@umbraco-cms/backoffice/localization';
import { UmbIconRegistry } from '@umbraco-cms/internal/packages/core/icon-registry/icon.registry.js';
import icons from '@umbraco-cms/internal/packages/core/icon-registry/icons.js';
import '@umbraco-cms/backoffice/components';

/** A module shaped like `packages/<name>/umbraco-package.js`. */
export interface UmbracoPackageModule {
	extensions: Array<ManifestBase & { js?: { manifests?: ManifestBase[] } }>;
}

export interface HostBootstrap {
	/** `packages/core/manifests.js` of the pinned version. */
	coreManifests: ManifestBase[];
	packages: UmbracoPackageModule[];
	/** Extension-api initializer types to start; v17 also needs `treeStore`. */
	apiInitializerTypes: string[];
}

/** Manifest types that need a real server or backoffice shell and only add noise here. */
const SKIPPED_TYPES = new Set(['section', 'dashboard', 'headerApp', 'appEntryPoint', 'backofficeEntryPoint', 'authProvider']);

class UprAuthContext extends UmbContextBase {
	#isAuthorized = new UmbBooleanState(true);
	isAuthorized = this.#isAuthorized.asObservable();
	getIsAuthorized() {
		return true;
	}
	constructor(host: UmbLitElement) {
		super(host, 'UmbAuthContext');
	}
}

let registered = false;

export function registerManifests(bootstrap: HostBootstrap) {
	if (registered) return;
	registered = true;
	const manifests = [
		...bootstrap.coreManifests,
		...bootstrap.packages.flatMap((p) => p.extensions.flatMap((e) => (e.type === 'bundle' ? (e.js?.manifests ?? []) : [e]))),
	];
	for (const manifest of manifests) {
		if (SKIPPED_TYPES.has(manifest.type)) continue;
		if (!umbExtensionsRegistry.isRegistered(manifest.alias)) umbExtensionsRegistry.register(manifest);
	}
}

@customElement('upr-host')
export class UprHostElement extends UmbLitElement {
	static bootstrap: HostBootstrap;

	#iconRegistry = new UmbIconRegistry();

	constructor() {
		super();
		const bootstrap = UprHostElement.bootstrap;
		if (!bootstrap) throw new Error('UprHostElement.bootstrap must be set before <upr-host> is created');

		for (const type of bootstrap.apiInitializerTypes) {
			new UmbExtensionsApiInitializer(this, umbExtensionsRegistry, type as never, [this]);
		}
		this.#iconRegistry.setIcons(icons as never);
		this.#iconRegistry.attach(this);
		registerManifests(bootstrap);

		new UprAuthContext(this);
		new UmbModalManagerContext(this);
		new UmbNotificationContext(this);

		umbLocalizationRegistry.loadLanguage('en');
	}

	override render() {
		return html`<slot></slot>
			<umb-backoffice-modal-container></umb-backoffice-modal-container>
			<umb-backoffice-notification-container></umb-backoffice-notification-container>`;
	}

	static override styles = css`
		:host {
			display: block;
		}
	`;
}

declare global {
	interface HTMLElementTagNameMap {
		'upr-host': UprHostElement;
	}
}
