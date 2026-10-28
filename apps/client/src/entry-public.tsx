// Render the same public content as the browser app. Effects do not run here.
// The build supplies optional public directory data; no sessions or private data.
import type { Reader } from "./types";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { HomePage } from "./pages/home";
import { ReadersPage } from "./pages/readers";
import { AboutPage } from "./pages/about";
import { HelpPage } from "./pages/info";
import { CommunityIntro } from "./components/community-intro";

export function renderPublicPage(slug: string, readers?: Reader[]) {
  const content = slug === "" ? <HomePage initialReaders={readers?.filter((reader) => reader.isOnline)} />
    : slug === "readers" ? <ReadersPage initialReaders={readers} />
    : slug === "about" ? <AboutPage />
    : slug === "help" ? <HelpPage />
    : slug === "community" ? <div className="page-shell"><CommunityIntro /></div>
    : null;
  if (!content) return null;
  return renderToStaticMarkup(
    <StaticRouter location={slug ? `/${slug}/` : "/"}>
      <div className="site-frame">
        <header className="site-header">
          <nav className="primary-nav" aria-label="Primary">
            <a href="/readers/">Readers</a><a href="/community/">Community</a>
          </nav>
          <a className="wordmark" href="/">SoulSeer<span>✦</span></a>
          <nav className="primary-nav nav-right" aria-label="Account and information">
            <a href="/about/">About</a><a href="/help/">Help</a><a className="nav-login" href="/login">Enter</a>
          </nav>
        </header>
        <main id="content">{content}</main>
        <footer className="site-footer">
          <p>Ethical guidance. Heart-centered connection.</p>
          <nav className="footer-links" aria-label="Policies">
            <a href="/privacy/">Privacy</a><a href="/terms/">Terms of Use</a>
            <a href="/acceptable-use/">Acceptable Use</a><a href="/accessibility/">Accessibility</a>
            <a href="/disclaimer/">Disclaimer</a><a href="/eula/">EULA</a>
          </nav>
          <p>For entertainment purposes only.</p>
        </footer>
      </div>
    </StaticRouter>,
  );
}
