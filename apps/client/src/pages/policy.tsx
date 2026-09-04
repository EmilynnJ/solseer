import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PageIntro } from "../components/ui";
import privacy from "../content/policies/privacy.html?raw";
import terms from "../content/policies/terms.html?raw";
import acceptableUse from "../content/policies/acceptable-use.html?raw";
import accessibility from "../content/policies/accessibility.html?raw";
import eula from "../content/policies/eula.html?raw";
import "./policy.css";

const policies = {
  privacy: { title: "Privacy Policy", html: privacy },
  terms: { title: "Terms of Use", html: terms },
  "acceptable-use": { title: "Acceptable Use Policy", html: acceptableUse },
  accessibility: { title: "Accessibility Statement", html: accessibility },
  eula: { title: "End User License Agreement", html: eula },
};

export function PolicyPage({ policy }: { policy: keyof typeof policies }) {
  const { title, html } = policies[policy];
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | SoulSeer`;
    if (window.location.hash) {
      document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    return () => { document.title = previousTitle; };
  }, [title]);

  return (
    <div className="page-shell info-page policy-page">
      <PageIntro eyebrow="SoulSeer policies" title={title} />
      <nav className="policy-navigation" aria-label="Policies">
        {Object.entries(policies).map(([slug, item]) => (
          <Link key={slug} to={`/${slug}`} aria-current={slug === policy ? "page" : undefined}>
            {item.title}
          </Link>
        ))}
      </nav>
      {/* Reviewed, local policy HTML only. Never interpolate user or API content here. */}
      <article className="policy-document" aria-label={title} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
