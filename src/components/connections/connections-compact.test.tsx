import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("Connections list", () => {
  it("shows a count, filters by name, and hides Disconnect and Block behind ⋯", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MentorConnections mentorId={DEMO_MENTOR_ID} />, {
      role: "mentor",
    });
    expect(await screen.findByText("1 connection")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Disconnect" }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: /search connections/i }),
      "zz",
    );
    expect(screen.getByText('No connections match "zz".')).toBeInTheDocument();
    await user.clear(
      screen.getByRole("searchbox", { name: /search connections/i }),
    );

    await user.click(
      screen.getByRole("button", { name: "More actions for Lily Zhang" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Block" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Disconnect" }));
    expect(await screen.findByText("No connections yet")).toBeInTheDocument();
  });
});
