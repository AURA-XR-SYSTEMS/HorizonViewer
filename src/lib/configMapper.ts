import type { ProjectConfig } from '@/types'

export function mapApiConfig(raw: any): ProjectConfig {
  return {
    views: raw.views,
    locations: raw.locations,
    transitions: raw.transitions,
  }
}
