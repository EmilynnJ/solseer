import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { Modal } from "../components/ui";

describe("Modal component", () => {
  it("dismisses modal when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
