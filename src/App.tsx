import React, { useState, useEffect, useMemo } from 'react';
import { fetchProjectForSource } from './api/aura';
import { resolveProjectSource } from './lib/projectSource';
import { ExportNotReadyError } from './lib/bootstrapClient';
import { ProjectConfig } from './types';
import AuraViewer from './AuraViewer';
import LandingPage from './LandingPage';

/**
 * Resolves what to show from the URL, then loads it.
 *
 * Shared links (/<exportId>) come from HorizonServer; bundled projects
 * (?key=<slug>, /embed/<slug>) load from disk. See lib/projectSource.
 */
const App: React.FC = () => {
  const source = useMemo(() => resolveProjectSource(window.location), []);

  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(source.kind !== 'none');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (source.kind === 'none') return;

    let cancelled = false;

    (async () => {
      try {
        const projectConfig = await fetchProjectForSource(source);
        if (!cancelled) setConfig(projectConfig);
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
  }, [source]);

  if (source.kind === 'none') {
    return <LandingPage />;
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-white/60 text-sm font-medium">Loading viewer...</span>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
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
  }

  return <AuraViewer config={config} />;
};

export default App;
