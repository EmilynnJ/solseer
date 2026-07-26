import { useEffect, useState, type FormEvent } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Activity,
  Banknote,
  BookHeart,
  Check,
  CircleDollarSign,
  History,
  ImageUp,
  Radio,
  Shield,
  Star,
  Users,
} from "lucide-react";
import { TOP_UP_PRESETS_CENTS } from "@soulseer/shared";
import type { LedgerEntry, Reading } from "../types";
import { API_ORIGIN, api, dateTime, duration, money } from "../lib/api";
import { useApiData } from "../hooks/use-api";
import { useSoulAuth } from "../components/auth-context";
import { authClient, getAccessToken } from "../lib/auth";
import {
  Button,
  Empty,
  Loading,
  Modal,
  Notice,
  PageIntro,
  Stars,
} from "../components/ui";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export function DashboardPage() {
  const { me } = useSoulAuth();
  if (!me)
    return (
      <div className="page-shell">
        <Loading />
      </div>
    );
  return me.user.role === "admin" ? (
    <AdminDashboard />
  ) : me.user.role === "reader" ? (
    <ReaderDashboard />
  ) : (
    <ClientDashboard />
  );
}

function DashboardHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="dashboard-head">
      <PageIntro eyebrow={eyebrow} title={title} />
      {children}
    </div>
  );
}

function ClientDashboard() {
  const { me, refresh: refreshMe } = useSoulAuth();
  const [topUp, setTopUp] = useState(false);
  const history = useApiData(
    () => api<{ readings: Reading[] }>("/readings/client"),
    [],
  );
  const ledger = useApiData(
    () => api<{ transactions: LedgerEntry[] }>("/transactions"),
    [],
  );
  const active =
    history.data?.readings.filter((item) =>
      ["pending", "preflight", "connecting", "active", "ending"].includes(
        item.status,
      ),
    ) ?? [];
  async function exportData() {
    const data = await api<Record<string, unknown>>("/auth/export");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `soulseer-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function deleteAccount() {
    const confirmation = window.prompt(
      "This permanently closes your SoulSeer profile. Type DELETE MY ACCOUNT to continue.",
    );
    if (confirmation !== "DELETE MY ACCOUNT") return;
    await api("/auth/delete-account", {
      method: "POST",
      body: JSON.stringify({ confirmation }),
    });
    await authClient.deleteUser().catch(() => authClient.signOut());
    window.location.assign("/");
  }
  return (
    <div className="page-shell dashboard">
      <DashboardHeader
        eyebrow="Your sanctuary"
        title={`Welcome, ${me?.user.fullName.split(" ")[0] ?? "friend"}.`}
      >
        <div className="balance-card">
          <span>Available balance</span>
          <strong>{money(me?.balance ?? 0)}</strong>
          <Button onClick={() => setTopUp(true)}>Add funds</Button>
        </div>
      </DashboardHeader>
      <section className="metric-grid">
        <article>
          <BookHeart />
          <span>Readings</span>
          <strong>{history.data?.readings.length ?? 0}</strong>
        </article>
        <article>
          <CircleDollarSign />
          <span>Total invested</span>
          <strong>
            {money(
              history.data?.readings.reduce(
                (sum, item) => sum + item.totalPrice,
                0,
              ) ?? 0,
            )}
          </strong>
        </article>
        <article>
          <Star />
          <span>Reviews shared</span>
          <strong>
            {history.data?.readings.filter((r) => r.rating).length ?? 0}
          </strong>
        </article>
      </section>
      <DashboardSection icon={<Radio />} title="Current readings">
        {history.loading ? (
          <Loading />
        ) : active.length ? (
          <ReadingTable rows={active} showAction />
        ) : (
          <Empty title="No reading is in progress">
            When you request a reading, its status will appear here.
          </Empty>
        )}
      </DashboardSection>
      <DashboardSection icon={<History />} title="Reading history">
        {history.error ? (
          <Notice tone="error">{history.error}</Notice>
        ) : (
          <ReadingTable
            rows={
              history.data?.readings.filter((r) => r.status === "ended") ?? []
            }
          />
        )}
      </DashboardSection>
      <DashboardSection icon={<Banknote />} title="Transactions">
        {ledger.loading ? (
          <Loading />
        ) : (
          <LedgerTable rows={ledger.data?.transactions ?? []} />
        )}
      </DashboardSection>
      <DashboardSection icon={<Shield />} title="Privacy & account">
        <div className="account-actions">
          <div>
            <strong>Your data, your choice</strong>
            <p>
              Download a machine-readable copy of your profile and activity, or
              close your account.
            </p>
          </div>
          <div className="row-actions">
            <Button className="secondary" onClick={() => void exportData()}>
              Download my data
            </Button>
            <Button
              className="danger-button"
              onClick={() => void deleteAccount()}
            >
              Delete account
            </Button>
          </div>
        </div>
      </DashboardSection>
      {topUp && (
        <TopUpModal
          onClose={() => setTopUp(false)}
          onComplete={async () => {
            await Promise.all([refreshMe(), ledger.refresh()]);
            setTopUp(false);
          }}
        />
      )}
    </div>
  );
}

function TopUpModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => Promise<void>;
}) {
  const [amount, setAmount] = useState<number>(2500);
  const [custom, setCustom] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = custom ? Math.round(Number(custom) * 100) : amount;
  async function create() {
    setError(null);
    if (chosen < 500) {
      setError("The minimum top-up is $5.");
      return;
    }
    try {
      const result = await api<{ clientSecret: string }>(
        "/payments/create-intent",
        {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ amountCents: chosen }),
        },
      );
      setSecret(result.clientSecret);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to begin payment.",
      );
    }
  }
  return (
    <Modal title="Add funds securely" onClose={onClose}>
      {error && <Notice tone="error">{error}</Notice>}
      {!secret ? (
        <div className="topup">
          <p>Choose an amount. Funds appear after Stripe confirms payment.</p>
          <div className="preset-grid">
            {TOP_UP_PRESETS_CENTS.map((value) => (
              <button
                key={value}
                className={amount === value && !custom ? "selected" : ""}
                onClick={() => {
                  setAmount(value);
                  setCustom("");
                }}
              >
                {money(value)}
              </button>
            ))}
          </div>
          <label>
            Custom amount ($)
            <input
              min="5"
              max="1000"
              step="1"
              type="number"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
          <Button onClick={() => void create()}>
            Continue with {money(chosen)}
          </Button>
          <small>
            Payments are processed by Stripe. SoulSeer never sees your card
            details.
          </small>
        </div>
      ) : stripePromise ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: secret,
            appearance: {
              theme: "night",
              variables: {
                colorPrimary: "#ff69b4",
                colorBackground: "#13111a",
                colorText: "#ffffff",
              },
            },
          }}
        >
          <PaymentForm onComplete={onComplete} />
        </Elements>
      ) : (
        <Notice tone="error">
          Stripe is not configured for this environment.
        </Notice>
      )}
    </Modal>
  );
}

function PaymentForm({ onComplete }: { onComplete: () => Promise<void> }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}/dashboard` },
    });
    if (result.error) {
      setError(result.error.message ?? "Payment could not be completed.");
      setBusy(false);
      return;
    }
    await onComplete();
  }
  return (
    <form className="stripe-form" onSubmit={pay}>
      {error && <Notice tone="error">{error}</Notice>}
      <PaymentElement />
      <Button disabled={!stripe || busy}>
        {busy ? "Confirming…" : "Add funds"}
      </Button>
    </form>
  );
}

function ReaderDashboard() {
  const { me, refresh: refreshMe } = useSoulAuth();
  const history = useApiData(
    () => api<{ readings: Reading[] }>("/readings/reader"),
    [],
  );
  const [saving, setSaving] = useState(false);
  const reader = me?.reader as {
    isOnline?: boolean;
    pricingChat?: number;
    pricingVoice?: number;
    pricingVideo?: number;
    bio?: string;
    specialties?: string[];
  } | null;
  const insights = useApiData(
    () =>
      api<{
        summary: {
          pendingPayout: number;
          historicalEarnings: number;
          todayEarnings: number;
        };
        reviews: {
          id: string;
          rating: number;
          text: string | null;
          createdAt: string;
          clientName: string;
        }[];
      }>("/readers/dashboard/summary"),
    [],
  );
  const [rates, setRates] = useState({
    chat: reader?.pricingChat ?? 100,
    voice: reader?.pricingVoice ?? 100,
    video: reader?.pricingVideo ?? 100,
  });
  const [profile, setProfile] = useState({
    bio: reader?.bio ?? "",
    specialties: (reader?.specialties ?? []).join(", "),
  });
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!reader?.isOnline) return;
    const heartbeat = () =>
      void api("/readers/heartbeat", { method: "PATCH" }).catch(() =>
        setMessage("Heartbeat interrupted. Toggle availability to reconnect."),
      );
    heartbeat();
    const timer = window.setInterval(heartbeat, 30000);
    return () => clearInterval(timer);
  }, [reader?.isOnline]);
  async function toggle() {
    setSaving(true);
    await api("/readers/status", {
      method: "PATCH",
      body: JSON.stringify({ isOnline: !reader?.isOnline }),
    });
    await refreshMe();
    setSaving(false);
  }
  async function saveRates(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api("/readers/pricing", {
      method: "PATCH",
      body: JSON.stringify(rates),
    });
    await refreshMe();
    setMessage("Rates saved.");
    setSaving(false);
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api("/readers/profile", {
      method: "PATCH",
      body: JSON.stringify({
        bio: profile.bio,
        specialties: profile.specialties
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      }),
    });
    await refreshMe();
    setMessage("Profile saved.");
    setSaving(false);
  }
  async function accept(id: string) {
    try {
      await api(`/readings/${id}/accept`, { method: "POST" });
      window.location.assign(`/reading/${id}`);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Unable to accept reading.",
      );
    }
  }
  const earnings = insights.data?.summary.historicalEarnings ?? 0;
  const pending =
    history.data?.readings.filter((r) => r.status === "pending") ?? [];
  return (
    <div className="page-shell dashboard">
      <DashboardHeader
        eyebrow="Reader studio"
        title={`Hello, ${me?.user.fullName.split(" ")[0]}.`}
      >
        <div
          className={`availability-card ${reader?.isOnline ? "active" : ""}`}
        >
          <span className="pulse" />
          <div>
            <strong>
              {reader?.isOnline ? "You’re available" : "You’re offline"}
            </strong>
            <small>
              {reader?.isOnline
                ? "Clients can request a reading now."
                : "Go online when you’re ready."}
            </small>
          </div>
          <Button
            className={reader?.isOnline ? "secondary" : ""}
            disabled={saving}
            onClick={() => void toggle()}
          >
            {reader?.isOnline ? "Go offline" : "Go online"}
          </Button>
        </div>
      </DashboardHeader>
      {message && (
        <Notice tone={message.includes("Unable") ? "error" : "success"}>
          {message}
        </Notice>
      )}
      <section className="metric-grid">
        <article>
          <Banknote />
          <span>Earned today</span>
          <strong>{money(insights.data?.summary.todayEarnings ?? 0)}</strong>
        </article>
        <article>
          <CircleDollarSign />
          <span>Pending payout</span>
          <strong>{money(insights.data?.summary.pendingPayout ?? 0)}</strong>
        </article>
        <article>
          <History />
          <span>Historical earnings</span>
          <strong>{money(earnings)}</strong>
        </article>
        <article>
          <Radio />
          <span>Pending requests</span>
          <strong>{pending.length}</strong>
        </article>
      </section>
      <DashboardSection icon={<Activity />} title="Incoming requests">
        {pending.length ? (
          <div className="request-list">
            {pending.map((r) => (
              <article key={r.id}>
                <div>
                  <strong>{r.type} reading</strong>
                  <small>
                    {money(r.pricePerMinute)} / min · requested{" "}
                    {dateTime(r.startedAt)}
                  </small>
                </div>
                <Button onClick={() => void accept(r.id)}>
                  Accept & enter
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No requests waiting">
            Keep this page open while you’re available. Your heartbeat stays
            fresh automatically.
          </Empty>
        )}
      </DashboardSection>
      <div className="dashboard-columns">
        <DashboardSection icon={<CircleDollarSign />} title="Per-minute rates">
          <form className="stack-form compact" onSubmit={saveRates}>
            {(["chat", "voice", "video"] as const).map((k) => (
              <label key={k}>
                {k}
                <span className="money-input">
                  $
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={rates[k] / 100}
                    onChange={(e) =>
                      setRates({
                        ...rates,
                        [k]: Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </span>
              </label>
            ))}
            <Button disabled={saving}>Save rates</Button>
          </form>
        </DashboardSection>
        <DashboardSection icon={<BookHeart />} title="Public profile">
          <form className="stack-form compact" onSubmit={saveProfile}>
            <label>
              Bio
              <textarea
                rows={5}
                maxLength={4000}
                value={profile.bio}
                onChange={(e) =>
                  setProfile({ ...profile, bio: e.target.value })
                }
              />
            </label>
            <label>
              Specialties (comma separated)
              <input
                value={profile.specialties}
                onChange={(e) =>
                  setProfile({ ...profile, specialties: e.target.value })
                }
              />
            </label>
            <ReaderImageUpload onDone={() => void refreshMe()} />
            <Button disabled={saving}>Save profile</Button>
          </form>
        </DashboardSection>
      </div>
      <DashboardSection icon={<History />} title="Session & review history">
        <ReadingTable
          rows={
            history.data?.readings.filter((r) => r.status === "ended") ?? []
          }
          reader
        />
      </DashboardSection>
      <DashboardSection icon={<Star />} title="Reviews received">
        {insights.data?.reviews.length ? (
          <div className="review-grid">
            {insights.data.reviews.map((review) => (
              <blockquote key={review.id}>
                <Stars value={review.rating} />
                <p>“{review.text || "A meaningful reading."}”</p>
                <footer>
                  — {review.clientName}, {dateTime(review.createdAt)}
                </footer>
              </blockquote>
            ))}
          </div>
        ) : (
          <Empty title="No reviews yet">
            Client reflections will appear here after completed readings.
          </Empty>
        )}
      </DashboardSection>
    </div>
  );
}

function ReaderImageUpload({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    const cap = await api<{ capability: string; signature: string }>(
      "/uploads/reader-image/capability",
      {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      },
    );
    const token = await getAccessToken();
    const response = await fetch(`${API_ORIGIN}/api/uploads/reader-image`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type,
        "Content-Length": String(file.size),
        "X-SoulSeer-Upload-Capability": cap.capability,
        "X-SoulSeer-Upload-Signature": cap.signature,
      },
      body: file,
    });
    if (!response.ok) throw new Error("Image upload failed.");
    setBusy(false);
    onDone();
  }
  return (
    <label className="upload-button">
      <ImageUp /> {busy ? "Uploading…" : "Upload profile image"}
      <input
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
    </label>
  );
}

type AdminUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
  balance: number | null;
  verificationStatus: string | null;
  isOnline: boolean | null;
  stripeOnboardingComplete: boolean | null;
  createdAt: string;
};
type AdminReading = {
  id: string;
  status: string;
  type: string;
  clientId: string;
  readerId: string;
  durationSeconds: number;
  totalPrice: number;
  paymentStatus: string;
  failureReason: string | null;
  createdAt: string;
  eventCount: number;
};
type AdminFlag = {
  id: string;
  postId: string | null;
  commentId: string | null;
  reason: string;
  createdAt: string;
  status: string;
};

function AdminDashboard() {
  const [tab, setTab] = useState("users");
  const [notice, setNotice] = useState<string | null>(null);
  const users = useApiData(
    () => api<{ users: AdminUser[] }>("/admin/users"),
    [],
  );
  const readings = useApiData(
    () => api<{ readings: AdminReading[] }>("/admin/readings"),
    [],
  );
  const ledger = useApiData(
    () => api<{ transactions: LedgerEntry[] }>("/admin/transactions"),
    [],
  );
  const flags = useApiData(
    () => api<{ flags: AdminFlag[] }>("/admin/forum/flagged"),
    [],
  );
  const finances = useApiData(
    () =>
      api<{
        pendingPayoutTotal: number;
        payouts: unknown[];
        refunds: unknown[];
      }>("/admin/financial-summary"),
    [],
  );
  const [invite, setInvite] = useState({
    email: "",
    username: "",
    fullName: "",
    bio: "",
    specialties: "",
    chat: 5,
    voice: 7,
    video: 10,
    verified: true,
  });
  async function inviteReader(e: FormEvent) {
    e.preventDefault();
    try {
      const result = await api<{ inviteUrl: string }>("/admin/readers", {
        method: "POST",
        body: JSON.stringify({
          ...invite,
          specialties: invite.specialties
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          pricing: {
            chat: invite.chat * 100,
            voice: invite.voice * 100,
            video: invite.video * 100,
          },
        }),
      });
      await navigator.clipboard
        .writeText(result.inviteUrl)
        .catch(() => undefined);
      setNotice(`Reader invite created and copied: ${result.inviteUrl}`);
      await users.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Invite failed.");
    }
  }
  async function readerAction(
    user: AdminUser,
    action: "verify" | "suspend" | "activate" | "connect",
  ) {
    if (action === "connect") {
      const result = await api<{ url: string }>(
        `/admin/readers/${user.id}/connect`,
        { method: "POST" },
      );
      window.open(result.url, "_blank", "noopener");
      return;
    }
    await api(`/admin/readers/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify(
        action === "verify"
          ? { verificationStatus: "verified" }
          : { status: action === "suspend" ? "suspended" : "active" },
      ),
    });
    await users.refresh();
  }
  async function adjust(user: AdminUser) {
    const dollars = window.prompt(
      `Adjustment in dollars for ${user.username} (negative allowed):`,
    );
    const reason = window.prompt("Required reason:");
    if (!dollars || !reason) return;
    await api("/admin/balance-adjust", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        amountCents: Math.round(Number(dollars) * 100),
        reason,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    await users.refresh();
    setNotice("Balance adjustment recorded.");
  }
  async function refund(reading: AdminReading) {
    const reason = window.prompt("Required refund reason:");
    if (!reason) return;
    await api(`/admin/refunds/${reading.id}`, {
      method: "POST",
      body: JSON.stringify({ reason, idempotencyKey: crypto.randomUUID() }),
    });
    await Promise.all([readings.refresh(), finances.refresh()]);
    setNotice("Refund recorded.");
  }
  async function payout(user: AdminUser) {
    await api(`/admin/payouts/${user.id}`, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    });
    await finances.refresh();
    setNotice("Payout submitted to Stripe Connect.");
  }
  return (
    <div className="page-shell dashboard admin">
      <DashboardHeader
        eyebrow="Platform control"
        title="SoulSeer administration"
      >
        <div className="admin-security">
          <Shield />
          <span>
            Privileged actions are role-checked, idempotent, and audited.
          </span>
        </div>
      </DashboardHeader>
      {notice && (
        <Notice tone={notice.includes("failed") ? "error" : "success"}>
          {notice}
        </Notice>
      )}
      <section className="metric-grid">
        <article>
          <Users />
          <span>Accounts</span>
          <strong>{users.data?.users.length ?? 0}</strong>
        </article>
        <article>
          <BookHeart />
          <span>Readings</span>
          <strong>{readings.data?.readings.length ?? 0}</strong>
        </article>
        <article>
          <Banknote />
          <span>Pending payouts</span>
          <strong>{money(finances.data?.pendingPayoutTotal ?? 0)}</strong>
        </article>
        <article>
          <Activity />
          <span>Open flags</span>
          <strong>{flags.data?.flags.length ?? 0}</strong>
        </article>
      </section>
      <nav className="admin-tabs" aria-label="Admin sections">
        {[
          "users",
          "readers",
          "readings",
          "ledger",
          "payouts",
          "moderation",
        ].map((item) => (
          <button
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "users" && (
        <DashboardSection icon={<Users />} title="Users & balances">
          <AdminUsers
            rows={users.data?.users ?? []}
            onAdjust={adjust}
            onAction={readerAction}
          />
        </DashboardSection>
      )}
      {tab === "readers" && (
        <DashboardSection icon={<Check />} title="Invite a Reader">
          <form className="admin-form" onSubmit={inviteReader}>
            {["email", "username", "fullName", "specialties"].map((k) => (
              <label key={k}>
                {k.replace(/([A-Z])/g, " $1")}
                <input
                  required
                  value={invite[k as keyof typeof invite] as string}
                  onChange={(e) =>
                    setInvite({ ...invite, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="wide">
              Bio
              <textarea
                required
                rows={4}
                value={invite.bio}
                onChange={(e) => setInvite({ ...invite, bio: e.target.value })}
              />
            </label>
            {(["chat", "voice", "video"] as const).map((k) => (
              <label key={k}>
                {k} $/min
                <input
                  required
                  type="number"
                  min="1"
                  value={invite[k]}
                  onChange={(e) =>
                    setInvite({ ...invite, [k]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            <label className="check">
              <input
                type="checkbox"
                checked={invite.verified}
                onChange={(e) =>
                  setInvite({ ...invite, verified: e.target.checked })
                }
              />{" "}
              Pre-verify Reader
            </label>
            <Button>Generate secure invite</Button>
          </form>
        </DashboardSection>
      )}
      {tab === "readings" && (
        <DashboardSection icon={<BookHeart />} title="All readings">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Revenue</th>
                  <th>Events</th>
                  <th>Failure</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {readings.data?.readings.map((r) => (
                  <tr key={r.id}>
                    <td>{dateTime(r.createdAt)}</td>
                    <td>{r.type}</td>
                    <td>
                      <span className={`status ${r.status}`}>{r.status}</span>
                    </td>
                    <td>{duration(r.durationSeconds)}</td>
                    <td>{money(r.totalPrice)}</td>
                    <td>{r.eventCount}</td>
                    <td>{r.failureReason ?? "—"}</td>
                    <td>
                      {r.status === "ended" &&
                        r.paymentStatus !== "refunded" && (
                          <button onClick={() => void refund(r)}>Refund</button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}
      {tab === "ledger" && (
        <DashboardSection
          icon={<Banknote />}
          title="Immutable transaction ledger"
        >
          <LedgerTable rows={ledger.data?.transactions ?? []} />
        </DashboardSection>
      )}
      {tab === "payouts" && (
        <DashboardSection icon={<CircleDollarSign />} title="Reader payouts">
          <div className="request-list">
            {users.data?.users
              .filter((u) => u.role === "reader")
              .map((u) => (
                <article key={u.id}>
                  <div>
                    <strong>{u.fullName}</strong>
                    <small>
                      {u.stripeOnboardingComplete
                        ? "Connect ready"
                        : "Connect onboarding required"}
                    </small>
                  </div>
                  <div className="row-actions">
                    {!u.stripeOnboardingComplete && (
                      <Button
                        className="secondary"
                        onClick={() => void readerAction(u, "connect")}
                      >
                        Onboard
                      </Button>
                    )}
                    <Button
                      disabled={!u.stripeOnboardingComplete}
                      onClick={() => void payout(u)}
                    >
                      Pay out
                    </Button>
                  </div>
                </article>
              ))}
          </div>
        </DashboardSection>
      )}
      {tab === "moderation" && (
        <DashboardSection icon={<Shield />} title="Flagged content">
          <div className="request-list">
            {flags.data?.flags.length ? (
              flags.data.flags.map((f) => (
                <article key={f.id}>
                  <div>
                    <strong>{f.reason}</strong>
                    <small>
                      {f.postId ? `Post ${f.postId}` : `Comment ${f.commentId}`}{" "}
                      · {dateTime(f.createdAt)}
                    </small>
                  </div>
                  <div className="row-actions">
                    <Button
                      className="secondary"
                      onClick={async () => {
                        await api(`/admin/forum/flags/${f.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ status: "dismissed" }),
                        });
                        await flags.refresh();
                      }}
                    >
                      Dismiss
                    </Button>
                    <Button
                      onClick={async () => {
                        await api(`/admin/forum/flags/${f.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ status: "actioned" }),
                        });
                        await flags.refresh();
                      }}
                    >
                      Actioned
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <Empty title="Moderation queue is clear">
                There are no open community reports.
              </Empty>
            )}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}

function AdminUsers({
  rows,
  onAdjust,
  onAction,
}: {
  rows: AdminUser[];
  onAdjust: (u: AdminUser) => Promise<void>;
  onAction: (
    u: AdminUser,
    a: "verify" | "suspend" | "activate" | "connect",
  ) => Promise<void>;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Balance</th>
            <th>Reader approval</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                <strong>{u.fullName}</strong>
                <small>
                  {u.email}
                  <br />@{u.username}
                </small>
              </td>
              <td>{u.role}</td>
              <td>
                <span className={`status ${u.status}`}>{u.status}</span>
              </td>
              <td>{money(u.balance ?? 0)}</td>
              <td>{u.verificationStatus ?? "—"}</td>
              <td>
                <div className="table-actions">
                  <button onClick={() => void onAdjust(u)}>Adjust</button>
                  {u.role === "reader" &&
                    u.verificationStatus !== "verified" && (
                      <button onClick={() => void onAction(u, "verify")}>
                        Verify
                      </button>
                    )}
                  {u.status === "active" ? (
                    <button onClick={() => void onAction(u, "suspend")}>
                      Suspend
                    </button>
                  ) : (
                    <button onClick={() => void onAction(u, "activate")}>
                      Reactivate
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
function ReadingTable({
  rows,
  showAction = false,
  reader = false,
}: {
  rows: Reading[];
  showAction?: boolean;
  reader?: boolean;
}) {
  if (!rows.length)
    return (
      <Empty title="Nothing here yet">
        Your records will appear here after your first reading.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{reader ? "Client" : "Reader"}</th>
            <th>Date</th>
            <th>Type</th>
            <th>Status</th>
            <th>Duration</th>
            <th>{reader ? "Earnings" : "Cost"}</th>
            <th>Review</th>
            {showAction && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.counterpartName ?? "Private client"}</td>
              <td>{dateTime(r.startedAt ?? r.completedAt)}</td>
              <td>{r.type}</td>
              <td>
                <span className={`status ${r.status}`}>{r.status}</span>
              </td>
              <td>{duration(r.durationSeconds)}</td>
              <td>
                {money(reader ? Math.floor(r.totalPrice * 0.7) : r.totalPrice)}
              </td>
              <td>{r.rating ? <Stars value={r.rating} /> : "—"}</td>
              {showAction && (
                <td>
                  <a href={`/reading/${r.id}`}>Open</a>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function LedgerTable({ rows }: { rows: LedgerEntry[] }) {
  if (!rows.length)
    return (
      <Empty title="No transactions yet">
        Top-ups, reading charges, refunds, payouts, and adjustments will appear
        here.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Details</th>
            <th>Amount</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{dateTime(row.createdAt)}</td>
              <td>{row.type.replaceAll("_", " ")}</td>
              <td>{row.reason ?? "—"}</td>
              <td className={row.amount >= 0 ? "positive" : "negative"}>
                {row.amount >= 0 ? "+" : ""}
                {money(row.amount)}
              </td>
              <td>{money(row.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
