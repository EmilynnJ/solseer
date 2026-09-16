import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

it("renders modal close button with both aria-label and title attributes", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  const closeButton = screen.getByRole("button", { name: "Close" });
  expect(closeButton).toBeInTheDocument();
  expect(closeButton).toHaveAttribute("aria-label", "Close");
  expect(closeButton).toHaveAttribute("title", "Close");
});
