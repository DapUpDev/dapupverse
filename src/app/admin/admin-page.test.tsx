import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import AdminPage from "@/app/admin/page";
import { renderWithProviders } from "@/test/test-utils";

describe("AdminPage", () => {
  it("denies a plain mentor — account type alone is not admin capability", async () => {
    renderWithProviders(<AdminPage />, { role: "mentor" });
    expect(
      await screen.findByText(/admin capability required/i),
    ).toBeInTheDocument();
  });

  it("denies a student without the capability", async () => {
    renderWithProviders(<AdminPage />, { role: "student" });
    expect(
      await screen.findByText(/admin capability required/i),
    ).toBeInTheDocument();
  });

  it("admits a mentor with explicit admin capability", async () => {
    renderWithProviders(<AdminPage />, { role: "mentor-admin" });
    expect(await screen.findByText(/mentor roster/i)).toBeInTheDocument();
  });
});
