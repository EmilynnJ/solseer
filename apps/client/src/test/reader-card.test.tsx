import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { ReaderCard } from "../components/reader-card";
import type { Reader } from "../types";

afterEach(cleanup);

const sampleReader: Reader = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  username: "aura",
  fullName: "Aura Celestial",
  bio: "Intuitive tarot reader and spiritual advisor.",
  specialties: ["Tarot", "Astrology"],
  pricingChat: 199,
  pricingVoice: 299,
  pricingVideo: 399,
  rating: 4.9,
  reviewCount: 42,
  isOnline: true,
  lastHeartbeatAt: new Date().toISOString(),
  profileImageKey: null,
};

it("renders accessible rate descriptions for screen readers on ReaderCard", () => {
  render(
    <MemoryRouter>
      <ReaderCard reader={sampleReader} />
    </MemoryRouter>,
  );

  expect(screen.getByText("Chat rate:")).toHaveClass("sr-only");
  expect(screen.getByText("Voice rate:")).toHaveClass("sr-only");
  expect(screen.getByText("Video rate:")).toHaveClass("sr-only");

  const perMinuteLabels = screen.getAllByText("per minute");
  expect(perMinuteLabels).toHaveLength(3);
  perMinuteLabels.forEach((label) => {
    expect(label).toHaveClass("sr-only");
  });

  expect(screen.getByText("$1.99")).toBeInTheDocument();
  expect(screen.getByText("$2.99")).toBeInTheDocument();
  expect(screen.getByText("$3.99")).toBeInTheDocument();
});
