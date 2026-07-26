import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react/ui";
import { authClient } from "./lib/auth";
import { SoulAuthProvider, Protected } from "./components/auth-context";
import { Layout } from "./components/layout";
import { Loading } from "./components/ui";

const HomePage = lazy(() =>
  import("./pages/home").then((module) => ({ default: module.HomePage })),
);
const ReadersPage = lazy(() =>
  import("./pages/readers").then((module) => ({ default: module.ReadersPage })),
);
const ReaderProfilePage = lazy(() =>
  import("./pages/reader-profile").then((module) => ({
    default: module.ReaderProfilePage,
  })),
);
const AboutPage = lazy(() =>
  import("./pages/about").then((module) => ({ default: module.AboutPage })),
);
const CommunityPage = lazy(() =>
  import("./pages/community").then((module) => ({
    default: module.CommunityPage,
  })),
);
const LoginPage = lazy(() =>
  import("./pages/login").then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ReadingPage = lazy(() =>
  import("./pages/reading").then((module) => ({ default: module.ReadingPage })),
);
const HelpPage = lazy(() =>
  import("./pages/info").then((module) => ({ default: module.HelpPage })),
);
const PrivacyPage = lazy(() =>
  import("./pages/info").then((module) => ({ default: module.PrivacyPage })),
);

export function App() {
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      defaultTheme="dark"
      redirectTo="/dashboard"
    >
      <BrowserRouter>
        <SoulAuthProvider>
          <Suspense
            fallback={
              <div className="page-shell">
                <Loading label="Opening SoulSeer…" />
              </div>
            }
          >
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="readers" element={<ReadersPage />} />
                <Route path="readers/:id" element={<ReaderProfilePage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="community" element={<CommunityPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route
                  path="dashboard"
                  element={
                    <Protected>
                      <DashboardPage />
                    </Protected>
                  }
                />
                <Route
                  path="reading/:id"
                  element={
                    <Protected>
                      <ReadingPage />
                    </Protected>
                  }
                />
                <Route path="help" element={<HelpPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </SoulAuthProvider>
      </BrowserRouter>
    </NeonAuthUIProvider>
  );
}
