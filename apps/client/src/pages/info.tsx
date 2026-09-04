import { ChevronDown, Mail } from "lucide-react";
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
      <section
        id="accessibility"
        aria-labelledby="accessibility-heading"
        className="legal-copy"
      >
        <h2 id="accessibility-heading">Accessibility statement</h2>
        <p><a href="/accessibility">Read the full Accessibility Statement</a>.</p>
        <p>
          SoulSeer is committed to making our website and app more accessible to
          people with disabilities. We are working to identify and remove
          barriers to using our services.
        </p>
        <p>
          Accessibility is an ongoing effort. Some features, including
          third-party reading and payment tools, may have limitations. This
          statement is not a certification of full accessibility or legal
          compliance.
        </p>
        <p>
          If you encounter a barrier or need assistance or an alternative way to
          access a service, please{" "}
          <a
            href={`mailto:${String(import.meta.env.VITE_SUPPORT_EMAIL || "support@soulseer.com")}?subject=Accessibility%20assistance`}
          >
            contact support about accessibility
          </a>
          . Include the page or feature, what went wrong, and your preferred way
          for us to respond. Browser and assistive-technology details are
          helpful but optional. Please do not send passwords, payment details,
          or private reading content.
        </p>
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
