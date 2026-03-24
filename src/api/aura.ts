import { ProjectConfig } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Fetches project configuration from the Aura backend.
 * For 'horizon-metro' key, loads from the pre-generated config.json.
 * For other keys, hits the real API endpoint.
 */
export async function fetchProject(auraKey: string): Promise<ProjectConfig> {
  // Local HORIZON config (pre-encoded from VideoCaptures)
  if (auraKey === 'demo' || auraKey === 'horizon-metro') {
    const response = await fetch('/assets/horizon/config.json');
    if (!response.ok) throw new Error('Failed to load HORIZON config');
    return response.json();
  }

  // Real API for other projects
  const response = await fetch(`${API_BASE_URL}/projects/${auraKey}`);
  if (!response.ok) throw new Error('Failed to fetch project');
  return response.json();
}

/**
 * Validates an Aura key with the backend.
 */
export async function validateKey(auraKey: string): Promise<boolean> {
  if (auraKey === 'demo' || auraKey === 'horizon-metro') {
    return true;
  }

  const response = await fetch(`${API_BASE_URL}/validate/${auraKey}`);
  return response.ok;
}
