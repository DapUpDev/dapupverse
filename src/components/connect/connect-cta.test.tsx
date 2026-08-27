import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectCta } from "@/components/connect/connect-cta";
import { DEMO_STUDENT_ID, SEED_MENTOR_PROFILES } from "@/lib/data/seed";
import {
  loadConnectionIntent,
  saveConnectionIntent,
} from "@/lib/demo-session/connection-intent";
import { studentProfileRepository } from "@/lib/repositories";
import { toPublicMentor } from "@/lib/repositories/mock";
import { routerMock } from "@/test/router-mock";
import { renderWithProviders } from "@/test/test-utils";

const mentor = toPublicMentor(SEED_MENTOR_PROFILES[0]);

async function completeDemoStudentProfile() {
  await studentProfileRepository.update({
    studentId: DEMO_STUDENT_ID,
    fullName: "Test Student",
    school: "Test High School",
    yearLevel: "Year 13",
    educationSystem: "IB",
  });
}

describe("ConnectCta — visitor", () => {
  it("shows the auth-required dialog with future-auth actions", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectCta mentor={mentor} />, {
      previewEnabled: true,
    });

    await user.click(
      screen.getByRole("button", { name: /connect with this mentor/i }),
    );

    expect(
      await screen.findByText(/you.ll need an account to connect/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /preview as student/i }),
    ).toBeInTheDocument();
  });

  it("omits the preview continuation when preview is disabled (production)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectCta mentor={mentor} />, {
      previewEnabled: false,
    });

    await user.click(
      screen.getByRole("button", { name: /connect with this mentor/i }),
    );

    expect(
      await screen.findByText(/you.ll need an account to connect/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /preview as student/i }),
    ).not.toBeInTheDocument();
  });
});

describe("ConnectCta — student profile gating and intent", () => {
  it("routes an incomplete student through profile setup and preserves the intent", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectCta mentor={mentor} />, { role: "student" });

    await user.click(
      await screen.findByRole("button", { name: /connect with this mentor/i }),
    );

    expect(routerMock.push).toHaveBeenCalledWith("/app/profile?setup=connect");
    expect(loadConnectionIntent()).toEqual({
      kind: "connect-with-mentor",
      mentorSlug: mentor.slug,
      returnTo: `/mentors/${mentor.slug}`,
    });
  });

  it("resumes the stored intent by opening the request form once the profile is complete", async () => {
    await completeDemoStudentProfile();
    saveConnectionIntent({
      kind: "connect-with-mentor",
      mentorSlug: mentor.slug,
      returnTo: `/mentors/${mentor.slug}`,
    });

    renderWithProviders(<ConnectCta mentor={mentor} />, { role: "student" });

    expect(
      await screen.findByText(new RegExp(`Connect with ${mentor.name}`)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send request/i }),
    ).toBeInTheDocument();
    // The intent is consumed so it cannot re-trigger later.
    expect(loadConnectionIntent()).toBeNull();
  });

  it("opens the request form directly for a complete profile with no detour", async () => {
    const user = userEvent.setup();
    await completeDemoStudentProfile();
    renderWithProviders(<ConnectCta mentor={mentor} />, { role: "student" });

    await user.click(
      await screen.findByRole("button", { name: /connect with this mentor/i }),
    );

    expect(
      await screen.findByRole("button", { name: /send request/i }),
    ).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
