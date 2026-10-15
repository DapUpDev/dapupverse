import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ConsultingStudents,
  type ConsultingStudent,
} from "@/components/admin/consulting-students";
import { renderWithProviders } from "@/test/test-utils";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (actual) => ({
  ...(await actual<typeof import("@/lib/api/client")>()),
  apiBaseUrl: () => "https://api.test",
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
vi.mock("@/lib/repositories", () => ({
  mentorRepository: {
    list: async () => [
      { id: "m_jae", name: "Jae Park" },
      { id: "m_kim", name: "Kim Ito" },
    ],
  },
}));

const MAYA: ConsultingStudent = {
  id: "s_maya",
  fullName: "Maya Lin",
  school: "Lincoln High",
  yearLevel: "Year 13",
  email: "maya@example.com",
  consulting: false,
  mentorIds: [],
};

describe("ConsultingStudents", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(
      async (path: string, init?: { body?: object }) =>
        init?.body ? { ...MAYA, ...init.body } : [MAYA],
    );
  });

  it("marks a student as consulting and adds a mentor to their team", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConsultingStudents />, { role: "mentor-admin" });

    await user.click(
      await screen.findByRole("checkbox", {
        name: "In the Premier Fellowship",
      }),
    );
    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith(
        "/admin/consulting/students/s_maya",
        { method: "PUT", body: { consulting: true, mentorIds: [] } },
      ),
    );

    await user.click(
      screen.getByRole("combobox", { name: /add a mentor to maya lin/i }),
    );
    await user.click(await screen.findByRole("option", { name: "Kim Ito" }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith(
        "/admin/consulting/students/s_maya",
        { method: "PUT", body: { consulting: true, mentorIds: ["m_kim"] } },
      ),
    );
    expect(
      await screen.findByRole("button", {
        name: "Remove Kim Ito from the team",
      }),
    ).toBeInTheDocument();
  });

  it("waits for sign-in before loading", () => {
    renderWithProviders(<ConsultingStudents />, { role: "visitor" });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
