import { expect, test } from "@playwright/test";

test.describe("mentor discovery", () => {
  test("searches, filters, clears, and never shows pricing", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/mentors");

    await expect(page.getByText(/8 mentors found/)).toBeVisible();

    // Search by university.
    await page.getByLabel("Search").fill("Cambridge");
    await expect(page.getByText(/1 mentor found/)).toBeVisible();
    await expect(page.getByText("Mira Chen")).toBeVisible();
    await page.getByLabel("Search").fill("");

    // Filter by education system (mobile uses the filter sheet).
    if (isMobile) {
      await page.getByRole("button", { name: /^Filters/ }).click();
      const sheet = page.getByRole("dialog");
      await sheet.getByLabel("Education system").click();
      await page.getByRole("option", { name: "AP", exact: true }).click();
      await sheet.getByRole("button", { name: "Show results" }).click();
    } else {
      await page.getByLabel("Education system").click();
      await page.getByRole("option", { name: "AP", exact: true }).click();
    }
    await expect(page.getByText(/4 mentors found/)).toBeVisible();

    // Clear all restores the full list.
    if (isMobile) {
      await page.getByRole("button", { name: /^Filters/ }).click();
      const sheet = page.getByRole("dialog");
      await sheet.getByRole("button", { name: "Clear all filters" }).click();
      await sheet.getByRole("button", { name: "Show results" }).click();
    } else {
      await page.getByRole("button", { name: "Clear all filters" }).click();
    }
    await expect(page.getByText(/8 mentors found/)).toBeVisible();

    // An impossible combination produces the empty state.
    await page.getByLabel("Search").fill("zzz-no-such-mentor");
    await expect(page.getByText(/no mentors match your search/i)).toBeVisible();
    await page.getByRole("button", { name: "Clear all filters" }).last().click();
    await expect(page.getByText(/8 mentors found/)).toBeVisible();

    // Public pages carry no pricing.
    expect(await page.locator("main").textContent()).not.toMatch(/\$/);
    await page.getByRole("link", { name: /Jae Park/ }).first().click();
    await expect(
      page.getByRole("heading", { name: "Jae Park", level: 1 }),
    ).toBeVisible();
    expect(await page.locator("main").textContent()).not.toMatch(/\$/);
  });
});
