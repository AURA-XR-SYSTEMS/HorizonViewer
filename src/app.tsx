import AuraViewer from '@components/AuraViewer'
import { useProjectConfig } from '@hooks/useProjectConfig'

export default function App() {
  const { config, loading, error } = useProjectConfig()

  if (loading) return <div>Loading viewer...</div>
  if (error) return <div>Failed to load viewer: {error}</div>
  if (!config) return <div>No config available!</div>

  return <AuraViewer config={config} />
}
