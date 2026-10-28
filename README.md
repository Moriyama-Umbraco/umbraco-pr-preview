# Umbraco PR Preview

An Azure DevOps extension that adds an **Umbraco** tab to pull requests. Changed **uSync** and **Umbraco Deploy** schema files (data types, document/element/media/member types) are rendered using the real Umbraco backoffice property editors. The target branch and the pull request appear side by side, with added, removed and changed tabs, groups, properties and configuration highlighted. A raw diff toggle shows the source files.

Supports Umbraco **17** and **18**.

## How it works

```
Azure DevOps PR tab (packages/ado-extension, Lit, no backoffice code)
  ├─ GitRestClient: PR → last iteration → changed paths → schema roots
  ├─ getItems + getBlobsZip: whole schema folder at merge-base and PR head (2 requests per side)
  ├─ core: parse uSync/Deploy → normalised snapshot → semantic diff
  └─ two iframes (base | head) of renderer-v17 or renderer-v18, driven by postMessage
renderers/vXX (one Vite app per Umbraco major, own node_modules)
  ├─ <upr-host>: minimal stand-in for <umb-app> (manifests, global contexts, icons, localization)
  ├─ in-memory Management API (hey-api `fetch` override) serving the snapshot
  └─ views built from <umb-property> so every editor is the real one
```

| Path | What |
|---|---|
| `packages/core` | Parsers (uSync XML, Deploy `.uda`), normalised model, semantic diff, editor layout (tabs/groups/compositions), Management API mapping, version detection. Pure TS, unit tested. |
| `packages/renderer-shared` | Lit host, mock API, preview views, postMessage protocol, dev harness, shared Vite config. Consumed as source by each renderer. |
| `renderers/v17`, `renderers/v18` | Thin Vite apps pinning `@umbraco-cms/backoffice` and its peers. **Not** npm workspaces, so each gets its own isolated `node_modules`. |
| `packages/ado-extension` | Extension manifest, PR tab page, compare shell, ADO loader, packaging. |
| `fixtures` | Synthetic uSync and Deploy schemas (`base` / `head`). `make-head.py` regenerates `head` from `base`. |
| `scripts` | `pin-backoffice-peers.mjs` (pin peers to Umbraco's lockfile) and `smoke.mjs` (headless screenshot check). |

## Getting started

```sh
npm install          # workspaces, then each renderer's isolated install (postinstall)
npm test             # core unit tests
npm run typecheck    # all packages and both renderers
```

### Working on the views (one side, in-page)

```sh
cd renderers/v17 && npx vite                  # http://localhost:5170/dev.html?set=usync&side=head
```

`dev.html` renders a fixture entity directly in the page. Use `set=usync|deploy`, `side=base|head`, `key=<guid>`.

### Working on the shell (side by side, like the PR tab)

```sh
cd renderers/v17 && npx vite build && npm run preview     # :5172 (built renderer)
cd packages/ado-extension && npx vite                     # http://localhost:5180/dev.html?set=deploy
```

The shell harness points at *built* renderers (`npm run preview`, ports 5172/5173). Two iframes of unbundled dev modules exhaust the browser's connection budget.

### Packaging

1. Set `publisher` in `packages/ado-extension/vss-extension.json` to your Marketplace publisher id.
2. Build and package:

   ```sh
   npm run package      # builds both renderers + the extension → out/*.vsix
   ```

3. Publish privately and share with your organisation (or upload the VSIX in the Marketplace portal):

   ```sh
   npx tfx extension publish --vsix out/<file>.vsix --share-with <org> --token <PAT>
   ```

4. Install it in the organisation. Open a PR that touches `uSync/v*/…` or `umbraco/Deploy/Revision/*.uda` and select the **Umbraco** tab.

`npm run package:dev -w packages/ado-extension` builds a side-by-side "(dev)" variant with a different extension id.

## Upgrading Umbraco versions

The published `@umbraco-cms/backoffice` declares loose peer ranges, but its `dist-cms` imports deep paths that move between minor versions (monaco-editor, tiptap). Each renderer therefore pins every peer to the exact version in that release's `Umbraco.Web.UI.Client/package-lock.json`:

```sh
curl -L -o .cache/lock.json https://raw.githubusercontent.com/umbraco/Umbraco-CMS/release-18.2.2/src/Umbraco.Web.UI.Client/package-lock.json
node scripts/pin-backoffice-peers.mjs renderers/v18 .cache/lock.json
rm -rf renderers/v18/node_modules renderers/v18/package-lock.json && npm install --prefix renderers/v18
```

When adding a major, copy `renderers/v18`. Update `src/packages.ts` from `CORE_PACKAGES` in `dist-cms/apps/app/app.element.js` and the initializers in `dist-cms/packages/core/entry-point.js`, then add the major to `SUPPORTED_MAJORS` in `packages/core/src/detect.ts`.

## Known limitations

- **Third-party property editors** (Contentment, uSync Forms, community packages) aren't in the core bundle and render as Umbraco's "missing editor" placeholder. Their configuration is still shown and diffed.
- **Editor modals** (for example the Block List catalogue) don't open. The buttons render, but the modal route doesn't display.
- **Property descriptions** aren't shown beside labels in the wide (side-label) layout. They do appear when the label is stacked on top. Description changes are still flagged in the change badges.
- **Content and media items** (uSync `Content/`, `Media/`) are not previewed yet. Deploy repositories don't store content in git.
- **Bundle size**: each renderer is about 27 MB on disk, about 1.6 MB gzipped on initial load. Monaco and the localization files make up most of it.

## License

[MIT](LICENSE)
