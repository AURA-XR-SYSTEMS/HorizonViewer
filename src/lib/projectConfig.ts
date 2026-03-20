import type { ProjectConfig } from '@/types'
import { mapApiConfig } from './configMapper'
import { fetchApiProjectConfig } from './projectConfigApi'

export async function loadProjectConfig(): Promise<ProjectConfig> {
  const apiConfig = await fetchApiProjectConfig()
  return mapApiConfig(apiConfig)
}
