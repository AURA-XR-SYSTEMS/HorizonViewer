import React, { useState, useEffect } from 'react';
import { fetchProject } from './api/aura';
import { ProjectConfig } from './types';
import AuraViewer from './AuraViewer';

/**
 * Main App component that handles:
 * 1. Parsing the auraKey from the URL
 * 2. Fetching project config from the API
 * 3. Rendering the viewer or error/loading states
 */
const App: React.FC = () => {
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        // Parse auraKey from URL: /embed/:auraKey or ?key=:auraKey
        const pathMatch = window.location.pathname.match(/\/embed\/([^/]+)/);
        const urlParams = new URLSearchParams(window.location.search);
        const auraKey = pathMatch?.[1] || urlParams.get('key') || 'demo';

        if (!auraKey) {
          setError('No Aura key provided');
          setLoading(false);
          return;
        }

        const projectConfig = await fetchProject(auraKey);
        setConfig(projectConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, []);

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
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-red-400 text-2xl">!</span>
          </div>
          <span className="text-white/80 text-lg font-medium">Unable to load viewer</span>
          <span className="text-white/40 text-sm">{error || 'Project not found'}</span>
        </div>
      </div>
    );
  }

  return <AuraViewer config={config} />;
};

export default App;
