import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { Layout } from "../components/layout";
import { HelpPage } from "../pages/info";

vi.mock("../components/auth-context", () => ({
  useSoulAuth: () => ({ me: null, sessionUser: null }),
}));
vi.mock("../lib/auth", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("../lib/posthog", () => ({ posthog: { reset: vi.fn() } }));
afterEach(cleanup);

it("links the site footer to an accessibility statement", () => {
  render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  );
  expect(
    within(screen.getByRole("contentinfo")).getByRole("link", {
      name: "Accessibility",
    }),
  ).toHaveAttribute("href", "/accessibility");
  expect(screen.getByRole("contentinfo")).not.toHaveTextContent("entertainment");
  expect(screen.getByRole("contentinfo")).toHaveTextContent("accessible website for people with disabilities");
});

it("offers a labeled accessibility statement and contact route without claiming certification", () => {
  render(<HelpPage />);
  const statement = screen.getByRole("region", {
    name: "Accessibility statement",
  });
  expect(statement).toHaveAttribute("id", "accessibility");
  expect(
    within(statement).getByRole("link", { name: /contact support/i }),
  ).toHaveAttribute("href", expect.stringContaining("mailto:"));
  expect(statement).toHaveTextContent("not a certification");
});
