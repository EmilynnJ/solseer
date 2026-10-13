import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ResetPasswordPage } from "../pages/reset-password";
import { LoginPage } from "../pages/login";

const resetPassword = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { status: true }, error: null }));
const requestPasswordReset = vi.hoisted(() => vi.fn<(input: { email: string; redirectTo: string }) => Promise<unknown>>().mockResolvedValue({ data: { status: true }, error: null }));
vi.mock("../components/auth-context", () => ({
  useSoulAuth: () => ({ me: null, sessionUser: null, needsProfile: false }),
}));
vi.mock("../lib/auth", () => ({ authClient: { resetPassword, requestPasswordReset } }));
vi.mock("../lib/api", () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

it("resets the password with the token from the email link and returns to sign in", async () => {
  renderAt("/reset-password?token=abc123");
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-1" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-password-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  await waitFor(() => { expect(resetPassword).toHaveBeenCalledWith({ newPassword: "new-password-1", token: "abc123" }); });
  expect(await screen.findByText("Password updated. Sign in with your new password.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
});

it("rejects mismatched passwords without calling Neon Auth", () => {
  renderAt("/reset-password?token=abc123");
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-1" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-pass" } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  expect(resetPassword).not.toHaveBeenCalled();
});

it.each(["/reset-password", "/reset-password?error=INVALID_TOKEN"])("explains an invalid link at %s", (path) => {
  renderAt(path);
  expect(screen.getByText(/invalid or has expired/)).toBeInTheDocument();
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});

it("sends reset emails to the reset-password page", async () => {
  renderAt("/login?forgot=1");
  expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "client@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  await waitFor(() => {
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "client@example.com",
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });
});
