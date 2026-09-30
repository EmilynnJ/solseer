import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

it("focuses modal container on mount and handles Escape key dismissal", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={handleClose}>
      <p>Modal content body</p>
    </Modal>,
  );

  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveFocus();

  fireEvent.keyDown(window, { key: "Escape" });
  expect(handleClose).toHaveBeenCalledTimes(1);
});
