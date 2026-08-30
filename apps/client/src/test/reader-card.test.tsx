import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ReaderCard } from "../components/reader-card";
import { Stars } from "../components/ui";
import type { Reader } from "../types";

const mockReader: Reader = {
  id: "reader-1",
  fullName: "Seraphina Moon",
  username: "seraphina",
  bio: "Intuitive tarot reader.",
  specialties: ["Tarot", "Astrology"],
  pricingChat: 500,
  pricingVoice: 700,
  pricingVideo: 1000,
  rating: 4.8,
  reviewCount: 12,
  isOnline: true,
  lastHeartbeatAt: null,
  profileImageKey: null,
};

describe("Accessibility micro-UX enhancements", () => {
  it("renders Stars component with complete ARIA label including review count", () => {
    render(<Stars value={4.8} count={12} />);
    const starsEl = screen.getByLabelText("4.8 out of 5 stars (12 reviews)");
    expect(starsEl).toBeInTheDocument();
  });

  it("renders Stars component with singular review count label", () => {
    render(<Stars value={5.0} count={1} />);
    const starsEl = screen.getByLabelText("5.0 out of 5 stars (1 review)");
    expect(starsEl).toBeInTheDocument();
  });

  it("renders ReaderCard with descriptive rate accessibility labels and tooltips", () => {
    render(
      <MemoryRouter>
        <ReaderCard reader={mockReader} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Rates per minute")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat: $5.00 per minute")).toBeInTheDocument();
    expect(screen.getByLabelText("Voice: $7.00 per minute")).toBeInTheDocument();
    expect(screen.getByLabelText("Video: $10.00 per minute")).toBeInTheDocument();

    expect(screen.getByTitle("Chat rate")).toBeInTheDocument();
    expect(screen.getByTitle("Voice rate")).toBeInTheDocument();
    expect(screen.getByTitle("Video rate")).toBeInTheDocument();
  });
});
