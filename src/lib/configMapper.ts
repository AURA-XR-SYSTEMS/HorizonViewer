import type { ProjectConfig, ViewNode, Transition, AuraLocation } from '../types';
import type { ApiProjectConfig } from './apiSchemas';

/**
 * Maps a server config onto the viewer's internal shape.
 *
 * Two mismatches make this more than a cast: the API models absent values as
 * `null` while the viewer's types use optional (`undefined`), and the viewer
 * treats projectId/projectName/place_id as required. Server configs predating
 * the extended contract carry none of those, so they are defaulted here rather
 * than forcing every consumer to null-check.
 */

function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function mapView(view: ApiProjectConfig['views'][number]): ViewNode {
  return {
    id: view.id,
    name: view.name,
    imageUrl: view.imageUrl,
    thumbUrl: orUndefined(view.thumbUrl),
    embed: orUndefined(view.embed),
    alternateLayers: orUndefined(view.alternateLayers),
  };
}

function mapTransition(transition: ApiProjectConfig['transitions'][number]): Transition {
  return {
    key: transition.key,
    from: transition.from,
    to: transition.to,
    videoUrl: transition.videoUrl,
  };
}

function mapLocation(location: ApiProjectConfig['locations'][number]): AuraLocation {
  return {
    id: location.id,
    // place_id is required internally but optional on the wire; fall back to the
    // location id so pins stay keyable for exports that never had one.
    place_id: location.place_id ?? location.id,
    Name: location.Name,
    Address: orUndefined(location.Address),
    Region: orUndefined(location.Region),
    Coordinates: location.Coordinates
      ? {
          Lat: location.Coordinates.Lat,
          Lng: location.Coordinates.Lng,
          Alt: location.Coordinates.Alt ?? 0,
        }
      : undefined,
    Description: location.Description
      ? {
          Short: orUndefined(location.Description.Short),
          Detailed: orUndefined(location.Description.Detailed),
          Type: orUndefined(location.Description.Type),
        }
      : undefined,
    Attributes: orUndefined(location.Attributes),
    Links: location.Links
      ? {
          SourceLinks: orUndefined(location.Links.SourceLinks),
          Citations: orUndefined(location.Links.Citations),
        }
      : undefined,
    viewPositions: location.viewPositions,
  };
}

export function mapApiConfig(
  apiConfig: ApiProjectConfig,
  fallbackProjectId: string
): ProjectConfig {
  return {
    projectId: apiConfig.projectId ?? fallbackProjectId,
    projectName: apiConfig.projectName ?? fallbackProjectId,
    views: apiConfig.views.map(mapView),
    transitions: apiConfig.transitions.map(mapTransition),
    locations: apiConfig.locations.map(mapLocation),
    metadata: orUndefined(apiConfig.metadata),
  };
}
