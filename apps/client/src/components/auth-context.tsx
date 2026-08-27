import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { MeResponse } from "../types";
import { api, isProfileRequiredError } from "../lib/api";
import { authClient } from "../lib/auth";
import { posthog } from "../lib/posthog";
import { Loading } from "./ui";

type AuthState = {
  me: MeResponse | null;
  sessionUser: { id: string; email: string; name: string } | null;
  loading: boolean;
  needsProfile: boolean;
  profileError: string | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function SoulAuthProvider({ children }: PropsWithChildren) {
  const session = authClient.useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Extract primitive user identity properties to prevent unstable session object
  // references from invalidating useCallback/useMemo hooks across parent re-renders.
  const sessionUserId = session.data?.user?.id;
  const sessionUserEmail = session.data?.user?.email;
  const sessionUserName = session.data?.user?.name;

  const refresh = useCallback(async () => {
    if (!sessionUserId) {
      setMe(null);
      setNeedsProfile(false);
      setProfileError(null);
      return;
    }
    setProfileLoading(true);
    try {
      setMe(await api<MeResponse>("/auth/me"));
      setNeedsProfile(false);
      setProfileError(null);
    } catch (error) {
      setMe(null);
      const missing = isProfileRequiredError(error);
      setNeedsProfile(missing);
      setProfileError(
        missing
          ? null
          : error instanceof Error
            ? error.message
            : "We couldn't open your SoulSeer profile.",
      );
    } finally {
      setProfileLoading(false);
    }
  }, [sessionUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (session.isPending) return;

    if (!sessionUserId) {
      posthog.reset();
      return;
    }

    posthog.identify(sessionUserId, {
      email: sessionUserEmail,
      name: sessionUserName,
    });
  }, [session.isPending, sessionUserId, sessionUserEmail, sessionUserName]);

  // Memoize sessionUser using stable primitive fields to ensure object identity
  // stability across re-renders when user details have not changed.
  const sessionUser = useMemo(
    () =>
      sessionUserId
        ? {
            id: sessionUserId,
            email: sessionUserEmail ?? "",
            name: sessionUserName ?? "",
          }
        : null,
    [sessionUserId, sessionUserEmail, sessionUserName],
  );

  const value = useMemo<AuthState>(
    () => ({
      me,
      sessionUser,
      loading: session.isPending || profileLoading,
      needsProfile,
      profileError,
      refresh,
    }),
    [
      me,
      sessionUser,
      session.isPending,
      profileLoading,
      needsProfile,
      profileError,
      refresh,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSoulAuth() {
  const value = useContext(AuthContext);
  if (!value)
    throw new Error("useSoulAuth must be used within SoulAuthProvider.");
  return value;
}

export function Protected({
  children,
  roles,
}: PropsWithChildren<{ roles?: string[] }>) {
  const auth = useSoulAuth();
  const location = useLocation();
  if (auth.loading)
    return (
      <main className="page-shell">
        <Loading label="Opening your space…" />
      </main>
    );
  if (!auth.sessionUser)
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  if (auth.needsProfile) return <Navigate to="/login?complete=1" replace />;
  if (!auth.me)
    return (
      <main className="page-shell">
        <section className="profile-load-error" role="alert">
          <p className="eyebrow">Your sanctuary is still here</p>
          <h1>We couldn't open your dashboard.</h1>
          <p>
            {auth.profileError ??
              "Your profile could not be loaded. Please try again."}
          </p>
          <button className="button" onClick={() => void auth.refresh()}>
            Try again
          </button>
        </section>
      </main>
    );
  if (roles && !roles.includes(auth.me.user.role))
    return <Navigate to="/dashboard" replace />;
  return children;
}
