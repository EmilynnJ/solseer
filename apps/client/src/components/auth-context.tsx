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

  const refresh = useCallback(async () => {
    if (!session.data?.user) {
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
  }, [session.data?.user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const value = useMemo<AuthState>(
    () => ({
      me,
      sessionUser: session.data?.user
        ? {
            id: session.data.user.id,
            email: session.data.user.email,
            name: session.data.user.name,
          }
        : null,
      loading: session.isPending || profileLoading,
      needsProfile,
      profileError,
      refresh,
    }),
    [
      me,
      needsProfile,
      profileError,
      profileLoading,
      refresh,
      session.data?.user,
      session.isPending,
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
