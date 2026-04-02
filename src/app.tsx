import AuraViewer from '@components/AuraViewer'
import ComingSoonLanding from '@components/ComingSoonLanding'
import AdminExportPanel from '@components/AdminExportPanel'
import { useProjectConfig } from '@hooks/useProjectConfig'

function isAdminPanelEnabled(): boolean {
  const value = import.meta.env.VITE_HORIZON_ENABLE_ADMIN_PANEL?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

function hasViewerExportIdInUrl(): boolean {
  const params = new URLSearchParams(window.location.search)
  return Boolean(params.get('exportId')?.trim())
}

function ViewerSurface() {
  const { config, loading, error } = useProjectConfig()

  if (loading) {
    return <div className="viewer-shell-message">Loading viewer...</div>
  }

  if (error) {
    return (
      <div className="viewer-shell-message viewer-shell-error">
        Failed to load viewer: {error}
      </div>
    )
  }

  if (!config) {
    return <div className="viewer-shell-message">No config available!</div>
  }

  return <AuraViewer config={config} />
}

export default function App() {
  const adminPanelEnabled = isAdminPanelEnabled()
  const shouldRenderViewer = hasViewerExportIdInUrl()
  const defaultWorkspaceId = import.meta.env.VITE_HORIZON_ADMIN_DEFAULT_WORKSPACE_ID ?? ''

  return (
    <div className="relative h-full w-full">
      {shouldRenderViewer ? <ViewerSurface /> : <ComingSoonLanding />}
      {adminPanelEnabled ? (
        <AdminExportPanel defaultWorkspaceId={defaultWorkspaceId} />
      ) : null}
    </div>
  )
}
