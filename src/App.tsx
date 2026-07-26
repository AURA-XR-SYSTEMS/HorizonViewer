import React, { useState, useEffect, useMemo } from 'react';
import { fetchProjectForSource } from './api/aura';
import { resolveProjectSource } from './lib/projectSource';
import { ExportNotReadyError } from './lib/bootstrapClient';
import { useSession } from './lib/useSession';
import { ProjectConfig } from './types';
import AuraViewer from './AuraViewer';
import LandingPage from './LandingPage';
import AdminExportPanel from './AdminExportPanel';

/** Build-time debug surface; never enabled in a client build. */
function isAdminPanelEnabled(): boolean {
  const value = import.meta.env.VITE_HORIZON_ENABLE_ADMIN_PANEL?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * Resolves what to show from the URL, then loads it.
 *
 * Shared links (/<exportId>) come from HorizonServer; bundled projects
 * (?key=<slug>, /embed/<slug>) load from disk. See lib/projectSource.
 */
const App: React.FC = () => {
  const source = useMemo(() => resolveProjectSource(window.location), []);
  const session = useSession();

  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(source.kind !== 'none');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Waiting for `restoring` matters: bootstrap decides canEdit from the token on
  // the request, so loading before the stored session is rehydrated would tell
  // an owner they cannot edit their own scene until they reloaded. Signing in or
  // out re-runs this for the same reason.
  const accountId = session.account?.userId ?? null;
  const sessionSettled = !session.restoring;

  useEffect(() => {
    if (source.kind === 'none' || !sessionSettled) return;

    let cancelled = false;

    (async () => {
      try {
        const project = await fetchProjectForSource(source);
        if (cancelled) return;
        setConfig(project.config);
        setCanEdit(project.canEdit);
        setError(null);
        setPending(false);
      } catch (err) {
        if (cancelled) return;
        // A not-yet-ready export is a normal state during publishing, not a failure.
        if (err instanceof ExportNotReadyError) {
          setPending(true);
          setError('This project is still being prepared. Check back in a moment.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load project');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, sessionSettled, accountId]);

  // Computed rather than returned early so the admin panel can overlay every
  // state, including the landing page and load failures.
  let content: React.ReactNode;

  if (source.kind === 'none') {
    content = <LandingPage />;
  } else if (loading) {
    content = (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-white/60 text-sm font-medium">Loading viewer...</span>
        </div>
      </div>
    );
  } else if (error || !config) {
    content = (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4 text-center px-8">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              pending ? 'bg-cyan-500/20' : 'bg-red-500/20'
            }`}
          >
            <span className={`text-2xl ${pending ? 'text-cyan-300' : 'text-red-400'}`}>
              {pending ? '…' : '!'}
            </span>
          </div>
          <span className="text-white/80 text-lg font-medium">
            {pending ? 'Almost ready' : 'Unable to load viewer'}
          </span>
          <span className="text-white/40 text-sm">{error || 'Project not found'}</span>
        </div>
      </div>
    );
  } else {
    content = (
      <AuraViewer
        config={config}
        session={session}
        canEdit={canEdit}
        currentExportId={source.kind === 'export' ? source.exportId : undefined}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      {content}
      {isAdminPanelEnabled() ? (
        <AdminExportPanel
          defaultWorkspaceId={import.meta.env.VITE_HORIZON_ADMIN_DEFAULT_WORKSPACE_ID ?? ''}
        />
      ) : null}
    </div>
  );
};

export default App;
