import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

describe("Modal", () => {
  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Modal")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
