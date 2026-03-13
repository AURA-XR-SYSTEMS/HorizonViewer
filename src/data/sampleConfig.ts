import type { ProjectConfig } from '../types';

export const sampleConfig: ProjectConfig = {
  views: [
    {
      id: 1,
      name: 'Lobby',
      imageUrl: 'https://picsum.photos/id/1018/1920/1080',
    },
    {
      id: 2,
      name: 'Atrium',
      imageUrl: 'https://picsum.photos/id/1015/1920/1080',
    },
    {
      id: 3,
      name: 'Terrace',
      imageUrl: 'https://picsum.photos/id/1016/1920/1080',
    },
  ],
  transitions: [],
  locations: [
    {
      id: 'loc-1',
      Name: 'Reception',
      Address: '100 Main St',
      Region: 'West Wing',
      Description: {
        Type: 'Entry',
        Short: 'Main reception area with visitor check-in.',
      },
      Attributes: {
        Capacity: '12',
        Status: 'Open',
      },
      viewPositions: [{ viewId: 1, x: 42, y: 58 }],
    },
    {
      id: 'loc-2',
      Name: 'Sky Terrace',
      Region: 'Upper Deck',
      Description: {
        Type: 'Outdoor',
        Short: 'Open terrace with city view.',
      },
      Attributes: {
        Seating: '24',
      },
      viewPositions: [{ viewId: 3, x: 68, y: 44 }],
    },
  ],
};