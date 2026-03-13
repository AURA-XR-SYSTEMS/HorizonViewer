export interface AuraView {
  id: number
  name: string
  imageUrl: string
}

export interface AuraTransition {
  key: string
  from: number
  to: number
  videoUrl: string
}

export interface AuraViewPosition {
  viewId: number
  x: number
  y: number
}

export interface AuraLocationDescription {
  Short?: string
  Detailed?: string
  Type?: string
}

export interface AuraLocation {
  id: string
  place_id?: string
  Name: string
  Address?: string
  Region?: string
  Description?: AuraLocationDescription
  Attributes?: Record<string, string>
  viewPositions: AuraViewPosition[]
}

export interface ProjectConfig {
  views: AuraView[]
  transitions: AuraTransition[]
  locations: AuraLocation[]
}
