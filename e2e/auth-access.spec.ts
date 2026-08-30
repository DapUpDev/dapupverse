import { expect, test } from "@playwright/test";
import { signInAs } from "./clerk-helpers";

test.describe("route access", () => {
  test("public routes render signed out", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /learn from students/i }),
    ).toBeVisible();
    await page.goto("/mentors");
    await expect(page.getByText(/8 mentors found/i)).toBeVisible();
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: "Terms and Conditions" }),
    ).toBeVisible();
    // No demo-role control exists anywhere.
    expect(await page.locator("body").textContent()).not.toMatch(
      /preview role/i,
    );
  });

  test("protected routes redirect signed-out visitors to sign-in", async ({
    page,
  }) => {
    await page.goto("/app/messages");
    await expect(page).toHaveURL(/\/sign-in/);
    // Clerk's default sign-in card renders.
    await expect(page.getByText(/sign in to dapup/i)).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in/);

    await page.goto("/app/profile");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("header offers working sign-in and sign-up when signed out", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.getByText(/create your account/i)).toBeVisible();
  });

  test("a student is denied from the mentor request inbox", async ({
    page,
  }) => {
    await signInAs(page, "student");
    await page.goto("/app/requests");
    await expect(page).toHaveURL(/\/forbidden/);
    await expect(page.getByText(/not authorized/i)).toBeVisible();
  });

  test("a plain mentor has no Admin nav and is denied from /admin", async ({
    page,
  }) => {
    await signInAs(page, "mentor");
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toContainText("Requests");
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByText("Admin"),
    ).toHaveCount(0);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test("a mentor with admin capability reaches the Admin area", async ({
    page,
  }) => {
    await signInAs(page, "admin");
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
  });
});
