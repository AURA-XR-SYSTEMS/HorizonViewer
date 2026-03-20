import type { ProjectConfig } from '@/types'
import type { ApiProjectConfig } from './apiSchemas'

export function mapApiConfig(apiConfig: ApiProjectConfig): ProjectConfig {
  return {
    views: apiConfig.views,
    locations: apiConfig.locations.map((location) => ({
      ...location,
    })),
    transitions: apiConfig.transitions,
  }
}
