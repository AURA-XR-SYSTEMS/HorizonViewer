import { ProjectConfig } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Fetches project configuration.
 * 'demo' loads the active project from /assets/active-project.json.
 * Named keys load from /assets/projects/{key}/config.json.
 * Falls back to the real API for unknown keys.
 */
export async function fetchProject(auraKey: string): Promise<ProjectConfig> {
  // "demo" resolves to the active project
  if (auraKey === 'demo') {
    const activeRes = await fetch('/assets/active-project.json');
    if (activeRes.ok) {
      const { activeProject } = await activeRes.json();
      auraKey = activeProject;
    } else {
      auraKey = 'horizon-metro'; // fallback
    }
  }

  // Try loading from local projects folder
  const localRes = await fetch(`/assets/projects/${auraKey}/config.json`);
  if (localRes.ok) return localRes.json();

  // Fall back to real API
  const response = await fetch(`${API_BASE_URL}/projects/${auraKey}`);
  if (!response.ok) throw new Error('Failed to fetch project');
  return response.json();
}

/**
 * Fetches the list of available local projects.
 */
export async function listProjects(): Promise<{ id: string; name: string }[]> {
  const res = await fetch('/assets/projects/index.json');
  if (!res.ok) return [];
  return res.json();
}
