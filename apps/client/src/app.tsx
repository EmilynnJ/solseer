import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react/ui";
import { authClient } from "./lib/auth";
import { SoulAuthProvider, Protected } from "./components/auth-context";
import { Layout } from "./components/layout";
import { Loading } from "./components/ui";
import publicPages from "./content/public-pages.json";

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
const ResetPasswordPage = lazy(() =>
  import("./pages/reset-password").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ReadingPage = lazy(() =>
  import("./pages/reading").then((module) => ({ default: module.ReadingPage })),
);
const MessagesPage = lazy(() =>
  import("./pages/messages").then((module) => ({
    default: module.MessagesPage,
  })),
);
const HelpPage = lazy(() =>
  import("./pages/info").then((module) => ({ default: module.HelpPage })),
);
const PolicyPage = lazy(() =>
  import("./pages/policy").then((module) => ({ default: module.PolicyPage })),
);

function PublicMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    const current = publicPages.find(({ slug }) => (slug ? "/" + slug : "/") === path);
    const page = current ?? publicPages[0]!;
    const base = "https://www.soul-seer.net";
    const canonicalUrl = current ? base + "/" + (current.slug ? current.slug + "/" : "") : null;
    document.title = page.title;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalUrl) {
      if (canonical) canonical.href = canonicalUrl;
      else {
        const link = document.createElement("link");
        link.rel = "canonical";
        link.href = canonicalUrl;
        document.head.appendChild(link);
      }
    } else canonical?.remove();

    for (const [attribute, key, content] of [
      ["name", "description", page.description],
      ["property", "og:url", canonicalUrl],
      ["property", "og:title", page.title],
      ["property", "og:description", page.description],
      ["name", "twitter:title", page.title],
      ["name", "twitter:description", page.description],
    ] as const) {
      let tag = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (content === null) {
        tag?.remove();
      } else {
        if (!tag) {
          tag = document.createElement("meta");
          tag.setAttribute(attribute, key);
          document.head.appendChild(tag);
        }
        tag.content = content;
      }
    }
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      defaultTheme="dark"
      redirectTo="/dashboard"
    >
      <BrowserRouter>
        <PublicMetadata />
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
                <Route path="reset-password" element={<ResetPasswordPage />} />
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
                <Route
                  path="messages"
                  element={
                    <Protected>
                      <MessagesPage />
                    </Protected>
                  }
                />
                <Route path="help" element={<HelpPage />} />
                <Route path="privacy" element={<PolicyPage policy="privacy" />} />
                <Route path="terms" element={<PolicyPage policy="terms" />} />
                <Route path="acceptable-use" element={<PolicyPage policy="acceptable-use" />} />
                <Route path="accessibility" element={<PolicyPage policy="accessibility" />} />
                <Route path="eula" element={<PolicyPage policy="eula" />} />
                <Route path="disclaimer" element={<PolicyPage policy="disclaimer" />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </SoulAuthProvider>
      </BrowserRouter>
    </NeonAuthUIProvider>
  );
}
