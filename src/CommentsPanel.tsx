import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BottomSheet from './BottomSheet';
import {
  COMMENT_MAX_CHARS,
  COMMENT_NAME_MAX_CHARS,
  contextFromLocation,
  hideComment,
  listComments,
  postComment,
  type TourComment,
} from './lib/commentsApi';
import type { ViewNode } from './types';

/**
 * "Share and listen": residents leave comments on the tour they were sent.
 *
 * One button in the header shows the count; it opens a panel (a bottom sheet
 * on phones, an anchored popover on desktop) with the comments so far and a
 * composer that attaches to the viewpoint on screen. No account is needed to
 * post. The owner, signed in, can hide a comment.
 */

interface CommentsPanelProps {
  exportId: string;
  views: ViewNode[];
  currentViewId: number;
  compact: boolean;
  canEdit: boolean;
  /** Only the trigger button's size differs between layouts. */
  buttonSize: number;
}

const CommentIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  borderRadius: 14,
  width: 340,
  padding: 14,
  color: 'rgba(25,25,25,0.85)',
};

const CommentsPanel: React.FC<CommentsPanelProps> = ({
  exportId,
  views,
  currentViewId,
  compact,
  canEdit,
  buttonSize,
}) => {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<TourComment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });

  const viewName = (id: number) => views.find((v) => v.id === id)?.name ?? `View ${id}`;
  const viewIndex = (id: number) => {
    const i = views.findIndex((v) => v.id === id);
    return i >= 0 ? String(i + 1).padStart(2, '0') : '';
  };

  const load = useCallback(async () => {
    try {
      setComments(await listComments(exportId));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load comments.');
      setComments((prev) => prev ?? []);
    }
  }, [exportId]);

  // The count on the button is worth one request on load; the list refreshes
  // whenever the panel opens.
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const measure = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, []);

  useLayoutEffect(() => {
    if (!open || compact) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, compact, measure]);

  useEffect(() => {
    if (!open || compact) return;
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
  }, [open, compact]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const created = await postComment(exportId, {
        viewId: currentViewId,
        text: trimmed,
        name: name.trim() || undefined,
        context: contextFromLocation(window.location.search),
        website: website || undefined,
      });
      setComments((prev) => [...(prev ?? []), created]);
      setText('');
      setSent(true);
      window.setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send your comment.');
    } finally {
      setSending(false);
    }
  };

  const handleHide = async (comment: TourComment) => {
    try {
      await hideComment(exportId, comment.id);
      setComments((prev) => (prev ?? []).filter((c) => c.id !== comment.id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not hide that comment.');
    }
  };

  const count = comments?.length ?? 0;
  const fontSize = compact ? 16 : 13;
  const controlHeight = compact ? 44 : 34;
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: controlHeight,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid rgba(25,25,25,0.15)',
    background: compact ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
    color: compact ? 'white' : 'rgba(25,25,25,0.85)',
    fontSize,
    outline: 'none',
  };
  const muted = compact ? 'rgba(255,255,255,0.6)' : 'rgba(25,25,25,0.5)';
  const strong = compact ? 'white' : 'rgba(25,25,25,0.85)';

  const body = (
    <div className="flex flex-col gap-3" data-testid="comments-body">
      {loadError && (
        <div role="alert" style={{ fontSize: compact ? 14 : 11, color: '#dc2626' }}>
          {loadError}
        </div>
      )}

      {comments === null ? (
        <div style={{ fontSize, color: muted }}>Loading comments…</div>
      ) : comments.length === 0 ? (
        <div style={{ fontSize, color: muted }} data-testid="comments-empty">
          No comments yet. Yours will be the first.
        </div>
      ) : (
        <ol className="flex flex-col gap-2" data-testid="comments-list">
          {comments.map((comment) => (
            <li
              key={comment.id}
              data-testid="comment-item"
              className="rounded-lg px-3 py-2"
              style={{
                background: compact ? 'rgba(255,255,255,0.08)' : 'rgba(25,25,25,0.05)',
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  style={{ fontSize: compact ? 14 : 12, fontWeight: 600, color: strong }}
                >
                  {comment.name || 'A resident'}
                </span>
                <span style={{ fontSize: compact ? 12 : 10, color: muted }}>
                  {relativeTime(comment.createdAt)}
                </span>
              </div>
              <div style={{ fontSize: compact ? 12 : 10, color: muted }}>
                on {viewIndex(comment.viewId)} {viewName(comment.viewId)}
              </div>
              <p
                style={{
                  fontSize,
                  lineHeight: 1.45,
                  marginTop: 4,
                  color: strong,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {comment.text}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleHide(comment)}
                  data-testid="comment-hide"
                  className="mt-1 rounded"
                  style={{
                    fontSize: compact ? 14 : 11,
                    color: muted,
                    minHeight: compact ? 44 : 24,
                    padding: compact ? '0 8px' : 0,
                  }}
                >
                  Hide
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      <form
        onSubmit={handleSend}
        className="flex flex-col gap-2"
        data-testid="comment-form"
      >
        <div style={{ fontSize: compact ? 13 : 11, color: muted }}>
          Commenting on {viewIndex(currentViewId)} {viewName(currentViewId)}
        </div>
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          maxLength={COMMENT_NAME_MAX_CHARS}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          data-testid="comment-name"
          style={inputStyle}
        />
        <textarea
          placeholder="What do you think about this view?"
          value={text}
          maxLength={COMMENT_MAX_CHARS}
          onChange={(e) => setText(e.target.value)}
          required
          rows={3}
          data-testid="comment-text"
          style={{ ...inputStyle, height: 'auto', padding: 10, resize: 'vertical' }}
        />
        {/* Honeypot: hidden from people, filled by bots. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          style={{ position: 'absolute', left: -10000, width: 1, height: 1, opacity: 0 }}
        />
        {sendError && (
          <div
            role="alert"
            data-testid="comment-error"
            style={{ fontSize: compact ? 14 : 11, color: '#dc2626' }}
          >
            {sendError}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={sending || !text.trim()}
            data-testid="comment-send"
            className="rounded-lg transition-all"
            style={{
              flex: 1,
              height: controlHeight,
              fontSize: compact ? 16 : 12,
              fontWeight: 600,
              color: 'white',
              background:
                sending || !text.trim()
                  ? compact
                    ? 'rgba(255,255,255,0.25)'
                    : 'rgba(25,25,25,0.35)'
                  : compact
                    ? '#0ea5e9'
                    : 'rgba(25,25,25,0.85)',
            }}
          >
            {sending ? 'Sending…' : 'Send comment'}
          </button>
          {sent && (
            <span
              data-testid="comment-sent"
              style={{ fontSize: compact ? 14 : 11, color: '#16a34a' }}
            >
              Sent
            </span>
          )}
        </div>
        <div style={{ fontSize: compact ? 12 : 10, color: muted, lineHeight: 1.4 }}>
          Comments are public to everyone with this link and go to the project team.
        </div>
      </form>
    </div>
  );

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid="comments-button"
        title="Comments"
        aria-label={count ? `Comments, ${count}` : 'Comments'}
        aria-expanded={open}
        className="flex items-center justify-center rounded-lg transition-all hover:bg-black/10"
        style={{
          position: 'relative',
          width: buttonSize,
          height: buttonSize,
          color: 'rgba(25,25,25,0.55)',
        }}
      >
        <CommentIcon />
        {count > 0 && (
          <span
            aria-hidden="true"
            data-testid="comments-count"
            style={{
              position: 'absolute',
              right: 2,
              top: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: '#0ea5e9',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '16px',
              textAlign: 'center',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {compact ? (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={count ? `Comments · ${count}` : 'Comments'}
          testId="comments-sheet"
          maxHeight="85vh"
        >
          {body}
        </BottomSheet>
      ) : (
        open &&
        createPortal(
          <div
            ref={panelRef}
            data-testid="comments-panel"
            role="dialog"
            aria-label="Comments"
            style={{
              position: 'fixed',
              top: anchor.top,
              right: anchor.right,
              zIndex: 10001,
              maxHeight: `calc(100vh - ${anchor.top}px - 16px)`,
              overflowY: 'auto',
              ...panelStyle,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              {count ? `Comments · ${count}` : 'Comments'}
            </div>
            {body}
          </div>,
          document.body
        )
      )}
    </div>
  );
};

export default CommentsPanel;
