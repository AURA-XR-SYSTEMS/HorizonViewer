import React, { useEffect, useRef, useState } from 'react';
import { deleteExport, listMyExports } from './lib/exportAdminApi';
import type { OwnedExportSummary } from './lib/apiSchemas';
import type { Session } from './lib/useSession';

/**
 * The account control in the viewer header.
 *
 * Replaces a decorative placeholder button. Signed out it offers sign-in;
 * signed in it shows who you are, the scenes you own, and sign-out.
 *
 * Editing rights are not decided here — the server answers canEdit per export
 * and re-checks on every write. This only decides what is offered.
 */

const glassStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.25)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  transform: 'translateZ(0)',
};

const panelStyle: React.CSSProperties = {
  ...glassStyle,
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  borderRadius: 14,
  width: 280,
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

function AccountIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

interface AccountMenuProps {
  session: Session;
  /** Highlighted in the list so the open scene is identifiable. */
  currentExportId?: string;
}

const AccountMenu: React.FC<AccountMenuProps> = ({ session, currentExportId }) => {
  const { account, restoring, signIn, signOut } = session;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exports, setExports] = useState<OwnedExportSummary[] | null>(null);
  // Deleting is irreversible, so a row must be armed before it will go.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss on an outside click, matching the other header popovers.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
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

  // Load the account's scenes when the menu opens, and drop them on sign-out so
  // a second account never briefly sees the previous one's list.
  useEffect(() => {
    if (!open || !account) {
      if (!account) setExports(null);
      return;
    }

    let cancelled = false;
    listMyExports()
      .then((rows) => {
        if (!cancelled) setExports(rows);
      })
      .catch(() => {
        if (!cancelled) setExports([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, account]);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    setExports(null);
    setConfirmingDelete(null);
    setOpen(false);
  };

  const handleDelete = async (exportId: string) => {
    setDeleting(exportId);
    setError(null);
    try {
      await deleteExport(exportId);
      setExports((rows) => (rows ?? []).filter((row) => row.exportId !== exportId));
      setConfirmingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that scene.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title={account ? (account.email ?? 'Account') : 'Sign in'}
        aria-label={account ? 'Account' : 'Sign in'}
        aria-expanded={open}
        className="flex items-center justify-center rounded-lg transition-all hover:bg-black/10"
        style={{
          position: 'relative',
          width: 34,
          height: 34,
          color: account ? 'rgba(25,25,25,0.85)' : 'rgba(25,25,25,0.55)',
        }}
      >
        <AccountIcon />
        {account && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: 4,
              bottom: 4,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#22c55e',
              border: '1.5px solid rgba(255,255,255,0.9)',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 42,
            right: 0,
            zIndex: 10001,
            ...panelStyle,
          }}
        >
          {restoring ? (
            <div style={{ fontSize: 13, color: 'rgba(25,25,25,0.5)' }}>
              Checking session…
            </div>
          ) : account ? (
            <div className="flex flex-col gap-3">
              <div>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: 'rgba(25,25,25,0.85)' }}
                >
                  {account.name || account.email}
                </div>
                {account.name && account.email && (
                  <div style={{ fontSize: 11, color: 'rgba(25,25,25,0.5)' }}>
                    {account.email}
                  </div>
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(25,25,25,0.4)',
                    marginBottom: 6,
                  }}
                >
                  My scenes
                </div>

                {exports === null ? (
                  <div style={{ fontSize: 12, color: 'rgba(25,25,25,0.45)' }}>
                    Loading…
                  </div>
                ) : exports.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'rgba(25,25,25,0.45)' }}>
                    No scenes published from this account yet.
                  </div>
                ) : (
                  <div
                    className="flex flex-col gap-0.5"
                    style={{ maxHeight: 190, overflowY: 'auto' }}
                  >
                    {exports.map((row) => {
                      const isCurrent = row.exportId === currentExportId;
                      const isConfirming = confirmingDelete === row.exportId;
                      const isDeleting = deleting === row.exportId;

                      if (isConfirming) {
                        return (
                          <div
                            key={row.exportId}
                            className="rounded-md"
                            style={{
                              padding: '6px 7px',
                              background: 'rgba(220,38,38,0.08)',
                            }}
                          >
                            <div style={{ fontSize: 11, color: 'rgba(25,25,25,0.7)' }}>
                              Delete permanently? Any shared link stops working.
                            </div>
                            <div className="flex gap-1" style={{ marginTop: 6 }}>
                              <button
                                onClick={() => handleDelete(row.exportId)}
                                disabled={isDeleting}
                                className="rounded-md"
                                style={{
                                  flex: 1,
                                  height: 26,
                                  fontSize: 11,
                                  color: 'white',
                                  background: isDeleting
                                    ? 'rgba(220,38,38,0.5)'
                                    : '#dc2626',
                                }}
                              >
                                {isDeleting ? 'Deleting…' : 'Delete'}
                              </button>
                              <button
                                onClick={() => setConfirmingDelete(null)}
                                disabled={isDeleting}
                                className="rounded-md hover:bg-black/10"
                                style={{
                                  flex: 1,
                                  height: 26,
                                  fontSize: 11,
                                  color: 'rgba(25,25,25,0.7)',
                                  border: '1px solid rgba(25,25,25,0.15)',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={row.exportId}
                          className="group flex items-center rounded-md hover:bg-black/5"
                          style={{
                            padding: '5px 7px',
                            gap: 6,
                            background: isCurrent ? 'rgba(0,0,0,0.05)' : 'transparent',
                          }}
                        >
                          <a
                            href={`/${row.exportId}`}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 12,
                              color: 'rgba(25,25,25,0.8)',
                              textDecoration: 'none',
                            }}
                          >
                            <span
                              style={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.projectName || row.exportId}
                            </span>
                            {row.status !== 'ready' && (
                              <span
                                style={{ fontSize: 10, color: 'rgba(25,25,25,0.45)' }}
                              >
                                {row.status}
                              </span>
                            )}
                          </a>
                          <button
                            onClick={() => setConfirmingDelete(row.exportId)}
                            title="Delete scene"
                            aria-label={`Delete ${row.projectName || row.exportId}`}
                            className="rounded opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                            style={{
                              flexShrink: 0,
                              width: 22,
                              height: 22,
                              color: 'rgba(25,25,25,0.45)',
                            }}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ margin: '0 auto' }}
                            >
                              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && (
                <div style={{ fontSize: 11, color: '#dc2626' }} role="alert">
                  {error}
                </div>
              )}

              <button
                onClick={handleSignOut}
                className="rounded-lg transition-all hover:bg-black/10"
                style={{
                  height: 32,
                  fontSize: 12,
                  color: 'rgba(25,25,25,0.7)',
                  border: '1px solid rgba(25,25,25,0.15)',
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="flex flex-col gap-2">
              <div
                style={{ fontSize: 13, fontWeight: 600, color: 'rgba(25,25,25,0.85)' }}
              >
                Sign in to AURA
              </div>
              <div style={{ fontSize: 11, color: 'rgba(25,25,25,0.5)', marginBottom: 2 }}>
                Needed only to edit scenes you own.
              </div>
              <input
                type="email"
                autoComplete="username"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              {error && (
                <div style={{ fontSize: 11, color: '#dc2626' }} role="alert">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg transition-all"
                style={{
                  height: 32,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'white',
                  background: busy ? 'rgba(25,25,25,0.4)' : 'rgba(25,25,25,0.85)',
                  cursor: busy ? 'default' : 'pointer',
                }}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
