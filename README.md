# Aura Embed

Embeddable Digital Twin Viewer component. Serves as an iframe-based viewer that can be embedded on any website.

## Setup

```bash
npm install
npm run dev
```

Runs on `http://localhost:3001`

## Usage

### Iframe Embed

```html
<iframe 
  src="https://viewer.aura.io/embed/YOUR_PROJECT_KEY" 
  width="800" 
  height="600" 
  frameborder="0" 
  allowfullscreen>
</iframe>
```

### URL Patterns

- `/embed/:auraKey` — Load project by key in path
- `/?key=:auraKey` — Load project by query parameter
- `/` — Loads demo project (for development)

## Project Structure

```
src/
├── main.tsx          # Entry point
├── App.tsx           # Route handling, API loading
├── AuraViewer.tsx    # Core viewer component
├── types.ts          # TypeScript interfaces
└── api/
    └── aura.ts       # Backend API service
```

## API Integration

The `fetchProject(auraKey)` function in `src/api/aura.ts` currently returns mock data. 

Replace with real API calls:

```typescript
export async function fetchProject(auraKey: string): Promise<ProjectConfig> {
  const response = await fetch(`${API_BASE_URL}/projects/${auraKey}`);
  if (!response.ok) throw new Error('Failed to fetch project');
  return response.json();
}
```

## Building for Production

```bash
npm run build
```

Output goes to `dist/` — deploy this to your CDN/hosting.
