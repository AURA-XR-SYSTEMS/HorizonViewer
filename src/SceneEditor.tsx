import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NotAuthorizedError, NotSignedInError, saveConfig } from './lib/exportAdminApi';
import type { ProjectConfig } from './types';

/**
 * Owner-only editing of a published scene.
 *
 * Only rendered when the server said canEdit, but that is presentation: the
 * server decides ownership again on the write and answers 403 if this account
 * does not own the export.
 *
 * Saves the whole config in one PUT rather than per-slice, because renaming the
 * project has no endpoint of its own and two calls could land half-applied.
 * The config sent is the one the server last returned, edited in place — the
 * endpoint replaces rather than merges, so anything dropped here is dropped
 * from the published scene.
 *
 * Portalled to the body for the same reason as the account menu: the header bar
 * is a fixed-height strip with overflow hidden and would crop this to nothing.
 */

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  borderRadius: 14,
  width: 300,
  padding: 14,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid rgba(25,25,25,0.15)',
  background: 'rgba(255,255,255,0.7)',
  color: 'rgba(25,25,25,0.85)',
  fontSize: 13,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgba(25,25,25,0.4)',
  marginBottom: 4,
};

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  );
}

interface SceneEditorProps {
  exportId: string;
  config: ProjectConfig;
  currentViewId: number;
  /** Applies a saved config so the rest of the viewer reflects it immediately. */
  onSaved: (config: ProjectConfig) => void;
}

const SceneEditor: React.FC<SceneEditorProps> = ({
  exportId,
  config,
  currentViewId,
  onSaved,
}) => {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState(config.projectName ?? '');
  const [viewName, setViewName] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });

  const currentView = config.views.find((view) => view.id === currentViewId);

  // Reseed whenever the panel opens or the scene changes underneath it, so the
  // fields never show edits from a previous view or a stale save.
  useEffect(() => {
    if (!open) return;
    setProjectName(config.projectName ?? '');
    setViewName(currentView?.name ?? '');
    setSave({ kind: 'idle' });
  }, [open, config.projectName, currentView?.name]);

  const measure = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const trimmedProject = projectName.trim();
  const trimmedView = viewName.trim();
  const dirty =
    trimmedProject !== (config.projectName ?? '') ||
    (currentView !== undefined && trimmedView !== currentView.name);
  const viewNameEmpty = currentView !== undefined && trimmedView.length === 0;

  const handleSave = async () => {
    if (!dirty || viewNameEmpty) return;

    // Built from the served config so untouched fields survive the replace.
    const next: ProjectConfig = {
      ...config,
      projectName: trimmedProject,
      views: config.views.map((view) =>
        view.id === currentViewId ? { ...view, name: trimmedView } : view
      ),
    };

    setSave({ kind: 'saving' });
    try {
      await saveConfig(exportId, next);
      onSaved(next);
      setSave({ kind: 'saved' });
    } catch (err) {
      const message =
        err instanceof NotSignedInError || err instanceof NotAuthorizedError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not save.';
      setSave({ kind: 'error', message });
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        data-testid="scene-editor-button"
        title="Edit scene"
        aria-label="Edit scene"
        aria-expanded={open}
        className="flex items-center justify-center rounded-lg transition-all hover:bg-black/10"
        style={{ width: 34, height: 34, color: 'rgba(25,25,25,0.55)' }}
      >
        <PencilIcon />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            data-testid="scene-editor-panel"
            style={{
              position: 'fixed',
              top: anchor.top,
              right: anchor.right,
              zIndex: 10001,
              ...panelStyle,
            }}
          >
            <div className="flex flex-col gap-3">
              <div
                style={{ fontSize: 13, fontWeight: 600, color: 'rgba(25,25,25,0.85)' }}
              >
                Edit scene
              </div>

              <div>
                <div style={labelStyle}>Project name</div>
                <input
                  data-testid="scene-editor-project-name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Untitled project"
                  style={inputStyle}
                />
              </div>

              {currentView && (
                <div>
                  <div style={labelStyle}>Current view</div>
                  <input
                    data-testid="scene-editor-view-name"
                    value={viewName}
                    onChange={(event) => setViewName(event.target.value)}
                    style={inputStyle}
                  />
                  {viewNameEmpty && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                      A view needs a name.
                    </div>
                  )}
                </div>
              )}

              {save.kind === 'error' && (
                <div
                  data-testid="scene-editor-error"
                  style={{ fontSize: 11, color: '#dc2626' }}
                  role="alert"
                >
                  {save.message}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!dirty || viewNameEmpty || save.kind === 'saving'}
                  data-testid="scene-editor-save"
                  className="rounded-lg transition-all"
                  style={{
                    flex: 1,
                    height: 32,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'white',
                    background:
                      !dirty || viewNameEmpty || save.kind === 'saving'
                        ? 'rgba(25,25,25,0.35)'
                        : 'rgba(25,25,25,0.85)',
                    cursor: dirty && !viewNameEmpty ? 'pointer' : 'default',
                  }}
                >
                  {save.kind === 'saving' ? 'Saving…' : 'Save changes'}
                </button>
                {save.kind === 'saved' && !dirty && (
                  <span
                    data-testid="scene-editor-saved"
                    style={{ fontSize: 11, color: '#16a34a' }}
                  >
                    Saved
                  </span>
                )}
              </div>

              <div style={{ fontSize: 10, color: 'rgba(25,25,25,0.4)', lineHeight: 1.4 }}>
                Changes are published immediately — everyone opening this link sees them.
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default SceneEditor;
