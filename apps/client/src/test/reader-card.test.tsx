import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { ReaderCard } from "../components/reader-card";
import type { Reader } from "../types";

afterEach(cleanup);

const mockReader: Reader = {
  id: "test-reader-id",
  username: "lunastar",
  fullName: "Luna Star",
  bio: "Intuitive tarot reader.",
  specialties: ["Tarot", "Astrology"],
  pricingChat: 300,
  pricingVoice: 400,
  pricingVideo: 500,
  isOnline: true,
  lastHeartbeatAt: null,
  rating: 4.9,
  reviewCount: 15,
  profileImageKey: null,
};

it("renders ReaderCard with accessible per-minute rate descriptions", () => {
  render(
    <MemoryRouter>
      <ReaderCard reader={mockReader} />
    </MemoryRouter>,
  );

  expect(screen.getByLabelText("Chat rate: $3.00 per minute")).toBeInTheDocument();
  expect(screen.getByLabelText("Voice rate: $4.00 per minute")).toBeInTheDocument();
  expect(screen.getByLabelText("Video rate: $5.00 per minute")).toBeInTheDocument();
});
