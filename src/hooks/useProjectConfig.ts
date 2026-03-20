import type { ProjectConfig } from '@/types'
import { useEffect, useState } from 'preact/hooks'
import { loadProjectConfig } from '@/lib/projectConfig'

interface UseProjectConfigResult {
  config: ProjectConfig | null
  loading: boolean
  error: string | null
}

export function useProjectConfig(): UseProjectConfigResult {
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const nextConfig = await loadProjectConfig()
        if (!cancelled) {
          setConfig(nextConfig)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  return { config, loading, error }
}
