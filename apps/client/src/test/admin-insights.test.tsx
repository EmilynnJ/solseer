import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { linearForecast } from "../lib/forecast";
import { toCsv } from "../lib/csv";
import { AdminModeration, BarChart } from "../components/admin-insights";

const api = vi.hoisted(() => vi.fn());
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  api,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

it("projects a steady trend and needs three months of sales", () => {
  expect(linearForecast([0, 0, 100, 200, 300], 2)).toEqual([400, 500]);
  expect(linearForecast([0, 100, 200])).toEqual([]);
  expect(linearForecast([0, 100, 200, 300])).toEqual([400, 500, 600]);
  expect(linearForecast([0, 0, 100, 200])).toEqual([]);
  expect(linearForecast([300, 200, 100], 3)).toEqual([0, 0, 0]);
});

it("escapes CSV cells and neutralises spreadsheet formulas", () => {
  const csv = toCsv(
    [{ name: '=HYPERLINK("x")', note: "a, b", amount: -5 }],
    [
      { header: "Name", value: (r) => r.name },
      { header: "Note", value: (r) => r.note },
      { header: "Amount", value: (r) => r.amount },
    ],
  );
  expect(csv).toBe('Name,Note,Amount\r\n"\'=HYPERLINK(""x"")","a, b",-5');
});

it("labels bars and shows the hovered value", () => {
  render(
    <BarChart
      title="Gross sales by month"
      format={(v) => `$${String(v)}`}
      points={[
        { label: "Jan 26", value: 10 },
        { label: "Feb 26", value: 30 },
        { label: "Mar 26", value: 20, projected: true },
      ]}
    />,
  );
  expect(screen.getByText("Feb 26: $30", { selector: ".readout" })).toBeInTheDocument();
  fireEvent.mouseEnter(screen.getByText("Mar 26 (projected): $20", { selector: "title" }).parentElement as Element);
  expect(screen.getByText("Mar 26 (projected): $20", { selector: ".readout" })).toBeInTheDocument();
});

it("shows reported content and hides it with the author suspended", async () => {
  const flag = {
    id: "flag-1",
    reason: "Automated scan: off-platform payment",
    status: "open",
    createdAt: "2026-10-01T10:00:00Z",
    postId: "post-1",
    commentId: null,
    postTitle: "Pay me direct",
    body: "Send it to my Cash App",
    contentStatus: "visible",
    authorId: "user-1",
    authorName: "Spammy",
    authorUsername: "spammy",
    authorRole: "client",
    authorStatus: "active",
    reporterName: "Spammy",
    automated: true,
    openReportsOnContent: 1,
  };
  api.mockImplementation((path: string) =>
    Promise.resolve(path.startsWith("/admin/moderation/queue") ? { flags: [flag] } : {}),
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(<AdminModeration onChanged={onChanged} />);
  expect(await screen.findByText("Send it to my Cash App")).toBeInTheDocument();
  expect(screen.getByText("Automated scan", { selector: ".badge" })).toBeInTheDocument();
  expect(screen.getByText("Flagged for: off-platform payment")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Also suspend author"));
  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  await waitFor(() => {
    expect(api).toHaveBeenCalledWith("/admin/moderation/flags/flag-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "hide", suspendAuthor: true }),
    });
  });
  expect(onChanged).toHaveBeenCalled();
});
