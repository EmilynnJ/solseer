import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

it("closes modal on Escape key press and sets focus on mount", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  const dialog = screen.getByRole("dialog", { name: "Test Modal" });
  expect(dialog).toHaveFocus();

  fireEvent.keyDown(window, { key: "Escape" });

  expect(handleClose).toHaveBeenCalledTimes(1);
});
