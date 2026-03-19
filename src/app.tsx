import AuraViewer from '@components/AuraViewer'
// import { sampleConfig } from '@data/sampleConfig'
import type { ProjectConfig } from './types'
import { useEffect, useState } from 'preact/hooks'
import { fetchProjectConfig } from './lib/api'

export default function App() {
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchProjectConfig()
      .then(setConfig)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading viewer...</div>
  if (error) return <div>Failed to load viewer: {error}</div>
  if (!config) return <div>No config available!</div>
  return <AuraViewer config={config} />
}
