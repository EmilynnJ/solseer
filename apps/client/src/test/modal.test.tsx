import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

it("invokes onClose when the Escape key is pressed", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  fireEvent.keyDown(window, { key: "Escape" });
  expect(handleClose).toHaveBeenCalledTimes(1);
});

it("focuses the modal dialog element on mount", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Focus Modal" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  const dialog = screen.getByRole("dialog");
  expect(document.activeElement).toBe(dialog);
});
