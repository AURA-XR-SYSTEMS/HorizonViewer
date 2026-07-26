import { ProjectConfig } from '../types';
import { fetchExportConfig, type LoadedProject } from '../lib/bootstrapClient';
import type { ProjectSource } from '../lib/projectSource';

/**
 * Loads a bundled project shipped with the viewer.
 *
 * 'demo' resolves through /assets/active-project.json so the demo target can be
 * switched without a rebuild. Used for local dev and offline client demos;
 * shared links go through HorizonServer instead.
 */
export async function fetchStaticProject(auraKey: string): Promise<ProjectConfig> {
  let resolvedKey = auraKey;

  if (resolvedKey === 'demo') {
    const activeRes = await fetch('/assets/active-project.json');
    if (activeRes.ok) {
      const { activeProject } = await activeRes.json();
      resolvedKey = activeProject;
    } else {
      resolvedKey = 'horizon-metro';
    }
  }

  const localRes = await fetch(`/assets/projects/${resolvedKey}/config.json`);
  if (!localRes.ok) {
    throw new Error(`No bundled project named "${resolvedKey}".`);
  }
  return localRes.json();
}

/** Loads whichever source the URL resolved to. */
export async function fetchProjectForSource(source: ProjectSource): Promise<LoadedProject> {
  switch (source.kind) {
    case 'export':
      return fetchExportConfig(source.exportId);
    case 'static':
      // Bundled projects ship with the viewer and have no server-side owner,
      // so there is nothing to edit authoritatively.
      return { config: await fetchStaticProject(source.auraKey), canEdit: false };
    case 'none':
      throw new Error('No project specified.');
  }
}

/** Lists bundled projects, if an index was shipped. */
export async function listProjects(): Promise<{ id: string; name: string }[]> {
  const res = await fetch('/assets/projects/index.json');
  if (!res.ok) return [];
  return res.json();
}
