import { useCallback, useEffect, useState } from 'react';
import { fetchAccount, signIn as signInRequest, signOut as clearSession } from './auth';
import type { AuraAccount } from './auth';

export interface Session {
  account: AuraAccount | null;
  /** True until the stored token has been checked, so the UI can avoid flicker. */
  restoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

/**
 * The current AURA session.
 *
 * Rehydrates from a stored token on mount. Signing in or out does not reload
 * the page, but it does change what the server would answer for canEdit, so
 * callers that care re-fetch on `account` changing.
 */
export function useSession(): Session {
  const [account, setAccount] = useState<AuraAccount | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAccount()
      .then((restored) => {
        if (!cancelled) setAccount(restored);
      })
      .catch(() => {
        // Never block the viewer on identity; stay signed out.
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAccount(await signInRequest(email, password));
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setAccount(null);
  }, []);

  return { account, restoring, signIn, signOut };
}
