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
import { api } from "../lib/api";
import { authClient } from "../lib/auth";
import { Loading } from "./ui";

type AuthState = {
  me: MeResponse | null;
  sessionUser: { id: string; email: string; name: string } | null;
  loading: boolean;
  needsProfile: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function SoulAuthProvider({ children }: PropsWithChildren) {
  const session = authClient.useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  const refresh = useCallback(async () => {
    if (!session.data?.user) {
      setMe(null);
      setNeedsProfile(false);
      return;
    }
    setProfileLoading(true);
    try {
      setMe(await api<MeResponse>("/auth/me"));
      setNeedsProfile(false);
    } catch (error) {
      const missing =
        error instanceof Error && "status" in error && error.status === 404;
      setNeedsProfile(missing);
      if (!missing) throw error;
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
      refresh,
    }),
    [
      me,
      needsProfile,
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
  if (!auth.me || (roles && !roles.includes(auth.me.user.role)))
    return <Navigate to="/dashboard" replace />;
  return children;
}
