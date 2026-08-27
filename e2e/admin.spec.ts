import { expect, test, type Page } from "@playwright/test";

async function switchRole(page: Page, label: string) {
  await page.getByTestId("role-switcher").click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
}

test.describe("admin capability", () => {
  test("a plain mentor has no Admin nav and is denied at /admin", async ({
    page,
  }) => {
    await page.goto("/");
    await switchRole(page, "Mentor");
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toContainText("Requests");
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByText("Admin"),
    ).toHaveCount(0);

    await page.goto("/admin");
    await expect(page.getByText(/admin capability required/i)).toBeVisible();
  });

  test("a mentor with admin capability sees the Admin area", async ({
    page,
  }) => {
    await page.goto("/");
    await switchRole(page, "Mentor + admin");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Admin" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Admin", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mentor roster" }),
    ).toBeVisible();
    await expect(page.getByText("$40 USD")).toBeVisible();
  });
});
