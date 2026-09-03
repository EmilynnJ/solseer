import { BRAND } from "@soulseer/shared";
import { HeartHandshake, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PageIntro } from "../components/ui";

export function AboutPage() {
  return (
    <div className="page-shell about-page">
      <PageIntro
        eyebrow="Why we’re here"
        title="Built for guidance with a conscience."
      />
      <section className="founder-story">
        <img src={BRAND.founderImage} alt="Emilynn, founder of SoulSeer" />
        <div className="story-copy">
          <p>
            At SoulSeer, we are dedicated to providing ethical, compassionate,
            and judgment-free spiritual guidance. Our mission is twofold: to
            offer clients genuine, heart-centered readings and to uphold fair,
            ethical standards for our readers.
          </p>
          <p>
            Founded by psychic medium Emilynn, SoulSeer was created as a
            response to the corporate greed that dominates many psychic
            platforms. Unlike other apps, our readers keep the majority of what
            they earn and play an active role in shaping the platform.
          </p>
          <p>
            SoulSeer is more than just an app - it's a soul tribe. A community
            of gifted psychics united by our life's calling: to guide, heal, and
            empower those who seek clarity on their journey.
          </p>
          <Link className="button" to="/readers">
            Meet our Readers
          </Link>
        </div>
      </section>
      <section className="values">
        <article>
          <HeartHandshake />
          <h3>Compassion first</h3>
          <p>Every seeker deserves a safe, judgment-free place to be heard.</p>
        </article>
        <article>
          <Scale />
          <h3>Fair by design</h3>
          <p>
            Readers keep 70% of reading revenue and help shape their platform.
          </p>
        </article>
        <article>
          <Sparkles />
          <h3>Genuine connection</h3>
          <p>
            Real people, live conversations, and guidance centered on your
            agency.
          </p>
        </article>
      </section>
    </div>
  );
}
