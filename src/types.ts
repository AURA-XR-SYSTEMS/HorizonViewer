export interface ViewNode {
  id: number;
  name: string;
  imageUrl: string;
}

export interface Transition {
  from: number;
  to: number;
  videoUrl: string;
  key: string;
}

export interface AuraLocation {
  id: string;
  place_id: string;
  Name: string;
  Address?: string;
  Coordinates?: { Lat: number; Lng: number; Alt: number };
  Region?: string;
  Description?: { Short?: string; Detailed?: string; Type?: string };
  Attributes?: Record<string, string>;
  Links?: { SourceLinks?: string[]; Citations?: string[] };
  viewPositions: {
    viewId: number;
    x: number; // 0-100 percentage
    y: number; // 0-100 percentage
  }[];
}

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  views: ViewNode[];
  transitions: Transition[];
  locations: AuraLocation[];
  metadata?: {
    description?: string;
    createdAt?: string;
    [key: string]: unknown;
  };
}
