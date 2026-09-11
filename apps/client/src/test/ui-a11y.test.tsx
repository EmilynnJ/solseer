import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";
import { MessagesPage } from "../pages/messages";

vi.mock("../components/auth-context", () => ({
  useSoulAuth: () => ({
    me: { user: { role: "client", username: "testuser" } },
    sessionUser: { id: "user-1" },
    refresh: vi.fn(),
  }),
}));
vi.mock("../lib/posthog", () => ({ posthog: { capture: vi.fn() } }));
vi.mock("../lib/api", () => ({
  api: vi.fn().mockImplementation((path: string) => {
    if (path === "/messages/conversations") {
      return Promise.resolve({ conversations: [] });
    }
    return Promise.resolve({});
  }),
  dateTime: (d: string) => d,
  money: (c: number) => `$${(c / 100).toFixed(2)}`,
}));

afterEach(cleanup);

it("Modal close button includes matching title tooltip alongside aria-label", () => {
  render(
    <Modal title="Test Modal" onClose={() => undefined}>
      <p>Modal content</p>
    </Modal>,
  );
  const closeBtn = screen.getByRole("button", { name: "Close" });
  expect(closeBtn).toHaveAttribute("aria-label", "Close");
  expect(closeBtn).toHaveAttribute("title", "Close");
});

it("MessagesPage refresh button and new conversation textarea include proper accessibility attributes", async () => {
  render(
    <MemoryRouter initialEntries={["/messages?reader=reader-123"]}>
      <MessagesPage />
    </MemoryRouter>,
  );

  const refreshBtn = await screen.findByRole("button", {
    name: "Refresh conversations",
  });
  expect(refreshBtn).toHaveAttribute("aria-label", "Refresh conversations");
  expect(refreshBtn).toHaveAttribute("title", "Refresh conversations");

  const textarea = screen.getByRole("textbox", {
    name: "What would you like guidance about?",
  });
  expect(textarea).toBeInTheDocument();
});
