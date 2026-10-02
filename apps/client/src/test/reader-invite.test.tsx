import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { LoginPage } from "../pages/login";

const signUp = vi.hoisted(() => vi.fn<(input: { callbackURL: string }) => Promise<unknown>>().mockResolvedValue({ data: { user: { emailVerified: true } } }));
vi.mock("../components/auth-context", () => ({
  useSoulAuth: () => ({ me: null, sessionUser: null, needsProfile: false }),
}));
vi.mock("../lib/auth", () => ({ authClient: { signUp: { email: signUp } } }));
vi.mock("../lib/api", () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });

it.each(["readerInvite", "invite"])("opens signup for a %s link", (key) => {
  render(<MemoryRouter initialEntries={[`/login?${key}=test-invitation`]}><LoginPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Create your reader account" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
});

it("keeps ordinary login on sign in", () => {
  render(<MemoryRouter initialEntries={["/login"]}><LoginPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
});

it("preserves reader invitation and return destination in the email signup callback", async () => {
  render(<MemoryRouter initialEntries={["/login?readerInvite=test-invitation&returnTo=%2Fdashboard"]}><LoginPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Reader" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
  const callback = new URL(signUp.mock.calls[0]![0].callbackURL);
  expect(callback.searchParams.get("readerInvite")).toBe("test-invitation");
  expect(callback.searchParams.get("returnTo")).toBe("/dashboard");
});
