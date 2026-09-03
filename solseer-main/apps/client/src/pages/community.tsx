import { useState, type FormEvent } from "react";
import {
  Flag,
  Globe2,
  Lock,
  MessageCircle,
  MessagesSquare,
  Plus,
} from "lucide-react";
import type { ForumComment, ForumPost } from "../types";
import { api, dateTime } from "../lib/api";
import { posthog } from "../lib/posthog";
import { useApiData } from "../hooks/use-api";
import { useSoulAuth } from "../components/auth-context";
import {
  Button,
  Empty,
  Loading,
  Modal,
  Notice,
  PageIntro,
} from "../components/ui";

const labels: Record<string, string> = {
  general: "General",
  readings: "Readings",
  spiritual_growth: "Spiritual Growth",
  ask_a_reader: "Ask a Reader",
  announcements: "Announcements",
};

export function CommunityPage() {
  const auth = useSoulAuth();
  const [page, setPage] = useState(1);
  const posts = useApiData(
    () => api<{ posts: ForumPost[] }>(`/forum/posts?page=${page}`, {}, false),
    [page],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  return (
    <div className="page-shell">
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
      <section className="forum">
        <div className="section-head">
          <div>
            <p className="eyebrow">Public forum</p>
            <h2>Latest conversations</h2>
          </div>
          {auth.sessionUser && (
            <Button onClick={() => setComposer(true)}>
              <Plus /> New post
            </Button>
          )}
        </div>
        {posts.loading ? (
          <Loading />
        ) : posts.error ? (
          <Notice tone="error">{posts.error}</Notice>
        ) : posts.data?.posts.length ? (
          <div className="post-list">
            {posts.data.posts.map((post) => (
              <button
                key={post.id}
                className="post-row"
                onClick={() => setSelected(post.id)}
              >
                <span className="category">{labels[post.category]}</span>
                <div>
                  <h3>
                    {post.title} {post.isLocked && <Lock size={14} />}
                  </h3>
                  <p>{post.body}</p>
                  <small>
                    By {post.authorName} · {dateTime(post.createdAt)}
                  </small>
                </div>
                <span className="comment-count">
                  <MessagesSquare /> {post.commentCount}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty title="Be the first to begin a conversation">
            A thoughtful question can open a door for the whole community.
          </Empty>
        )}
        <div className="pagination">
          <Button
            className="secondary"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>Page {page}</span>
          <Button
            className="secondary"
            disabled={(posts.data?.posts.length ?? 0) < 10}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </section>
      {composer && (
        <PostComposer
          isAdmin={auth.me?.user.role === "admin"}
          onClose={() => setComposer(false)}
          onCreated={async () => {
            setComposer(false);
            await posts.refresh();
          }}
        />
      )}{" "}
      {selected && (
        <PostThread
          id={selected}
          canReply={Boolean(auth.sessionUser)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function PostComposer({
  isAdmin,
  onClose,
  onCreated,
}: {
  isAdmin: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "general",
  });
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/forum/posts", { method: "POST", body: JSON.stringify(form) });
      posthog.capture("community_post_published", {
        category: form.category,
      });
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish.");
    }
  }
  return (
    <Modal title="Begin a conversation" onClose={onClose}>
      <form className="stack-form" onSubmit={submit}>
        {error && <Notice tone="error">{error}</Notice>}
        <label>
          Title
          <input
            required
            minLength={4}
            maxLength={160}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {Object.entries(labels)
              .filter(([value]) => value !== "announcements" || isAdmin)
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Your post
          <textarea
            required
            minLength={10}
            maxLength={20000}
            rows={8}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <Button>Publish post</Button>
      </form>
    </Modal>
  );
}

function PostThread({
  id,
  canReply,
  onClose,
}: {
  id: string;
  canReply: boolean;
  onClose: () => void;
}) {
  const thread = useApiData(
    () =>
      api<{ post: ForumPost; comments: ForumComment[] }>(
        `/forum/posts/${id}`,
        {},
        false,
      ),
    [id],
  );
  const [reply, setReply] = useState("");
  const [parentId, setParentId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/forum/posts/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: reply, parentId }),
      });
      posthog.capture("community_comment_published", {
        is_reply: Boolean(parentId),
      });
      setReply("");
      setParentId(undefined);
      await thread.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reply.");
    }
  }
  async function flag(commentId?: string) {
    const reason = window.prompt(
      "Briefly tell our moderation team what concerns you.",
    );
    if (!reason) return;
    await api(
      commentId
        ? `/forum/comments/${commentId}/flag`
        : `/forum/posts/${id}/flag`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
  }
  return (
    <Modal title="Community conversation" onClose={onClose}>
      {thread.loading ? (
        <Loading />
      ) : thread.error || !thread.data ? (
        <Notice tone="error">{thread.error}</Notice>
      ) : (
        <div className="thread">
          <span className="category">{labels[thread.data.post.category]}</span>
          <h2>{thread.data.post.title}</h2>
          <p className="thread-body">{thread.data.post.body}</p>
          <small>
            By {thread.data.post.authorName} ·{" "}
            {dateTime(thread.data.post.createdAt)}
          </small>
          {canReply && (
            <button className="flag-link" onClick={() => void flag()}>
              <Flag /> Flag
            </button>
          )}
          <div className="comments">
            {thread.data.comments.map((comment) => (
              <article
                key={comment.id}
                className={comment.parentId ? "nested" : ""}
              >
                <strong>{comment.authorName}</strong>
                <small>{dateTime(comment.createdAt)}</small>
                <p>{comment.body}</p>
                {canReply && (
                  <div>
                    <button
                      onClick={() =>
                        setParentId(comment.parentId ? undefined : comment.id)
                      }
                    >
                      Reply
                    </button>
                    <button onClick={() => void flag(comment.id)}>Flag</button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {canReply && !thread.data.post.isLocked ? (
            <form className="reply-form" onSubmit={submit}>
              {parentId && (
                <small>
                  Replying to a comment{" "}
                  <button type="button" onClick={() => setParentId(undefined)}>
                    Cancel
                  </button>
                </small>
              )}
              {error && <Notice tone="error">{error}</Notice>}
              <textarea
                required
                maxLength={8000}
                placeholder="Add something thoughtful…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <Button>Post reply</Button>
            </form>
          ) : (
            <Notice>
              {thread.data.post.isLocked
                ? "This conversation is locked."
                : "Sign in to join this conversation."}
            </Notice>
          )}
        </div>
      )}
    </Modal>
  );
}
