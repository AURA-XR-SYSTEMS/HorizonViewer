import { getApiBaseUrl } from './bootstrapClient';
import { authHeaders } from './auth';

/**
 * Resident comments on a shared tour.
 *
 * Posting needs no account: the link is the credential. The server bounds the
 * text, rate-limits by connection, drops anything that fills the honeypot
 * field, and forwards the comment into the consultation's contribution record
 * (A5); the receipt it returns is the resident's. No name is asked for or sent.
 * Reading is public, like the tour. Hiding is the owner's.
 *
 * Contract: HorizonServer `app/comments.py` (J-HZN_resident_comments_CONTRACT).
 */

export interface CommentPosition {
  x: number;
  y: number;
}

export interface TourComment {
  id: string;
  viewId: number;
  text: string;
  position: CommentPosition | null;
  createdAt: string;
  /** A5's receipt (C-XXXX-XXXX) once the comment reached the consultation record. */
  receipt: string | null;
}

/** The consultation id the share link carried (`?consultation=` or `?c=`). */
export function consultationFromLocation(search: string): string | undefined {
  const params = new URLSearchParams(search);
  for (const key of ['consultation', 'c']) {
    const value = params.get(key)?.trim();
    if (value && /^[A-Za-z0-9:_.-]{1,128}$/.test(value)) return value;
  }
  return undefined;
}

export interface NewComment {
  viewId: number;
  text: string;
  position?: CommentPosition;
  consultation?: string;
  /** Honeypot. A real form leaves it empty. */
  website?: string;
}

export const COMMENT_MAX_CHARS = 1000;

function requireApiBaseUrl(): string {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error('This viewer is not configured to reach HorizonServer.');
  }
  return apiBaseUrl;
}

async function readDetail(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && 'detail' in payload) {
      const detail = (payload as { detail: unknown }).detail;
      // 422 bodies carry a list of field errors; the first message is enough.
      if (Array.isArray(detail) && detail[0] && typeof detail[0].msg === 'string') {
        return detail[0].msg.replace(/^Value error, /, '');
      }
      return String(detail);
    }
  } catch {
    // Non-JSON body; fall through.
  }
  return fallback;
}

export async function listComments(exportId: string): Promise<TourComment[]> {
  const response = await fetch(
    `${requireApiBaseUrl()}/api/viewer/${encodeURIComponent(exportId)}/comments`
  );
  if (!response.ok) {
    throw new Error(await readDetail(response, 'Could not load comments.'));
  }
  const payload = (await response.json()) as { items?: TourComment[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function postComment(
  exportId: string,
  comment: NewComment
): Promise<TourComment> {
  const response = await fetch(
    `${requireApiBaseUrl()}/api/viewer/${encodeURIComponent(exportId)}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    }
  );
  if (response.status === 429) {
    throw new Error('Too many comments from this connection. Try again in a while.');
  }
  if (!response.ok) {
    throw new Error(await readDetail(response, 'Could not send your comment.'));
  }
  return (await response.json()) as TourComment;
}

/** Owner only; the server answers 403 for anyone else. */
export async function hideComment(exportId: string, commentId: string): Promise<void> {
  const response = await fetch(
    `${requireApiBaseUrl()}/exports/${encodeURIComponent(exportId)}/comments/${encodeURIComponent(commentId)}/hide`,
    { method: 'POST', headers: { ...authHeaders() } }
  );
  if (!response.ok) {
    throw new Error(await readDetail(response, 'Could not hide that comment.'));
  }
}
