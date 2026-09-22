import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

it("dismisses modal when Escape key is pressed", () => {
  const onClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={onClose}>
      <p>Modal content</p>
    </Modal>,
  );

  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("focuses modal container on mount", () => {
  const onClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={onClose}>
      <p>Modal content</p>
    </Modal>,
  );

  const dialog = screen.getByRole("dialog");
  expect(document.activeElement).toBe(dialog);
});
