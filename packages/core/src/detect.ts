export type UmbracoMajor = 17 | 18;

export const SUPPORTED_MAJORS: readonly UmbracoMajor[] = [17, 18];

export interface VersionHints {
	/** Contents of `Directory.Packages.props` or a `.csproj`. */
	projectFiles?: string[];
	/** Any schema path, e.g. `.../uSync/v17/DataTypes/x.config`. */
	schemaPaths?: string[];
	/** Raw `.uda` contents; `__version` is the Deploy version, which tracks the CMS major. */
	deployArtifacts?: string[];
}

function clamp(major: number): UmbracoMajor | null {
	if (!Number.isFinite(major)) return null;
	if (major <= 17) return 17;
	return 18;
}

/** Best-effort detection of the Umbraco major version, in order of reliability. */
export function detectUmbracoMajor(hints: VersionHints): UmbracoMajor | null {
	for (const file of hints.projectFiles ?? []) {
		const m =
			/<Package(?:Version|Reference)\s+Include="Umbraco\.Cms"\s+Version="\[?(\d+)\./i.exec(file) ??
			/<Package(?:Version|Reference)\s+Include="Umbraco\.Cms"[^>]*>\s*<Version>\[?(\d+)\./i.exec(file);
		if (m) return clamp(parseInt(m[1], 10));
	}
	for (const path of hints.schemaPaths ?? []) {
		const m = /uSync\/v(\d+)\//i.exec(path.replace(/\\/g, '/'));
		if (m) return clamp(parseInt(m[1], 10));
	}
	for (const artifact of hints.deployArtifacts ?? []) {
		const m = /"__version"\s*:\s*"(\d+)\./.exec(artifact);
		if (m) return clamp(parseInt(m[1], 10));
	}
	return null;
}
