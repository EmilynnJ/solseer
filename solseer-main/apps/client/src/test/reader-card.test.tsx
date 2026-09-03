import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ReaderCard } from "../components/reader-card";
import type { Reader } from "../types";

afterEach(cleanup);

describe("ReaderCard profile images", () => {
  it("defers loading and decoding for off-screen reader images", () => {
    const reader: Reader = {
      id: "22222222-2222-4222-8222-222222222222",
      username: "luna",
      fullName: "Luna Moon",
      bio: "Clairvoyant reader",
      specialties: ["Tarot"],
      pricingChat: 300,
      pricingVoice: 400,
      pricingVideo: 500,
      isOnline: true,
      lastHeartbeatAt: null,
      profileImageKey: "readers/luna.jpg",
      rating: 4.9,
      reviewCount: 42,
    };

    render(
      <MemoryRouter>
        <ReaderCard reader={reader} />
      </MemoryRouter>,
    );

    const image = screen.getByRole("img", {
      name: "Luna Moon, SoulSeer Reader",
    });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
  });
});
