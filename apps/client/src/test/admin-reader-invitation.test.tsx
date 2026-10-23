import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DashboardPage } from "../pages/dashboard";
import { ApiError } from "../lib/api";

const mocks = vi.hoisted(() => ({ api: vi.fn(), refresh: vi.fn(), createUser: vi.fn() }));
vi.mock("../lib/api", async (original) => ({ ...await original<typeof import("../lib/api")>(), api: mocks.api }));
vi.mock("../lib/auth", () => ({ authClient: { admin: { createUser: mocks.createUser } }, getAccessToken: vi.fn() }));
vi.mock("../lib/posthog", () => ({ posthog: { capture: vi.fn() } }));
vi.mock("../components/auth-context", () => ({
  useSoulAuth: () => ({ me: { user: { role: "admin", fullName: "Admin" } } }),
}));
vi.mock("../hooks/use-api", () => ({
  useApiData: () => ({ data: { users: [], readings: [], readers: [], flags: [] }, refresh: mocks.refresh }),
}));

function open() {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "readers" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Reader" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
  fireEvent.change(screen.getByLabelText("Reader username"), { target: { value: "test_reader" } });
}
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("creates an invitation link without creating a password account or requiring clipboard access", async () => {
  mocks.api.mockResolvedValue({ inviteUrl: "https://www.soul-seer.net/login?readerInvite=test-token" });
  open();
  expect(screen.queryByLabelText("Temporary password")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create Reader invitation" }));
  expect(await screen.findByLabelText("Reader invitation link")).toHaveValue("https://www.soul-seer.net/login?readerInvite=test-token");
  expect(mocks.api).toHaveBeenCalledWith("/admin/readers", {
    method: "POST",
    body: JSON.stringify({ email: "reader@example.com", fullName: "Test Reader", username: "test_reader", pricing: { chat: 500, voice: 700, video: 1000 }, verified: false }),
  });
  expect(mocks.createUser).not.toHaveBeenCalled();
});

it("keeps the form available and displays account conflicts without a success link", async () => {
  mocks.api.mockRejectedValue(new ApiError("An account with this email already exists.", 409, "ACCOUNT_EXISTS"));
  open();
  fireEvent.click(screen.getByRole("button", { name: "Create Reader invitation" }));
  expect(await screen.findByText(/Reader invitation failed: An account/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Create Reader invitation" })).toBeEnabled());
  expect(screen.getByLabelText("Email address")).toHaveValue("reader@example.com");
  expect(screen.queryByLabelText("Reader invitation link")).not.toBeInTheDocument();
});
