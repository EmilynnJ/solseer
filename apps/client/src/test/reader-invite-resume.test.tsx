import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { LoginPage } from "../pages/login";

const authState = vi.hoisted(() => ({ needsProfile: false }));
const api = vi.hoisted(() => vi.fn<(path: string, init: { body: string }) => Promise<unknown>>().mockResolvedValue({ id: "user-1" }));
vi.mock("../components/auth-context", () => ({
  useSoulAuth: () => ({
    me: null,
    sessionUser: authState.needsProfile ? { id: "neon-1", email: "reader@example.com", name: "Test Reader" } : null,
    needsProfile: authState.needsProfile,
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../lib/auth", () => ({ authClient: {} }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  api,
}));
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); authState.needsProfile = false; vi.clearAllMocks(); });

it("keeps the reader invitation when the profile is completed later without the link", async () => {
  render(<MemoryRouter initialEntries={["/login?readerInvite=test-invitation"]}><LoginPage /></MemoryRouter>);
  cleanup();

  authState.needsProfile = true;
  render(<MemoryRouter initialEntries={["/login?complete=1"]}><LoginPage /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Community username"), { target: { value: "test_reader" } });
  fireEvent.click(screen.getByRole("button", { name: "Enter SoulSeer" }));

  await waitFor(() => { expect(api).toHaveBeenCalledTimes(1); });
  const body = JSON.parse(api.mock.calls[0]?.[1].body ?? "{}") as { readerInviteToken?: string };
  expect(body.readerInviteToken).toBe("test-invitation");
  expect(localStorage.getItem("soulseer.pendingReaderInvite")).toBeNull();
});

it("creates an ordinary client profile when no invitation was opened", async () => {
  authState.needsProfile = true;
  render(<MemoryRouter initialEntries={["/login?complete=1"]}><LoginPage /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Community username"), { target: { value: "test_client" } });
  fireEvent.click(screen.getByRole("button", { name: "Enter SoulSeer" }));
  await waitFor(() => { expect(api).toHaveBeenCalledTimes(1); });
  const body = JSON.parse(api.mock.calls[0]?.[1].body ?? "{}") as { readerInviteToken?: string };
  expect(body.readerInviteToken).toBeUndefined();
});

it("drops an invitation the server rejects so the user is not stuck", async () => {
  const { ApiError } = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  api.mockRejectedValueOnce(new ApiError("This Reader invitation is invalid or expired.", 400, "INVALID_READER_INVITE"));
  render(<MemoryRouter initialEntries={["/login?readerInvite=expired-invitation"]}><LoginPage /></MemoryRouter>);
  cleanup();

  authState.needsProfile = true;
  render(<MemoryRouter initialEntries={["/login?complete=1"]}><LoginPage /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Community username"), { target: { value: "test_client" } });
  fireEvent.click(screen.getByRole("button", { name: "Enter SoulSeer" }));
  expect(await screen.findByText(/invalid, expired, or was sent to a different email/)).toBeInTheDocument();
  expect(localStorage.getItem("soulseer.pendingReaderInvite")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Enter SoulSeer" }));
  await waitFor(() => { expect(api).toHaveBeenCalledTimes(2); });
  const retry = JSON.parse(api.mock.calls[1]?.[1].body ?? "{}") as { readerInviteToken?: string };
  expect(retry.readerInviteToken).toBeUndefined();
});
