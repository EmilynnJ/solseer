import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

it("dismisses modal on Escape key press", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Dialog" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  fireEvent.keyDown(window, { key: "Escape" });
  expect(handleClose).toHaveBeenCalledTimes(1);
});

it("sets focus to the modal container on mount", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Dialog" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  const dialog = screen.getByRole("dialog");
  expect(document.activeElement).toBe(dialog);
});
