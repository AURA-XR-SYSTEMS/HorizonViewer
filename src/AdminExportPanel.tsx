import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createExportJob,
  fetchExportJob,
  uploadExportZip,
  type DebugRequest,
  type DebugResponse,
  type UnrealUploadMetadataPayload,
} from './lib/exportJobApi';
import type { ExportJobResponse } from './lib/exportJobSchemas';

/**
 * Build-time debug panel for the export-job flow.
 *
 * Ported from the Preact viewer. Enabled with VITE_HORIZON_ENABLE_ADMIN_PANEL;
 * it is a developer tool for exercising create -> upload -> poll against a
 * backend, not a client-facing surface.
 *
 * Create and upload now require an AURA account. This panel has no sign-in of
 * its own — it reuses whatever session the Account menu holds, so sign in there
 * first or every call comes back 401. Account-facing export management lives in
 * that menu, not here.
 */

const AUTO_POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(['ready', 'failed']);

interface AdminExportPanelProps {
  defaultWorkspaceId?: string;
}

function prettyPrint(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildDemoUploadMetadata(): UnrealUploadMetadataPayload {
  return {
    projectName: 'Admin Debug Export',
    sourceApplication: 'HorizonViewer Admin Panel',
    sourceVersion: 'debug',
    views: [
      { id: 'station-plaza', name: 'Station Plaza', filename: 'assets/view_1.png' },
      { id: 'platform-level', name: 'Platform Level', filename: 'assets/view_2.png' },
    ],
    transitions: [
      {
        from: 'station-plaza',
        to: 'platform-level',
        filename: 'assets/transition_1_2.mp4',
      },
      {
        from: 'platform-level',
        to: 'station-plaza',
        filename: 'assets/transition_2_1.mp4',
      },
    ],
    locations: [
      {
        id: 'loc-1',
        name: 'Main Control Center',
        viewPositions: [
          { viewId: 'station-plaza', x: 25, y: 40 },
          { viewId: 'platform-level', x: 60, y: 35 },
        ],
      },
    ],
  };
}

export default function AdminExportPanel({
  defaultWorkspaceId = '',
}: AdminExportPanelProps) {
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [job, setJob] = useState<ExportJobResponse | null>(null);
  const [autoPoll, setAutoPoll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastRequest, setLastRequest] = useState<DebugRequest | null>(null);
  const [lastResponse, setLastResponse] = useState<DebugResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const canCreate = workspaceId.trim().length > 0 && !isSubmitting;
  const canUpload =
    Boolean(job?.exportId && workspaceId.trim() && selectedFile) && !isSubmitting;
  const canPoll = Boolean(job?.exportId && workspaceId.trim()) && !isSubmitting;

  const bootstrapStatus = useMemo(() => {
    if (job?.status !== 'ready') return null;
    if (job.viewerUrl) {
      return `Viewer bootstrap is live. Open ${job.viewerUrl} to load this export in HorizonViewer.`;
    }
    return 'Job is ready. Open HorizonViewer with /<exportId> to load /api/viewer/bootstrap.';
  }, [job]);

  async function runRequest(action: () => Promise<void>) {
    setIsSubmitting(true);
    setLastError(null);
    try {
      await action();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateExportJob() {
    await runRequest(async () => {
      const result = await createExportJob(workspaceId.trim());
      setJob(result.job);
      setLastRequest(result.debugRequest);
      setLastResponse(result.debugResponse);
    });
  }

  async function handleUploadExport() {
    if (!job?.exportId || !selectedFile) return;
    await runRequest(async () => {
      const result = await uploadExportZip(
        workspaceId.trim(),
        job.exportId,
        selectedFile,
        buildDemoUploadMetadata()
      );
      setJob(result.job);
      setLastRequest(result.debugRequest);
      setLastResponse(result.debugResponse);
    });
  }

  async function handlePollStatus() {
    if (!job?.exportId) return;
    await runRequest(async () => {
      const result = await fetchExportJob(workspaceId.trim(), job.exportId);
      setJob(result.job);
      setLastRequest(result.debugRequest);
      setLastResponse(result.debugResponse);
    });
  }

  // The interval must call the newest handler without being torn down and
  // rebuilt on every render, which would reset the timer and mean it never
  // fires while anything else is updating state.
  const pollRef = useRef(handlePollStatus);
  pollRef.current = handlePollStatus;

  const exportId = job?.exportId;
  const status = job?.status;

  useEffect(() => {
    if (!autoPoll || !exportId || (status && TERMINAL_STATUSES.has(status))) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void pollRef.current();
    }, AUTO_POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [autoPoll, exportId, status]);

  return (
    <aside
      data-testid="admin-panel"
      className="absolute right-4 top-4 z-[70] flex max-h-[calc(100%-2rem)] w-[min(440px,calc(100%-2rem))] flex-col overflow-hidden rounded-2xl border border-white/25 bg-black/80 text-left text-white shadow-2xl backdrop-blur-xl"
    >
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">
              Admin Debug
            </p>
            <h2 className="mt-1 text-lg font-semibold">Export Job Workflow</h2>
          </div>
          <span className="rounded-full border border-sky-400/35 bg-sky-500/15 px-2 py-1 text-[11px] font-medium text-sky-100">
            Build-Time Enabled
          </span>
        </div>
        <p className="mt-2 text-sm leading-5 text-white/70">
          Mimics the Unreal export flow against the backend export-job endpoints.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section className="space-y-3">
          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            Workspace ID
          </label>
          <input
            data-testid="workspace-input"
            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/60 focus:bg-white/15"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            placeholder="workspace-123"
          />
          <button
            data-testid="create-job-button"
            className="w-full rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
            onClick={() => void handleCreateExportJob()}
            disabled={!canCreate}
          >
            {isSubmitting ? 'Working...' : 'Create Export Job'}
          </button>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Current Job</h3>
            <span
              data-testid="job-status"
              className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-white/70"
            >
              {job?.status ?? 'none'}
            </span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm text-white/75">
            <dt className="text-white/50">Export ID</dt>
            <dd data-testid="job-export-id" className="break-all font-mono text-[12px]">
              {job?.exportId ?? 'Not created yet'}
            </dd>
            <dt className="text-white/50">Workspace</dt>
            <dd>{job?.workspaceId ?? (workspaceId || 'Unset')}</dd>
            <dt className="text-white/50">Viewer URL</dt>
            <dd className="break-all">{job?.viewerUrl ?? 'null'}</dd>
            <dt className="text-white/50">Error</dt>
            <dd data-testid="job-error-message" className="break-words text-rose-200">
              {job?.errorMessage ?? 'none'}
            </dd>
            <dt className="text-white/50">Warning</dt>
            <dd data-testid="job-warning-message" className="break-words text-amber-200">
              {job?.warningMessage ?? 'none'}
            </dd>
          </dl>
          {bootstrapStatus ? (
            <p
              data-testid="bootstrap-status"
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-100"
            >
              {bootstrapStatus}
            </p>
          ) : null}
        </section>

        <section className="space-y-3">
          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            Export Zip
          </label>
          <input
            data-testid="upload-file-input"
            className="block w-full text-sm text-white/75 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-white/55">
            Uploads send <code>multipart/form-data</code> with the zip <code>file</code>{' '}
            and a debug <code>metadata</code> payload matching the Unreal export shape.
          </p>
          <button
            data-testid="upload-button"
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/35"
            onClick={() => void handleUploadExport()}
            disabled={!canUpload}
          >
            {isSubmitting ? 'Working...' : 'Upload Zip'}
          </button>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Polling</h3>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                data-testid="auto-poll-checkbox"
                type="checkbox"
                checked={autoPoll}
                onChange={(event) => setAutoPoll(event.target.checked)}
              />
              Auto-poll
            </label>
          </div>
          <button
            data-testid="poll-button"
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/35"
            onClick={() => void handlePollStatus()}
            disabled={!canPoll}
          >
            {isSubmitting ? 'Working...' : 'Poll Status'}
          </button>
        </section>

        <section
          data-testid="last-request-panel"
          className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3"
        >
          <h3 className="text-sm font-semibold text-white">Last Request</h3>
          <div className="space-y-2 text-sm text-white/75">
            <p>
              <span className="text-white/45">Method:</span>{' '}
              {lastRequest?.method ?? 'n/a'}
            </p>
            <p className="break-all">
              <span className="text-white/45">URL:</span> {lastRequest?.url ?? 'n/a'}
            </p>
            <p className="break-words">
              <span className="text-white/45">Summary:</span>{' '}
              {lastRequest?.summary ?? 'n/a'}
            </p>
          </div>
        </section>

        <section
          data-testid="last-response-panel"
          className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3"
        >
          <h3 className="text-sm font-semibold text-white">Last Response</h3>
          <p className="text-sm text-white/70">
            HTTP status:{' '}
            <span className="font-medium text-white">
              {lastResponse?.status ?? 'n/a'}
            </span>
          </p>
          <pre
            data-testid="last-response-payload"
            className="max-h-56 overflow-auto rounded-xl bg-black/45 p-3 text-xs leading-5 text-white/80"
          >
            {prettyPrint(lastResponse?.payload ?? null)}
          </pre>
        </section>

        {lastError ? (
          <section
            data-testid="last-error-panel"
            className="rounded-2xl border border-rose-400/30 bg-rose-500/15 p-3 text-sm text-rose-100"
          >
            <h3 className="text-sm font-semibold">Last Error</h3>
            <p className="mt-2 break-words">{lastError}</p>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
