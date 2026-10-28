// Manifests of the Umbraco 17 core packages that property editors depend on. Mirrors CORE_PACKAGES in
// dist-cms/apps/app/app.element.js, minus server-only sections (health check, log viewer, telemetry, news…).
import type { HostBootstrap } from '@az-umbraco-preview/renderer-shared';
import { manifests as coreManifests } from '@umbraco-cms/internal/packages/core/manifests.js';
import * as block from '@umbraco-cms/internal/packages/block/umbraco-package.js';
import * as clipboard from '@umbraco-cms/internal/packages/clipboard/umbraco-package.js';
import * as codeEditor from '@umbraco-cms/internal/packages/code-editor/umbraco-package.js';
import * as content from '@umbraco-cms/internal/packages/content/umbraco-package.js';
import * as dataType from '@umbraco-cms/internal/packages/data-type/umbraco-package.js';
import * as dictionary from '@umbraco-cms/internal/packages/dictionary/umbraco-package.js';
import * as documents from '@umbraco-cms/internal/packages/documents/umbraco-package.js';
import * as embeddedMedia from '@umbraco-cms/internal/packages/embedded-media/umbraco-package.js';
import * as language from '@umbraco-cms/internal/packages/language/umbraco-package.js';
import * as markdownEditor from '@umbraco-cms/internal/packages/markdown-editor/umbraco-package.js';
import * as media from '@umbraco-cms/internal/packages/media/umbraco-package.js';
import * as members from '@umbraco-cms/internal/packages/members/umbraco-package.js';
import * as multiUrlPicker from '@umbraco-cms/internal/packages/multi-url-picker/umbraco-package.js';
import * as propertyEditors from '@umbraco-cms/internal/packages/property-editors/umbraco-package.js';
import * as relations from '@umbraco-cms/internal/packages/relations/umbraco-package.js';
import * as rte from '@umbraco-cms/internal/packages/rte/umbraco-package.js';
import * as segment from '@umbraco-cms/internal/packages/segment/umbraco-package.js';
import * as settings from '@umbraco-cms/internal/packages/settings/umbraco-package.js';
import * as staticFile from '@umbraco-cms/internal/packages/static-file/umbraco-package.js';
import * as tags from '@umbraco-cms/internal/packages/tags/umbraco-package.js';
import * as templating from '@umbraco-cms/internal/packages/templating/umbraco-package.js';
import * as tiptap from '@umbraco-cms/internal/packages/tiptap/umbraco-package.js';
import * as ufm from '@umbraco-cms/internal/packages/ufm/umbraco-package.js';
import * as user from '@umbraco-cms/internal/packages/user/umbraco-package.js';

export const bootstrap: HostBootstrap = {
	coreManifests: coreManifests as never,
	packages: [
		block, clipboard, codeEditor, content, dataType, dictionary, documents, embeddedMedia, language,
		markdownEditor, media, members, multiUrlPicker, propertyEditors, relations, rte, segment, settings,
		staticFile, tags, templating, tiptap, ufm, user,
	] as never,
	// `treeStore` is still used in 17; it was removed in 18.
	apiInitializerTypes: ['globalContext', 'store', 'treeStore', 'itemStore'],
};
