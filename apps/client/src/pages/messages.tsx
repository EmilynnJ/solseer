import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SyntheticEvent,
} from "react";
import {
  ArrowLeft,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { DirectMessage, MessageConversation } from "../types";
import { api, dateTime, money } from "../lib/api";
import { posthog } from "../lib/posthog";
import { useSoulAuth } from "../components/auth-context";
import { Button, Empty, Loading, Notice, PageIntro } from "../components/ui";

type ThreadResponse = {
  conversation: { id: string; clientId: string; readerId: string };
  messages: DirectMessage[];
};

export function MessagesPage() {
  const { me, refresh: refreshMe } = useSoulAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [body, setBody] = useState("");
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState("5.00");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReader = me?.user.role === "reader";

  const loadConversations = useCallback(async () => {
    const result = await api<{ conversations: MessageConversation[] }>(
      "/messages/conversations",
    );
    setConversations(result.conversations);
    return result.conversations;
  }, []);

  // ⚡ Bolt: Avoid sending redundant POST /read mutation write queries during
  // background polling. Only send markRead when opening a thread or explicitly requested.
  const loadThread = useCallback(
    async (conversationId: string, markRead = true) => {
      const result = await api<ThreadResponse>(
        `/messages/conversations/${conversationId}`,
      );
      setThread(result);
      if (markRead) {
        await api(`/messages/conversations/${conversationId}/read`, {
          method: "POST",
        });
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      try {
        const rows = await loadConversations();
        const requestedReader = searchParams.get("reader");
        const requestedConversation = searchParams.get("conversation");
        const existing = requestedReader
          ? rows.find((item) => item.counterpart.id === requestedReader)
          : rows.find((item) => item.id === requestedConversation);
        const nextId = requestedReader
          ? (existing?.id ?? null)
          : (existing?.id ?? rows[0]?.id ?? null);
        setSelectedId(nextId);
        if (nextId) await loadThread(nextId);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Messages could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadConversations, loadThread, searchParams]);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => {
      // ⚡ Bolt: Pass markRead = false during interval polling to fetch updates
      // without firing unnecessary POST /read write queries to the database every 10 seconds.
      void Promise.all([
        loadConversations(),
        loadThread(selectedId, false),
      ]).catch(() => undefined);
    }, 10_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [loadConversations, loadThread, selectedId]);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  async function selectConversation(id: string) {
    setSelectedId(id);
    setThread(null);
    setSearchParams({ conversation: id }, { replace: true });
    try {
      await loadThread(id);
      await loadConversations();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Conversation could not be opened.",
      );
    }
  }

  async function startConversation(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const readerId = searchParams.get("reader");
    if (!readerId || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const result = await api<{ conversationId: string }>(
        "/messages/conversations",
        {
          method: "POST",
          body: JSON.stringify({ readerId, body }),
        },
      );
      posthog.capture("message_sent", {
        message_kind: "client_free",
        conversation_started: true,
      });
      setBody("");
      await loadConversations();
      setSelectedId(result.conversationId);
      setSearchParams(
        { conversation: result.conversationId },
        { replace: true },
      );
      await loadThread(result.conversationId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !body.trim()) return;
    const priceCents = Math.round(Number(price) * 100);
    if (
      isReader &&
      paid &&
      (!Number.isFinite(priceCents) || priceCents < 100)
    ) {
      setError("Paid replies must cost at least $1.00.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api(`/messages/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify(
          isReader && paid
            ? { body, paid: true, priceCents }
            : { body, paid: false },
        ),
      });
      posthog.capture("message_sent", {
        message_kind: isReader && paid ? "reader_paid" : "free",
        conversation_started: false,
      });
      setBody("");
      await Promise.all([loadThread(selectedId), loadConversations()]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  async function unlock(message: DirectMessage) {
    if (
      !window.confirm(
        `Unlock this Reader response for ${money(message.priceCents)}?`,
      )
    )
      return;
    setError(null);
    try {
      await api(`/messages/messages/${message.id}/unlock`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      posthog.capture("paid_message_unlocked", {
        price_cents: message.priceCents,
      });
      if (selectedId) {
        await Promise.all([
          loadThread(selectedId),
          loadConversations(),
          refreshMe(),
        ]);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Reply could not be unlocked.",
      );
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <Loading label="Opening messages…" />
      </div>
    );
  }

  const newReaderId = !isReader ? searchParams.get("reader") : null;
  const showNewConversation = Boolean(newReaderId && !selected);

  return (
    <div className="page-shell messages-page">
      <PageIntro eyebrow="Private connection" title="Messages">
        Clients always message for free. Readers decide whether each individual
        reply is free or paid.
      </PageIntro>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={`messaging-shell ${selectedId ? "thread-selected" : ""}`}>
        <aside className="conversation-list" aria-label="Conversations">
          <div className="conversation-list-head">
            <strong>Conversations</strong>
            <button
              className="icon-button"
              aria-label="Refresh conversations"
              onClick={() => void loadConversations()}
            >
              <RefreshCw size={17} />
            </button>
          </div>
          {conversations.length ? (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={
                  conversation.id === selectedId
                    ? "conversation active"
                    : "conversation"
                }
                onClick={() => void selectConversation(conversation.id)}
              >
                <span className="message-avatar">
                  {conversation.counterpart.fullName.slice(0, 1)}
                </span>
                <span>
                  <strong>{conversation.counterpart.fullName}</strong>
                  <small>
                    {conversation.lastMessage?.locked
                      ? `Paid reply · ${money(conversation.lastMessage.priceCents)}`
                      : (conversation.lastMessage?.body ??
                        "Start a conversation")}
                  </small>
                </span>
                {conversation.unreadCount > 0 && (
                  <b>{conversation.unreadCount}</b>
                )}
              </button>
            ))
          ) : (
            <Empty icon={<MessageCircle />} title="No conversations yet">
              Open a Reader profile and choose Message Reader.
            </Empty>
          )}
        </aside>
        <section className="message-thread">
          {selectedId && (
            <button
              className="messages-back"
              onClick={() => {
                setSelectedId(null);
              }}
            >
              <ArrowLeft size={16} /> Conversations
            </button>
          )}
          {selected ? (
            <>
              <header className="thread-head">
                <div className="message-avatar">
                  {selected.counterpart.fullName.slice(0, 1)}
                </div>
                <div>
                  <strong>{selected.counterpart.fullName}</strong>
                  <small>@{selected.counterpart.username}</small>
                </div>
              </header>
              <div className="message-stream" aria-live="polite">
                {thread ? (
                  thread.messages.map((message) => {
                    const mine = message.senderId === me?.user.id;
                    return (
                      <article
                        key={message.id}
                        className={`message-bubble ${mine ? "mine" : "theirs"} ${message.locked ? "locked" : ""}`}
                      >
                        {message.locked ? (
                          <>
                            <LockKeyhole />
                            <strong>Paid Reader response</strong>
                            <p>
                              The response stays private until you choose to
                              unlock it.
                            </p>
                            <Button onClick={() => void unlock(message)}>
                              Unlock for {money(message.priceCents)}
                            </Button>
                          </>
                        ) : (
                          <p>{message.body}</p>
                        )}
                        <small>
                          {message.kind === "reader_paid" && !message.locked
                            ? `Paid reply · ${money(message.priceCents)} · `
                            : ""}
                          {dateTime(message.createdAt)}
                        </small>
                      </article>
                    );
                  })
                ) : (
                  <Loading label="Opening conversation…" />
                )}
              </div>
              <form
                className="message-compose"
                onSubmit={(event) => {
                  void sendMessage(event);
                }}
              >
                {isReader && (
                  <div className="reply-pricing">
                    <label>
                      <input
                        type="radio"
                        checked={!paid}
                        onChange={() => {
                          setPaid(false);
                        }}
                      />{" "}
                      Free reply
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={paid}
                        onChange={() => {
                          setPaid(true);
                        }}
                      />{" "}
                      Paid reply
                    </label>
                    {paid && (
                      <label className="message-price">
                        Price $
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          step="0.01"
                          value={price}
                          onChange={(event) => {
                            setPrice(event.target.value);
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
                <div className="compose-row">
                  <textarea
                    aria-label="Message"
                    required
                    maxLength={8000}
                    rows={3}
                    placeholder={
                      isReader
                        ? "Write your response…"
                        : "Ask your Reader anything…"
                    }
                    value={body}
                    onChange={(event) => {
                      setBody(event.target.value);
                    }}
                  />
                  <Button
                    disabled={sending || !body.trim()}
                    aria-label="Send message"
                  >
                    <Send /> {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </form>
            </>
          ) : showNewConversation ? (
            <form
              className="new-conversation"
              onSubmit={(event) => {
                void startConversation(event);
              }}
            >
              <MessageCircle />
              <h2>Start your conversation</h2>
              <p>Your message to this Reader is always free.</p>
              <textarea
                required
                maxLength={8000}
                rows={6}
                placeholder="What would you like guidance about?"
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                }}
              />
              <Button disabled={sending || !body.trim()}>
                {sending ? "Sending…" : "Send message"}
              </Button>
            </form>
          ) : (
            <Empty icon={<MessageCircle />} title="Choose a conversation">
              Your private messages will appear here.
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}
