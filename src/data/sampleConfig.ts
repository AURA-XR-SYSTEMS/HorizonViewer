import type { ProjectConfig } from '../types'

export const sampleConfig: ProjectConfig = {
  views: [
    {
      id: 1,
      name: 'Station Plaza',
      imageUrl: '/assets/view_1.png',
    },
    {
      id: 2,
      name: 'Platform Level',
      imageUrl: '/assets/view_2.png',
    },
    {
      id: 3,
      name: 'Lobby',
      imageUrl: 'https://picsum.photos/id/1018/1920/1080',
    },
    {
      id: 4,
      name: 'Atrium',
      imageUrl: 'https://picsum.photos/id/1015/1920/1080',
    },
    {
      id: 5,
      name: 'Terrace',
      imageUrl: 'https://picsum.photos/id/1016/1920/1080',
    },
  ],
  transitions: [
    {
      key: '1-2',
      from: 1,
      to: 2,
      videoUrl: '/assets/transition_1_2.mp4',
    },
    {
      key: '2-1',
      from: 2,
      to: 1,
      videoUrl: '/assets/transition_2_1.mp4',
    },
  ],
  locations: [
    {
      id: 'loc-1',
      place_id: 'ChIJ1234567890',
      Name: 'Main Control Center',
      Address: '100 Station Plaza, Metro City',
      Region: 'Downtown District',
      Description: {
        Short: 'Central operations hub for the entire transit system.',
        Detailed:
          'The Main Control Center monitors all train movements, manages scheduling, and coordinates emergency responses across the network.',
        Type: 'Operations Facility',
      },
      Attributes: {
        Capacity: '50 operators',
        Hours: '24/7',
        Systems: 'SCADA, ATC, CCTV',
      },
      viewPositions: [
        { viewId: 1, x: 25, y: 40 },
        { viewId: 2, x: 60, y: 35 },
      ],
    },
    {
      id: 'loc-2',
      place_id: 'ChIJ0987654321',
      Name: 'East Ticketing Kiosk',
      Address: 'Platform Level East, Metro City',
      Region: 'Platform Level',
      Description: {
        Short: 'Automated ticket vending and customer service point.',
        Detailed:
          'Self-service kiosks offering ticket purchase, card reload, and trip planning assistance with multilingual support.',
        Type: 'Customer Service',
      },
      Attributes: {
        Machines: '12 units',
        Payment: 'Cash, Card, Mobile',
        Languages: '8 supported',
      },
      viewPositions: [{ viewId: 1, x: 70, y: 55 }],
    },
    {
      id: 'loc-3',
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
      id: 'loc-4',
      Name: 'Overlook',
      Region: 'Central',
      Description: {
        Type: 'Scenic',
        Short: 'Observation point overlooking the water.',
      },
      viewPositions: [{ viewId: 2, x: 55, y: 52 }],
    },
    {
      id: 'loc-5',
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
}
