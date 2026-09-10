import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

it("renders modal with close button having aria-label and title, and handles Escape key", () => {
  const handleClose = vi.fn();
  render(
    <Modal title="Test Modal" onClose={handleClose}>
      <p>Modal content</p>
    </Modal>,
  );

  const closeButton = screen.getByRole("button", { name: "Close" });
  expect(closeButton).toHaveAttribute("aria-label", "Close");
  expect(closeButton).toHaveAttribute("title", "Close");

  fireEvent.keyDown(window, { key: "Escape" });
  expect(handleClose).toHaveBeenCalledTimes(1);

  fireEvent.click(closeButton);
  expect(handleClose).toHaveBeenCalledTimes(2);
});
