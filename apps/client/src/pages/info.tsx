import { ChevronDown, Mail, ShieldCheck } from "lucide-react";
import { PageIntro } from "../components/ui";

const faqs = [
  [
    "How does a live reading work?",
    "Choose an available verified Reader, select chat, voice, or video, and send a request. Once your Reader accepts, your private RealtimeKit room opens. You’re charged from your prepaid balance at the displayed per-minute rate.",
  ],
  [
    "When does billing begin and end?",
    "Billing begins only after both assigned participants are verified present. Charges are controlled by the server in completed one-minute increments—not by the timer on your screen. Ending the session stops future billing and produces a final summary.",
  ],
  [
    "What happens if my connection drops?",
    "SoulSeer shows a reconnecting state and allows up to two minutes to return. New billing pauses after the currently earned minute boundary. If the grace period expires, the session ends safely.",
  ],
  [
    "Can I get a refund?",
    "Contact support with the reading date and reason. Refunds are reviewed individually by an Admin and recorded in the platform’s immutable financial ledger.",
  ],
  [
    "Are readings confidential?",
    "Reading access is limited to the assigned Client and Reader. Participant identity uses internal IDs, not email addresses. Transcript retention follows the policy below.",
  ],
  [
    "What should I use SoulSeer for?",
    "Readings can offer reflection and personal insight. They are not a substitute for medical, legal, financial, mental-health, or emergency services.",
  ],
];

export function HelpPage() {
  return (
    <div className="page-shell info-page">
      <PageIntro
        eyebrow="We’re here for you"
        title="Help & frequently asked questions"
      >
        <p>Clear answers before, during, and after your reading.</p>
      </PageIntro>
      <section className="faq-list">
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <ChevronDown />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <section className="support-callout">
        <Mail />
        <div>
          <h2>Still need a human?</h2>
          <p>
            Email{" "}
            <a
              href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || "support@soulseer.com"}`}
            >
              {import.meta.env.VITE_SUPPORT_EMAIL || "support@soulseer.com"}
            </a>
            . Include your reading ID if your question is session-specific.
          </p>
        </div>
      </section>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="page-shell info-page">
      <PageIntro eyebrow="Your trust matters" title="Privacy Policy">
        <p>Effective July 25, 2026</p>
      </PageIntro>
      <section className="legal-copy">
        <div className="privacy-lead">
          <ShieldCheck />
          <p>
            SoulSeer collects only the information needed to provide accounts,
            readings, payments, community participation, safety, and support.
          </p>
        </div>
        <h2>Information we collect</h2>
        <p>
          Neon Auth manages identity information and credentials. SoulSeer
          stores your app profile, account role, wallet and immutable
          transaction records, reading metadata, reviews, forum contributions,
          moderation reports, and support records. Stripe processes payment
          details; SoulSeer never receives raw card data. Cloudflare RealtimeKit
          processes live session media and chat.
        </p>
        <h2>How we use information</h2>
        <p>
          We use information to authenticate you, enforce permissions, connect
          assigned reading participants, calculate server-authoritative charges,
          prevent fraud, fulfill refunds and Reader payouts, moderate the
          community, respond to support requests, and meet legal obligations.
        </p>
        <h2>Reading privacy and retention</h2>
        <p>
          Only assigned participants and authorized platform administrators may
          access a reading’s protected operational records. Audio and video are
          not recorded by SoulSeer for launch. Chat transcripts may be retained
          for 90 days for participant access, safety review, disputes, and
          refund reconciliation, then deleted unless preservation is legally
          required. Financial ledger records are retained as required for
          accounting and compliance.
        </p>
        <h2>Vendors and international processing</h2>
        <p>
          We use Neon for database and authentication, Cloudflare for APIs,
          storage, and realtime sessions, Stripe for payments, and Vercel for
          frontend hosting. These processors may handle data in locations
          described by their own privacy terms and contractual safeguards.
        </p>
        <h2>Your choices and rights</h2>
        <p>
          You may request access, correction, export, or deletion of eligible
          personal information by emailing{" "}
          <a
            href={`mailto:${import.meta.env.VITE_PRIVACY_EMAIL || "privacy@soulseer.com"}`}
          >
            {import.meta.env.VITE_PRIVACY_EMAIL || "privacy@soulseer.com"}
          </a>
          . Some financial, fraud-prevention, and legal records cannot be
          immediately deleted. You may unsubscribe from newsletter messages at
          any time.
        </p>
        <h2>Security and children</h2>
        <p>
          We apply role checks, row-level data policies, signed provider
          webhooks, encryption in transit, private object access, and audit
          logs. No system is perfectly secure. SoulSeer is intended for adults
          aged 18 and older and is not directed to children.
        </p>
        <h2>Changes and contact</h2>
        <p>
          Material updates will be posted here with a new effective date.
          Questions may be sent to the privacy email above.
        </p>
      </section>
    </div>
  );
}
