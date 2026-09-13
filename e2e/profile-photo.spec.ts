import { expect, test } from "@playwright/test";
import { signInAs } from "./clerk-helpers";

// A 1x1 transparent PNG: enough to exercise the real file input.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("profile photo", () => {
  test("a mentor uploads, sees, and removes their photo", async ({ page }) => {
    await signInAs(page, "mentor");
    await page.goto("/app/profile");
    await page.getByRole("button", { name: "Edit profile" }).click();

    const input = page.locator("#mentor-image");
    await expect(page.getByRole("button", { name: "Choose photo" })).toBeVisible();
    await input.setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Photo updated")).toBeVisible();
    const picture = page.locator('img[data-slot="avatar-image"]').first();
    await expect(picture).toHaveAttribute("src", /^data:image\/png/);
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    if (process.env.PHOTO_SHOT) {
      await page.screenshot({ path: process.env.PHOTO_SHOT, fullPage: false });
    }

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Photo removed")).toBeVisible();
    await expect(page.locator('img[data-slot="avatar-image"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose photo" })).toBeVisible();
  });

  test("the wrong kind of file is refused before any upload", async ({ page }) => {
    await signInAs(page, "mentor");
    await page.goto("/app/profile");
    await page.getByRole("button", { name: "Edit profile" }).click();
    await page
      .locator("#mentor-image")
      .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
    await expect(page.getByText("Use a JPEG, PNG, or WebP image.")).toBeVisible();
    await expect(page.locator('img[data-slot="avatar-image"]')).toHaveCount(0);
  });
});
