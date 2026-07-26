import { getApiBaseUrl } from './bootstrapClient';

/**
 * AURA account session for the viewer.
 *
 * Identity is UserService's, the same account as AURA Engine and GeoCortex.
 * HorizonServer proxies login at /auth/login so the browser calls one origin
 * and UserService does not need to allow another.
 *
 * Reads stay anonymous. A session only matters for editing a scene you own, so
 * nothing here blocks the viewer from loading — every failure degrades to
 * signed-out rather than throwing into the render path.
 */

const TOKEN_STORAGE_KEY = 'aura.horizon.token';

export interface AuraAccount {
  userId: string | null;
  email: string | null;
  name: string | null;
}

/** localStorage throws in private-mode Safari and in sandboxed iframes. */
function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // A session that cannot be persisted still works for this page load.
  }
}

let inMemoryToken: string | null = null;

export function getToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  inMemoryToken = safeGetItem(TOKEN_STORAGE_KEY);
  return inMemoryToken;
}

export function setToken(token: string | null): void {
  inMemoryToken = token;
  safeSetItem(TOKEN_STORAGE_KEY, token);
}

/**
 * Authorization header for the current session, or nothing when signed out.
 *
 * Spread into a fetch init: `headers: { ...authHeaders() }`. Returning an empty
 * object rather than undefined keeps callers from having to branch.
 */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readDetail(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && 'detail' in payload) {
      return String((payload as { detail: unknown }).detail);
    }
  } catch {
    // Non-JSON body; fall through.
  }
  return fallback;
}

export async function signIn(email: string, password: string): Promise<AuraAccount> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error('This viewer is not configured for sign-in.');
  }

  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      await readDetail(
        response,
        response.status === 401 ? 'Incorrect email or password.' : 'Sign-in failed.'
      )
    );
  }

  const payload = await response.json();
  const token = payload?.accessToken;
  if (typeof token !== 'string' || !token) {
    throw new Error('Sign-in succeeded but returned no token.');
  }

  setToken(token);

  const account = await fetchAccount();
  if (!account) {
    // The token was just issued, so this means the session cannot be verified;
    // keeping it would leave the UI claiming a sign-in that does not work.
    setToken(null);
    throw new Error('Signed in, but the session could not be verified.');
  }
  return account;
}

export function signOut(): void {
  setToken(null);
}

/**
 * Who the stored token belongs to, or null if there is none or it is stale.
 *
 * Clears a token the server rejects so a expired session does not persist as a
 * signed-in-looking UI that fails on every write.
 */
export async function fetchAccount(): Promise<AuraAccount | null> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl || !getToken()) return null;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/auth/me`, { headers: authHeaders() });
  } catch {
    // Offline or CORS failure. Keep the token: the session may still be valid.
    return null;
  }

  if (response.status === 401) {
    setToken(null);
    return null;
  }
  if (!response.ok) return null;

  const payload = await response.json();
  if (!payload?.authenticated) return null;

  return {
    userId: payload.userId ?? null,
    email: payload.email ?? null,
    name: payload.name ?? null,
  };
}
