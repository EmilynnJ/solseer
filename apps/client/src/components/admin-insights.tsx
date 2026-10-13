import { useCallback, useState, type ReactNode } from "react";
import { useApiData } from "../hooks/use-api";
import { api, dateTime, duration, money } from "../lib/api";
import { downloadCsv, dollars, toCsv } from "../lib/csv";
import { linearForecast } from "../lib/forecast";
import { ReadingRecordModal } from "./admin-records";
import { Button, Empty, Loading, Notice } from "./ui";

const DAY_MS = 24 * 60 * 60_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const defaultRange = () => ({
  from: isoDay(new Date(Date.now() - 29 * DAY_MS)),
  to: isoDay(new Date()),
});
const monthLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
const dayLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

// Loads on mount and whenever `load` changes; `run` re-runs it on demand.
function useReport<T>(load: () => Promise<T>) {
  const report = useApiData(load, [load]);
  return {
    data: report.data,
    error: report.error,
    busy: report.loading,
    run: report.refresh,
  };
}

function DateRange({
  value,
  onChange,
  children,
}: {
  value: { from: string; to: string };
  onChange: (value: { from: string; to: string }) => void;
  children?: ReactNode;
}) {
  return (
    <div className="report-filters">
      <label>
        From
        <input
          type="date"
          value={value.from}
          max={value.to}
          onChange={(e) => {
            onChange({ ...value, from: e.target.value });
          }}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={value.to}
          min={value.from}
          onChange={(e) => {
            onChange({ ...value, to: e.target.value });
          }}
        />
      </label>
      {children}
    </div>
  );
}

function Tiles({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <div className="report-tiles">
      {items.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcripts

type TranscriptPage = {
  transcripts: TranscriptRow[];
  hasMore: boolean;
  nextOffset: number;
};

type TranscriptRow = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  durationSeconds: number;
  totalPrice: number;
  messageCount: number;
  clientName: string | null;
  clientUsername: string | null;
  readerName: string | null;
  readerUsername: string | null;
};

export function AdminTranscripts() {
  const [filters, setFilters] = useState({ q: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const [open, setOpen] = useState<string | null>(null);
  const [extra, setExtra] = useState<TranscriptPage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const fetchPage = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({ offset: String(offset) });
      if (applied.q) params.set("q", applied.q);
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      return api<TranscriptPage>(`/admin/transcripts?${params.toString()}`);
    },
    [applied],
  );
  const load = useCallback(() => fetchPage(0), [fetchPage]);
  const report = useReport(load);
  const rows = [...(report.data?.transcripts ?? []), ...(extra?.transcripts ?? [])];
  const hasMore = extra ? extra.hasMore : Boolean(report.data?.hasMore);
  async function loadMore() {
    const offset = extra?.nextOffset ?? report.data?.nextOffset ?? 0;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchPage(offset);
      setExtra({
        ...page,
        transcripts: [...(extra?.transcripts ?? []), ...page.transcripts],
      });
    } catch (cause) {
      setMoreError(errorText(cause));
    } finally {
      setLoadingMore(false);
    }
  }
  return (
    <>
      <form
        className="report-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setExtra(null);
          setApplied({ ...filters });
        }}
      >
        <label className="grow">
          Search names, emails or words in the chat
          <input
            type="search"
            value={filters.q}
            placeholder="e.g. Brooke, client@email.com, refund"
            onChange={(e) => {
              setFilters({ ...filters, q: e.target.value });
            }}
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(e) => {
              setFilters({ ...filters, from: e.target.value });
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(e) => {
              setFilters({ ...filters, to: e.target.value });
            }}
          />
        </label>
        <Button>Search</Button>
      </form>
      {report.error && <Notice tone="error">{report.error}</Notice>}
      {report.busy && !report.data && <Loading label="Loading transcripts…" />}
      {report.data &&
        (rows.length ? (
          <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Reader</th>
                  <th>Type</th>
                  <th>Messages</th>
                  <th>Length</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateTime(row.createdAt)}</td>
                    <td>{row.clientName ?? "Deleted account"}</td>
                    <td>{row.readerName ?? "Deleted account"}</td>
                    <td>{row.type}</td>
                    <td>{row.messageCount}</td>
                    <td>{duration(row.durationSeconds)}</td>
                    <td>
                      <button
                        onClick={() => {
                          setOpen(row.id);
                        }}
                      >
                        Open transcript
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {moreError && <Notice tone="error">{moreError}</Notice>}
          {hasMore ? (
            <Button
              type="button"
              className="secondary"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : `Load more (showing ${String(rows.length)})`}
            </Button>
          ) : (
            <p className="muted">
              Showing all {rows.length} matching transcript{rows.length === 1 ? "" : "s"}.
            </p>
          )}
          </>
        ) : (
          <Empty title="No transcripts found">
            Chat transcripts appear here after a chat reading ends and
            Cloudflare sends the chat log. Voice and video readings are not
            recorded.
          </Empty>
        ))}
      {open && (
        <ReadingRecordModal
          readingId={open}
          onClose={() => {
            setOpen(null);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Content oversight

type QueueItem = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  postId: string | null;
  commentId: string | null;
  postTitle: string | null;
  body: string | null;
  contentStatus: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorRole: string;
  authorStatus: string;
  reporterName: string;
  automated: boolean;
  openReportsOnContent: number;
};

type ModerationAction = "dismiss" | "hide" | "remove" | "restore";

export function AdminModeration({ onChanged }: { onChanged: () => Promise<void> }) {
  const [status, setStatus] = useState<"open" | "dismissed" | "actioned">("open");
  const [suspend, setSuspend] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const load = useCallback(
    () => api<{ flags: QueueItem[] }>(`/admin/moderation/queue?status=${status}`),
    [status],
  );
  const queue = useReport(load);

  async function act(item: QueueItem, action: ModerationAction) {
    const suspendAuthor = Boolean(suspend[item.id]);
    if (
      suspendAuthor &&
      !window.confirm(`Also suspend ${item.authorName} (@${item.authorUsername})?`)
    )
      return;
    try {
      await api(`/admin/moderation/flags/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, suspendAuthor }),
      });
      setMessage({
        tone: "success",
        text: `Report ${action === "dismiss" ? "dismissed" : action === "restore" ? "dismissed and content restored" : `resolved and content ${action === "hide" ? "hidden" : "removed"}`}${suspendAuthor ? `; ${item.authorName} suspended` : ""}.`,
      });
      await Promise.all([queue.run(), onChanged()]);
    } catch (cause) {
      setMessage({ tone: "error", text: `Action failed: ${errorText(cause)}` });
    }
  }

  return (
    <>
      <p className="muted">
        New community posts and comments are scanned automatically for contact
        details, off-platform payment, outside links, guaranteed-outcome claims
        and possible self-harm. Matches land here as{" "}
        <strong>Automated scan</strong> reports; nothing is hidden until you
        act.
      </p>
      <div className="report-filters">
        <label>
          Show
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
            }}
          >
            <option value="open">Open reports</option>
            <option value="actioned">Actioned</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {queue.error && <Notice tone="error">{queue.error}</Notice>}
      {queue.busy && !queue.data && <Loading label="Loading reports…" />}
      {queue.data &&
        (queue.data.flags.length ? (
          <div className="moderation-queue">
            {queue.data.flags.map((item) => (
              <article key={item.id}>
                <header>
                  <span className={`badge ${item.automated ? "auto" : "user"}`}>
                    {item.automated ? "Automated scan" : `Reported by ${item.reporterName}`}
                  </span>
                  <small>
                    {item.postId ? "Post" : "Comment"} · {dateTime(item.createdAt)} ·
                    content {item.contentStatus}
                    {item.openReportsOnContent > 1
                      ? ` · ${String(item.openReportsOnContent)} open reports`
                      : ""}
                  </small>
                </header>
                <p className="reason">
                  {item.automated
                    ? item.reason.replace(/^Automated scan:\s*/, "Flagged for: ")
                    : item.reason}
                </p>
                <blockquote>
                  {item.postTitle && (
                    <strong>
                      {item.commentId ? `Comment on “${item.postTitle}”` : item.postTitle}
                    </strong>
                  )}
                  <span>{item.body ?? "(content no longer available)"}</span>
                </blockquote>
                <p className="author">
                  By {item.authorName} (@{item.authorUsername}) · {item.authorRole} ·{" "}
                  account {item.authorStatus}
                </p>
                {status === "open" ? (
                  <div className="row-actions">
                    {item.authorRole !== "admin" && item.authorStatus === "active" && (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={Boolean(suspend[item.id])}
                          onChange={(e) => {
                            setSuspend({ ...suspend, [item.id]: e.target.checked });
                          }}
                        />{" "}
                        Also suspend author
                      </label>
                    )}
                    <Button className="secondary" onClick={() => void act(item, "dismiss")}>
                      Dismiss
                    </Button>
                    <Button className="secondary" onClick={() => void act(item, "hide")}>
                      Hide
                    </Button>
                    <Button onClick={() => void act(item, "remove")}>Remove</Button>
                  </div>
                ) : (
                  item.contentStatus !== "visible" && (
                    <div className="row-actions">
                      <Button className="secondary" onClick={() => void act(item, "restore")}>
                        Restore content
                      </Button>
                    </div>
                  )
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty title={status === "open" ? "Moderation queue is clear" : "Nothing here yet"}>
            {status === "open"
              ? "There are no open community reports."
              : "Resolved reports will be listed here."}
          </Empty>
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Transaction history

type LedgerRow = {
  id: string;
  createdAt: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string | null;
  readingId: string | null;
  stripeReference: string | null;
  userName: string;
  username: string;
  email: string;
  role: string;
  actorName: string | null;
};

const LEDGER_TYPES = [
  "top_up",
  "reading_charge",
  "reader_earning",
  "refund",
  "adjustment",
  "payout",
  "message_charge",
  "message_earning",
];

export function AdminLedger() {
  const [filters, setFilters] = useState({ ...defaultRange(), type: "", q: "" });
  const [applied, setApplied] = useState(filters);
  const load = useCallback(() => {
    const params = new URLSearchParams({ from: applied.from, to: applied.to });
    if (applied.type) params.set("type", applied.type);
    if (applied.q) params.set("q", applied.q);
    return api<{ entries: LedgerRow[] }>(`/admin/ledger?${params.toString()}`);
  }, [applied]);
  const ledger = useReport(load);
  const entries = ledger.data?.entries ?? [];
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filters);
        }}
      >
        <DateRange
          value={filters}
          onChange={(range) => {
            setFilters({ ...filters, ...range });
          }}
        >
          <label>
            Type
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value });
              }}
            >
              <option value="">All types</option>
              {LEDGER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="grow">
            Person
            <input
              type="search"
              placeholder="Name, username or email"
              value={filters.q}
              onChange={(e) => {
                setFilters({ ...filters, q: e.target.value });
              }}
            />
          </label>
          <Button>Apply</Button>
          <Button
            type="button"
            className="secondary"
            disabled={!entries.length}
            onClick={() => {
              downloadCsv(
                `soulseer-transactions-${applied.from}-to-${applied.to}.csv`,
                toCsv(entries, [
                  { header: "Date (UTC)", value: (r) => r.createdAt },
                  { header: "Name", value: (r) => r.userName },
                  { header: "Username", value: (r) => r.username },
                  { header: "Email", value: (r) => r.email },
                  { header: "Role", value: (r) => r.role },
                  { header: "Type", value: (r) => r.type },
                  { header: "Amount (USD)", value: (r) => dollars(r.amount) },
                  { header: "Balance after (USD)", value: (r) => dollars(r.balanceAfter) },
                  { header: "Reason", value: (r) => r.reason },
                  { header: "Reading ID", value: (r) => r.readingId },
                  { header: "Stripe reference", value: (r) => r.stripeReference },
                  { header: "Done by", value: (r) => r.actorName },
                ]),
              );
            }}
          >
            Download CSV
          </Button>
        </DateRange>
      </form>
      {ledger.error && <Notice tone="error">{ledger.error}</Notice>}
      {ledger.busy && !ledger.data && <Loading label="Loading transactions…" />}
      {ledger.data &&
        (entries.length ? (
          <>
            <p className="muted">
              {entries.length.toLocaleString()} transaction
              {entries.length === 1 ? "" : "s"}
              {entries.length >= 5000 ? " (first 5,000 – narrow the dates to see more)" : ""}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Person</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row) => (
                    <tr key={row.id}>
                      <td>{dateTime(row.createdAt)}</td>
                      <td>
                        {row.userName}
                        <br />
                        <small>
                          @{row.username} · {row.role}
                        </small>
                      </td>
                      <td>{row.type.replaceAll("_", " ")}</td>
                      <td className={row.amount >= 0 ? "positive" : "negative"}>
                        {row.amount >= 0 ? "+" : ""}
                        {money(row.amount)}
                      </td>
                      <td>{money(row.balanceAfter)}</td>
                      <td>
                        {row.reason ?? "—"}
                        {row.actorName && <small> · by {row.actorName}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty title="No transactions in this range">
            Try a wider date range or clear the filters.
          </Empty>
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Revenue and tax reports

type RevenueTotals = {
  readingSales: number;
  messageSales: number;
  readerEarnings: number;
  refunds: number;
  readerReversals: number;
  manualAdjustments: number;
  topUps: number;
  payouts: number;
};
type RevenueReport = {
  totals: Partial<RevenueTotals>;
  periods: (RevenueTotals & { period: string })[];
  readingsByType: { type: string; count: number; seconds: number; revenue: number }[];
};

const n = (value: number | undefined) => value ?? 0;
const grossSales = (t: Partial<RevenueTotals>) =>
  n(t.readingSales) + n(t.messageSales);
// Platform keeps what clients paid minus Reader shares and client refunds,
// plus Reader shares clawed back by those refunds.
const platformNet = (t: Partial<RevenueTotals>) =>
  grossSales(t) - n(t.readerEarnings) - n(t.refunds) + n(t.readerReversals);

export function AdminRevenue() {
  const [filters, setFilters] = useState({ ...defaultRange(), groupBy: "day" });
  const [applied, setApplied] = useState(filters);
  const load = useCallback(
    () =>
      api<RevenueReport>(
        `/admin/reports/revenue?${new URLSearchParams(applied).toString()}`,
      ),
    [applied],
  );
  const report = useReport(load);
  const t = report.data?.totals ?? {};
  const periodLabel = (value: string) =>
    applied.groupBy === "month" ? monthLabel(value) : dayLabel(value);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filters);
        }}
      >
        <DateRange
          value={filters}
          onChange={(range) => {
            setFilters({ ...filters, ...range });
          }}
        >
          <label>
            Group by
            <select
              value={filters.groupBy}
              onChange={(e) => {
                setFilters({ ...filters, groupBy: e.target.value });
              }}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <Button>Run report</Button>
          <Button
            type="button"
            className="secondary"
            disabled={!report.data?.periods.length}
            onClick={() => {
              if (!report.data) return;
              downloadCsv(
                `soulseer-revenue-${applied.from}-to-${applied.to}.csv`,
                toCsv(report.data.periods, [
                  { header: `Period start (${applied.groupBy}, UTC)`, value: (r) => r.period.slice(0, 10) },
                  { header: "Gross sales (USD)", value: (r) => dollars(grossSales(r)) },
                  { header: "Reading sales (USD)", value: (r) => dollars(r.readingSales) },
                  { header: "Message sales (USD)", value: (r) => dollars(r.messageSales) },
                  { header: "Reader earnings (USD)", value: (r) => dollars(r.readerEarnings) },
                  { header: "Client refunds (USD)", value: (r) => dollars(r.refunds) },
                  { header: "Reader shares reversed (USD)", value: (r) => dollars(r.readerReversals) },
                  { header: "Platform net (USD)", value: (r) => dollars(platformNet(r)) },
                  { header: "Wallet top-ups (USD)", value: (r) => dollars(r.topUps) },
                  { header: "Reader payouts (USD)", value: (r) => dollars(r.payouts) },
                  { header: "Manual adjustments (USD)", value: (r) => dollars(r.manualAdjustments) },
                ]),
              );
            }}
          >
            Download CSV
          </Button>
        </DateRange>
      </form>
      {report.error && <Notice tone="error">{report.error}</Notice>}
      {report.busy && !report.data && <Loading label="Running report…" />}
      {report.data && (
        <>
          <Tiles
            items={[
              { label: "Gross sales", value: money(grossSales(t)), note: "What clients spent on readings and messages" },
              { label: "Reader earnings", value: money(n(t.readerEarnings)), note: "70% Reader share" },
              { label: "Client refunds", value: money(n(t.refunds)) },
              { label: "Platform net revenue", value: money(platformNet(t)), note: "After Reader shares and refunds" },
              { label: "Wallet top-ups", value: money(n(t.topUps)), note: "Money added by clients" },
              { label: "Reader payouts", value: money(n(t.payouts)), note: "Sent to Readers via Stripe" },
            ]}
          />
          {report.data.readingsByType.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Reading type</th>
                    <th>Completed</th>
                    <th>Minutes</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.readingsByType.map((row) => (
                    <tr key={row.type}>
                      <td>{row.type}</td>
                      <td>{row.count}</td>
                      <td>{Math.round(row.seconds / 60).toLocaleString()}</td>
                      <td>{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report.data.periods.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Gross sales</th>
                    <th>Reader earnings</th>
                    <th>Refunds</th>
                    <th>Platform net</th>
                    <th>Top-ups</th>
                    <th>Payouts</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.periods.map((row) => (
                    <tr key={row.period}>
                      <td>{periodLabel(row.period)}</td>
                      <td>{money(grossSales(row))}</td>
                      <td>{money(row.readerEarnings)}</td>
                      <td>{money(row.refunds)}</td>
                      <td>{money(platformNet(row))}</td>
                      <td>{money(row.topUps)}</td>
                      <td>{money(row.payouts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No money moved in this range">
              Try a wider date range.
            </Empty>
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Analytics

type MonthRow = {
  month: string;
  newClients: number;
  newReaders: number;
  readings: number;
  unsuccessfulReadings: number;
  activeClients: number;
  readingSeconds: number;
  grossSales: number;
  forumPosts: number;
};
type Analytics = {
  monthly: MonthRow[];
  kpis: Partial<{
    readings30d: number;
    unsuccessful30d: number;
    activeClients30d: number;
    avgSeconds30d: number;
    avgReadingValue30d: number;
    repeatClients: number;
    clientsWithReadings: number;
    averageRating: number;
    reviewCount: number;
    readersOnlineNow: number;
  }>;
  usersByRole: { role: string; count: number }[];
};

const percent = (part: number, whole: number) =>
  whole ? `${String(Math.round((part / whole) * 100))}%` : "—";

export function AdminAnalytics() {
  const [months, setMonths] = useState(12);
  const load = useCallback(() => api<Analytics>(`/admin/analytics?months=${String(months)}`), [months]);
  const report = useReport(load);
  const data = report.data;
  const k = data?.kpis ?? {};
  const roleCount = (role: string) =>
    data?.usersByRole.find((r) => r.role === role)?.count ?? 0;
  const monthly = data?.monthly ?? [];
  // The current month is still in progress, so the trend uses completed
  // months only and the projection starts with next month.
  const forecast = linearForecast(
    monthly.slice(0, -1).map((m) => m.grossSales),
    4,
  ).slice(1);
  const lastMonth = monthly.at(-1)?.month;
  const forecastPoints = forecast.map((value, i) => {
    const base = lastMonth ? new Date(lastMonth) : new Date();
    return {
      label: monthLabel(
        new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i + 1, 1)).toISOString(),
      ),
      value,
      projected: true,
    };
  });
  const finished = n(k.readings30d) + n(k.unsuccessful30d);
  return (
    <>
      <div className="report-filters">
        <label>
          Period
          <select
            value={months}
            onChange={(e) => {
              setMonths(Number(e.target.value));
            }}
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </label>
      </div>
      {report.error && <Notice tone="error">{report.error}</Notice>}
      {report.busy && !data && <Loading label="Loading analytics…" />}
      {data && (
        <>
          <h3 className="report-heading">Engagement (last 30 days)</h3>
          <Tiles
            items={[
              { label: "Clients", value: roleCount("client").toLocaleString(), note: `${String(roleCount("reader"))} Readers` },
              { label: "Active clients", value: n(k.activeClients30d).toLocaleString(), note: "Had a completed reading" },
              { label: "Completed readings", value: n(k.readings30d).toLocaleString() },
              {
                label: "Repeat clients",
                value: percent(n(k.repeatClients), n(k.clientsWithReadings)),
                note: "All time, 2+ readings",
              },
            ]}
          />
          <h3 className="report-heading">Platform performance (last 30 days)</h3>
          <Tiles
            items={[
              { label: "Reading success rate", value: percent(n(k.readings30d), finished), note: `${String(n(k.unsuccessful30d))} failed or cancelled` },
              { label: "Average reading length", value: duration(n(k.avgSeconds30d)) },
              { label: "Average reading value", value: money(n(k.avgReadingValue30d)) },
              {
                label: "Average rating (all time)",
                value: k.reviewCount ? `${n(k.averageRating).toFixed(2)} ★` : "—",
                note: `${String(n(k.reviewCount))} reviews · ${String(n(k.readersOnlineNow))} Readers online now`,
              },
            ]}
          />
          <h3 className="report-heading">Growth</h3>
          <div className="chart-grid">
            <BarChart
              title="Gross sales by month"
              subtitle={
                forecastPoints.length
                  ? "Lighter bars are a straight-line projection from the months with sales – a rough guide, not a promise."
                  : "A projection appears once there are three months of sales."
              }
              format={money}
              points={[
                ...monthly.map((m, i) => ({
                  label: monthLabel(m.month),
                  value: m.grossSales,
                  partial: i === monthly.length - 1,
                })),
                ...forecastPoints,
              ]}
            />
            <BarChart
              title="Completed readings by month"
              format={(v) => v.toLocaleString()}
              points={monthly.map((m, i) => ({
                label: monthLabel(m.month),
                value: m.readings,
                partial: i === monthly.length - 1,
              }))}
            />
            <BarChart
              title="New clients by month"
              format={(v) => v.toLocaleString()}
              points={monthly.map((m, i) => ({
                label: monthLabel(m.month),
                value: m.newClients,
                partial: i === monthly.length - 1,
              }))}
            />
            <BarChart
              title="Active clients by month"
              subtitle="Clients with at least one completed reading"
              format={(v) => v.toLocaleString()}
              points={monthly.map((m, i) => ({
                label: monthLabel(m.month),
                value: m.activeClients,
                partial: i === monthly.length - 1,
              }))}
            />
          </div>
          <details className="table-view">
            <summary>Monthly numbers as a table</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>New clients</th>
                    <th>New Readers</th>
                    <th>Completed readings</th>
                    <th>Failed / cancelled</th>
                    <th>Active clients</th>
                    <th>Reading minutes</th>
                    <th>Gross sales</th>
                    <th>Forum posts</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month}>
                      <td>{monthLabel(m.month)}</td>
                      <td>{m.newClients}</td>
                      <td>{m.newReaders}</td>
                      <td>{m.readings}</td>
                      <td>{m.unsuccessfulReadings}</td>
                      <td>{m.activeClients}</td>
                      <td>{Math.round(m.readingSeconds / 60).toLocaleString()}</td>
                      <td>{money(m.grossSales)}</td>
                      <td>{m.forumPosts}</td>
                    </tr>
                  ))}
                  {forecastPoints.map((p) => (
                    <tr key={p.label} className="projected">
                      <td>{p.label} (projected)</td>
                      <td colSpan={6} />
                      <td>{money(p.value)}</td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}

type Point = { label: string; value: number; projected?: boolean; partial?: boolean };
const pointName = (p: Point) =>
  `${p.label}${p.projected ? " (projected)" : p.partial ? " (month to date)" : ""}`;

// Column with 4px rounded top corners, square at the baseline.
const barPath = (x: number, y: number, w: number, h: number, r: number) =>
  [
    `M${String(x)},${String(y + h)}`,
    `V${String(y + r)}`,
    `Q${String(x)},${String(y)} ${String(x + r)},${String(y)}`,
    `H${String(x + w - r)}`,
    `Q${String(x + w)},${String(y)} ${String(x + w)},${String(y + r)}`,
    `V${String(y + h)}`,
    "Z",
  ].join(" ");

const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
};

// Single-series column chart: one hue, 4px rounded tops, hairline grid,
// hover/focus readout, and every value also available in the table view.
export function BarChart({
  title,
  subtitle,
  points,
  format,
}: {
  title: string;
  subtitle?: string;
  points: Point[];
  format: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const width = 560;
  const height = 200;
  const pad = { top: 12, right: 64, bottom: 26, left: 8 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const band = points.length ? plotW / points.length : plotW;
  const barW = Math.min(24, Math.max(4, band - 4));
  const labelEvery = Math.ceil(points.length / 8);
  const shown = active !== null ? points[active] : points.filter((p) => !p.projected).at(-1);
  return (
    <figure className="bar-chart">
      <figcaption>
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
        <span className="readout" aria-live="polite">
          {shown
            ? `${pointName(shown)}: ${format(shown.value)}`
            : "No data"}
        </span>
      </figcaption>
      <svg viewBox={[0, 0, width, height].join(" ")} role="img" aria-label={title}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              className="grid"
              x1={pad.left}
              x2={width - pad.right}
              y1={pad.top + plotH * (1 - f)}
              y2={pad.top + plotH * (1 - f)}
            />
            {f > 0 && (
              <text className="tick" x={width - pad.right + 6} y={pad.top + plotH * (1 - f) + 4} textAnchor="start">
                {format(max * f)}
              </text>
            )}
          </g>
        ))}
        {points.map((p, i) => {
          const h = (p.value / max) * plotH;
          const x = pad.left + band * i + (band - barW) / 2;
          const y = pad.top + plotH - h;
          const r = Math.min(4, h, barW / 2);
          return (
            <g
              key={p.label}
              tabIndex={0}
              onMouseEnter={() => {
                setActive(i);
              }}
              onMouseLeave={() => {
                setActive(null);
              }}
              onFocus={() => {
                setActive(i);
              }}
              onBlur={() => {
                setActive(null);
              }}
            >
              <title>{`${pointName(p)}: ${format(p.value)}`}</title>
              <rect className="hit" x={pad.left + band * i} y={pad.top} width={band} height={plotH} />
              {h > 0 && (
                <path
                  className={`bar${p.projected ? " projected" : ""}${active === i ? " active" : ""}`}
                  d={barPath(x, y, barW, h, r)}
                />
              )}
              {i % labelEvery === 0 && (
                <text className="tick" x={x + barW / 2} y={height - 8} textAnchor="middle">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
