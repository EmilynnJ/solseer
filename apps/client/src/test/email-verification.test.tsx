import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Protected, SoulAuthProvider } from "../components/auth-context";
import { LoginPage } from "../pages/login";
import { ApiError } from "../lib/api";

const mocks = vi.hoisted(() => ({
  session: { data: null as null | { user: { id: string; email: string; name: string } }, isPending: false },
  api: vi.fn(),
  signIn: vi.fn(),
  sendVerification: vi.fn(),
  verifyEmail: vi.fn(),
}));
vi.mock("../lib/auth", () => ({
  authClient: {
    useSession: () => mocks.session,
    signIn: { email: mocks.signIn },
    sendVerificationEmail: mocks.sendVerification,
    emailOtp: { verifyEmail: mocks.verifyEmail },
  },
  getAccessToken: vi.fn(),
}));
vi.mock("../lib/api", async (original) => ({
  ...(await original<typeof import("../lib/api")>()),
  api: mocks.api,
}));
vi.mock("../lib/posthog", () => ({ posthog: { reset: vi.fn(), identify: vi.fn() } }));

function open(path = "/login") {
  render(<MemoryRouter initialEntries={[path]}><SoulAuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<Protected><h1>Reader dashboard</h1></Protected>} />
  </Routes></SoulAuthProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.data = null;
  mocks.sendVerification.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); vi.restoreAllMocks(); });

it("lets a reader enter an existing code without browser storage or another email", () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Verify email / enter code" }));
  expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
  expect(mocks.sendVerification).not.toHaveBeenCalled();
});

it("opens the verification URL in a new tab without stored state", () => {
  open("/login?verify=1");
  expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
});

it("recovers from the dashboard's EMAIL_NOT_VERIFIED response and returns after verification", async () => {
  mocks.session.data = { user: { id: "auth-reader", email: "reader@example.com", name: "Reader" } };
  mocks.api.mockRejectedValue(new ApiError("Verify your email address to continue.", 403, "EMAIL_NOT_VERIFIED"));
  mocks.verifyEmail.mockImplementation(async () => {
    mocks.api.mockResolvedValue({ user: { id: "reader", role: "reader", fullName: "Reader" }, reader: {}, balance: 0 });
    return { data: { user: { emailVerified: true } } };
  });
  open("/dashboard");
  fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } });
  expect(screen.getByLabelText("Email address")).toHaveValue("reader@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  expect(await screen.findByRole("heading", { name: "Reader dashboard" })).toBeInTheDocument();
  expect(mocks.verifyEmail).toHaveBeenCalledWith({ email: "reader@example.com", otp: "123456" });
  expect(mocks.api.mock.calls.every(([path]) => path === "/auth/me")).toBe(true);
});

it("keeps code entry available when sending an email fails and storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  mocks.signIn.mockResolvedValue({ data: { user: { emailVerified: false } } });
  mocks.sendVerification.mockResolvedValue({ error: { message: "Please wait before requesting another code." } });
  open();
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Please wait before requesting another code.")).toBeInTheDocument());
});

it("requests the configured verification email when Neon rejects an unverified sign-in", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" } });
  open("/login?reset=success");
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("button", { name: "Send verification email" })).toBeInTheDocument();
  await waitFor(() => expect(mocks.sendVerification).toHaveBeenCalledTimes(1));
  expect(mocks.sendVerification.mock.calls[0]![0].email).toBe("reader@example.com");
  const callback = new URL(mocks.sendVerification.mock.calls[0]![0].callbackURL);
  expect(callback.pathname).toBe("/login");
  expect(callback.searchParams.get("emailVerified")).toBe("1");
  expect(callback.searchParams.get("returnTo")).toBe("/dashboard");
});

it("resends a link without signing in and preserves the reader invitation in its callback", async () => {
  open("/login?verify=1&readerInvite=reader-invite");
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send verification email" }));
  await waitFor(() => expect(mocks.sendVerification).toHaveBeenCalledTimes(1));
  const callback = new URL(mocks.sendVerification.mock.calls[0]![0].callbackURL);
  expect(callback.searchParams.get("readerInvite")).toBe("reader-invite");
  expect(mocks.signIn).not.toHaveBeenCalled();
});

it("leaves verification mode after returning from the email link", async () => {
  sessionStorage.setItem("soulseer.pendingVerificationEmail", "reader@example.com");
  open("/login?emailVerified=1");
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  await waitFor(() => expect(sessionStorage.getItem("soulseer.pendingVerificationEmail")).toBeNull());
});

it("does not send verification email for an incorrect password", async () => {
  mocks.signIn.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" } });
  open();
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  expect(mocks.sendVerification).not.toHaveBeenCalled();
});
