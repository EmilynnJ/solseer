import { StrictMode, type ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadingPage } from "../pages/reading";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  init: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  ui: vi.fn(),
  refresh: vi.fn(),
  detailError: null as string | null,
  userId: "client-1",
  role: "client",
}));

const detail = {
  reading: {
    id: "reading-1",
    type: "video",
    status: "active",
    pricePerMinute: 100,
    durationSeconds: 0,
    totalPrice: 0,
    startedAt: "2026-09-03T12:00:00Z",
    completedAt: null,
    clientId: "client-1",
    readerId: "reader-1",
  },
  events: [],
  balance: 1000,
};
const instance = { join: mocks.join, leave: mocks.leave };

vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  api: mocks.api,
}));
// Telemetry is an external side effect and requires browser-only configuration.
vi.mock("../lib/posthog", () => ({ posthog: { capture: vi.fn() } }));
vi.mock("../hooks/use-api", () => ({
  useApiData: () => ({
    data: detail,
    loading: false,
    error: mocks.detailError,
    refresh: mocks.refresh,
  }),
}));
vi.mock("../components/auth-context", () => ({
  useSoulAuth: () => ({ me: { user: { id: mocks.userId, role: mocks.role } } }),
}));
vi.mock("@cloudflare/realtimekit-react", async () => {
  const { useCallback, useState } = await import("react");
  return {
    RealtimeKitProvider: ({ children }: { children: ReactNode }) => children,
    useRealtimeKitClient: () => {
      const [meeting, setMeeting] = useState<typeof instance>();
      const init = useCallback(async () => {
        const result = (await mocks.init()) as typeof instance;
        setMeeting(result);
        return result;
      }, []);
      return [meeting, init];
    },
  };
});
vi.mock("@cloudflare/realtimekit-react-ui", () => ({
  RtkMeeting: (props: { mode?: string; leaveOnUnmount?: boolean }) => {
    mocks.ui(props);
    return <div aria-label="Private meeting" />;
  },
}));

function page(strict = false) {
  const content = (
    <MemoryRouter initialEntries={["/readings/reading-1"]}>
      <Routes>
        <Route path="/readings/:id" element={<ReadingPage />} />
      </Routes>
    </MemoryRouter>
  );
  return strict ? <StrictMode>{content}</StrictMode> : content;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.detailError = null;
  mocks.userId = "client-1";
  mocks.role = "client";
  detail.reading.status = "active";
  mocks.api.mockResolvedValue({ participantToken: "participant-token" });
  mocks.init.mockResolvedValue(instance);
  mocks.join.mockResolvedValue(undefined);
  mocks.leave.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("reading review permissions", () => {
  it("lets the assigned client review an ended reading", () => {
    detail.reading.status = "ended";
    render(page());
    expect(
      screen.getByRole("button", { name: "Share review" }),
    ).toBeInTheDocument();
  });

  it("does not ask the assigned reader to review their own reading", () => {
    detail.reading.status = "ended";
    mocks.userId = "reader-1";
    mocks.role = "reader";
    render(page());
    expect(
      screen.queryByRole("button", { name: "Share review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "5 stars" }),
    ).not.toBeInTheDocument();
  });

  it("allows a reader account to review when it is the client in this reading", () => {
    detail.reading.status = "ended";
    mocks.role = "reader";
    render(page());
    expect(
      screen.getByRole("button", { name: "Share review" }),
    ).toBeInTheDocument();
  });

  it("does not offer reviews to an unrelated account", () => {
    detail.reading.status = "ended";
    mocks.userId = "other-client";
    render(page());
    expect(
      screen.queryByRole("button", { name: "Share review" }),
    ).not.toBeInTheDocument();
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("reading connection lifecycle", () => {
  it("leaves joining to the meeting UI instead of issuing a second join", async () => {
    render(page());
    await screen.findByLabelText("Private meeting");
    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(mocks.join).not.toHaveBeenCalled();
  });

  it("contains the meeting below session controls and enables departure on unmount", async () => {
    render(page());
    await screen.findByLabelText("Private meeting");
    expect(mocks.ui).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "fill", leaveOnUnmount: true }),
    );
  });

  it("keeps the existing connection through a failed detail poll and recovery", async () => {
    const view = render(page());
    await screen.findByLabelText("Private meeting");
    mocks.detailError = "Temporary network failure";
    view.rerender(page());
    expect(
      screen.getByRole("button", { name: "End session" }),
    ).toBeInTheDocument();
    mocks.detailError = null;
    view.rerender(page());
    await screen.findByLabelText("Private meeting");
    expect(mocks.init).toHaveBeenCalledTimes(1);
  });

  it("shows an end-request failure instead of leaving an unhandled rejection", async () => {
    render(page());
    await screen.findByLabelText("Private meeting");
    mocks.api.mockRejectedValueOnce(new Error("Unable to end reading; retry."));
    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    expect(mocks.api).toHaveBeenCalledWith("/readings/reading-1/end", {
      method: "POST",
    });
    expect(
      await screen.findByText("Unable to end reading; retry.", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(mocks.leave).not.toHaveBeenCalled();
  });

  it("disposes an SDK instance that finishes initialization after navigation away", async () => {
    let resolve!: (value: typeof instance) => void;
    mocks.init.mockReturnValue(
      new Promise<typeof instance>((done) => {
        resolve = done;
      }),
    );
    const view = render(page());
    await waitFor(() => {
      expect(mocks.init).toHaveBeenCalledTimes(1);
    });
    view.unmount();
    await act(async () => {
      resolve(instance);
      await Promise.resolve();
    });
    expect(mocks.leave).toHaveBeenCalledTimes(1);
    expect(mocks.join).not.toHaveBeenCalled();
  });

  it("does not cancel the only initialization during StrictMode effect replay", async () => {
    render(page(true));
    await screen.findByLabelText("Private meeting");
    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(mocks.leave).not.toHaveBeenCalled();
  });
});
