import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { MentorCard } from "@/components/mentors/mentor-card";
import {
  ConnectedStudentPanel,
  MentorProfileView,
} from "@/components/mentors/mentor-profile-view";
import { SEED_MENTOR_PROFILES } from "@/lib/data/seed";
import { toPublicMentor } from "@/lib/repositories/mock";
import { renderWithProviders } from "@/test/test-utils";

describe("public price invisibility", () => {
  it("mentor cards show no pricing", () => {
    for (const profile of SEED_MENTOR_PROFILES.slice(0, 3)) {
      const { container, unmount } = renderWithProviders(
        <MentorCard mentor={toPublicMentor(profile)} />,
      );
      expect(container.textContent).not.toMatch(/\$|\bprice\b|\brate\b|\busd\b/i);
      unmount();
    }
  });

  it("the public mentor profile page shows no pricing to a visitor", async () => {
    const { container } = renderWithProviders(
      <MentorProfileView slug="jae-park" />,
      { previewEnabled: true },
    );
    await screen.findByRole("heading", { name: "Jae Park" });
    expect(container.textContent).not.toMatch(/\$|\bprice\b|\brate\b|\busd\b/i);
  });
});

describe("price visibility after an accepted connection", () => {
  it("the connected panel shows the mentor's private rate", async () => {
    renderWithProviders(
      <ConnectedStudentPanel mentorId="mentor-jae" mentorName="Jae Park" />,
    );
    expect(await screen.findByText(/\$40 USD/)).toBeInTheDocument();
    expect(
      screen.getByText(/shared with connected students only/i),
    ).toBeInTheDocument();
  });
});
