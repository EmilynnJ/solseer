// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

describe("Modal component accessibility and keyboard interaction", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal body content</p>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", () => {
    const handleClose = vi.fn();
    const { getByRole } = render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal body content</p>
      </Modal>,
    );

    const closeButton = getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
