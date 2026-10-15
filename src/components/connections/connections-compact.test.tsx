import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { MentorConnections } from "@/components/connections/mentor-connections";
import { StudentConnections } from "@/components/connections/student-connections";
import { DEMO_MENTOR_ID } from "@/lib/data/seed";
import { renderWithProviders } from "@/test/test-utils";

describe("Connections tab", () => {
  it("Message opens the conversation with that student", async () => {
    renderWithProviders(<MentorConnections mentorId={DEMO_MENTOR_ID} />, {
      role: "mentor",
    });
    expect(await screen.findByText("Lily Zhang")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute(
        "href",
        "/app/messages/thread-lily-jae",
      ),
    );
  });

  it("Message opens the conversation with that mentor (student side)", async () => {
    renderWithProviders(<StudentConnections studentId="student-lily" />, {
      role: "student",
    });
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute(
        "href",
        "/app/messages/thread-lily-jae",
      ),
    );
  });
});
