import { useCallback, useState } from "react";
import { useApiData } from "../hooks/use-api";
import { api, dateTime } from "../lib/api";
import { Button, Empty, Loading, Notice } from "./ui";

type SecurityAccount = {
  authUserId: string;
  name: string;
  email: string;
  createdAt: string;
  emailVerified: boolean;
  authRole: string | null;
  profileId: string | null;
  profileRole: string | null;
  hasActiveSession: boolean;
};
type SecurityEvent = {
  id: string;
  authUserId: string;
  eventType: string;
  occurredAt: string;
  observedAt: string;
};
type SecurityResponse = { accounts: SecurityAccount[]; activity: SecurityEvent[] };
const labels: Record<string, string> = {
  auth_account_created: "Auth account created",
  auth_email_verified_observed: "Verified email observed",
  auth_session_observed: "Session observed",
  app_profile_created: "Application profile created",
};

export function AdminSecurity() {
  const [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(
    () => api<SecurityResponse>(selected
      ? `/admin/security/activity?authUserId=${encodeURIComponent(selected)}`
      : "/admin/security/activity"),
    [selected],
  );
  const report = useApiData(load, [load]);
  return (
    <>
      <p className="muted">Auth identities include people who never completed registration. Observed events are reconciled from database records; this is not a complete provider request history.</p>
      <div className="row-actions">
        <Button type="button" onClick={() => void report.refresh()}>Refresh</Button>
        {selected && <Button type="button" className="secondary" onClick={() => setSelected(null)}>All accounts</Button>}
      </div>
      {report.error && <Notice tone="error">{report.error}</Notice>}
      {report.loading && <Loading label="Loading security activity…" />}
      {!report.loading && report.data && (
        <>
          <h3>Authentication accounts (latest 100)</h3>
          {report.data.accounts.length ? <div className="table-scroll"><table>
            <thead><tr><th>Account</th><th>Created</th><th>Verified</th><th>Profile</th><th>Auth role</th><th>Active session</th><th /></tr></thead>
            <tbody>{report.data.accounts.map((account) => <tr key={account.authUserId}>
              <td>{account.name}<br />{account.email}<br /><small>{account.authUserId}</small></td>
              <td>{dateTime(account.createdAt)}</td>
              <td>{account.emailVerified ? "Yes" : "No"}</td>
              <td>{account.profileId ? account.profileRole : "No application profile"}</td>
              <td>{account.authRole ?? "—"}</td>
              <td>{account.hasActiveSession ? "Yes" : "No"}</td>
              <td><button type="button" onClick={() => setSelected(account.authUserId)}>Activity</button></td>
            </tr>)}</tbody>
          </table></div> : <Empty title="No matching Auth accounts" />}
          <h3>Observed security events (latest 200)</h3>
          {report.data.activity.length ? <div className="table-scroll"><table>
            <thead><tr><th>Event</th><th>Auth user ID</th><th>Record timestamp</th><th>Observed at</th></tr></thead>
            <tbody>{report.data.activity.map((event) => <tr key={event.id}>
              <td>{labels[event.eventType] ?? event.eventType}</td>
              <td><button type="button" onClick={() => setSelected(event.authUserId)}>{event.authUserId}</button></td>
              <td>{dateTime(event.occurredAt)}</td><td>{dateTime(event.observedAt)}</td>
            </tr>)}</tbody>
          </table></div> : <Empty title="No observed events yet">The scheduled reconciliation must run before this list is populated.</Empty>}
        </>
      )}
    </>
  );
}
