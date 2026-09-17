import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

it("renders modal with close button having matching aria-label and title attributes", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  const closeButton = screen.getByRole("button", { name: "Close" });
  expect(closeButton).toHaveAttribute("title", "Close");
  expect(closeButton).toHaveAttribute("aria-label", "Close");
});

it("dismisses modal when Escape key is pressed", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  fireEvent.keyDown(window, { key: "Escape" });
  expect(handleClose).toHaveBeenCalledTimes(1);
});
