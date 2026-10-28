import { Globe2, MessageCircle } from "lucide-react";
import { PageIntro } from "./ui";

export function CommunityIntro() {
  return (<>
      <PageIntro
        eyebrow="The SoulSeer circle"
        title="A place to share, listen, and grow."
      >
        <p>
          Read openly. Join in when you’re ready. Our community is rooted in
          curiosity, kindness, and mutual respect.
        </p>
      </PageIntro>
      <section className="community-links">
        <a
          href={import.meta.env.VITE_FACEBOOK_GROUP_URL || "https://www.facebook.com"}
          target="_blank"
          rel="noreferrer"
        >
          <Globe2 />
          <div>
            <h3>Join our Facebook Group</h3>
            <p>
              Long-form conversation, community news, and shared experiences.
            </p>
          </div>
        </a>
        <a
          href={import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.com"}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle />
          <div>
            <h3>Join our Discord Server</h3>
            <p>
              Friendly real-time conversation and a welcoming spiritual circle.
            </p>
          </div>
        </a>
      </section>
  </>);
}

