import { expect, test, type Page } from "@playwright/test";

/**
 * Visual QA screenshot matrix (milestone 3). Not a functional test — run
 * explicitly with:  SCREENSHOTS=1 npx playwright test visual-matrix
 * Output lands in ./screenshots (gitignored).
 */

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.skip(!process.env.SCREENSHOTS, "screenshot matrix runs only on demand");

async function switchRole(page: Page, label: string) {
  await page.getByTestId("role-switcher").click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
  await expect(page.getByTestId("role-switcher")).toHaveText(
    new RegExp(label.replace("+", "\\+")),
  );
}

async function shoot(page: Page, name: string, fullPage = true) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage });
}

test.describe.configure({ mode: "serial" });

test("public pages — desktop", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  await shoot(page, "home-desktop");
  await page.goto("/mentors");
  await expect(page.getByText(/8 mentors found/i)).toBeVisible();
  await shoot(page, "mentors-desktop");
  await page.goto("/mentors/jae-park");
  await expect(page.getByRole("heading", { name: "Jae Park" })).toBeVisible();
  await shoot(page, "mentor-detail-desktop");
  await page.goto("/terms");
  await shoot(page, "terms-desktop");
});

test("public pages — mobile", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto("/");
  await shoot(page, "home-mobile");
  await page.goto("/mentors");
  await expect(page.getByText(/8 mentors found/i)).toBeVisible();
  await shoot(page, "mentors-mobile");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await shoot(page, "mentors-mobile-filters-open", false);
  await page.keyboard.press("Escape");
  await page.goto("/mentors/jae-park");
  await expect(page.getByRole("heading", { name: "Jae Park" })).toBeVisible();
  await shoot(page, "mentor-detail-mobile");
});

test("stateful journey screenshots", async ({ page }) => {
  await page.setViewportSize(DESKTOP);

  // Student: empty messages + profile edit (incomplete).
  await page.goto("/");
  await switchRole(page, "Student");
  await page.goto("/app/messages");
  await expect(page.getByText(/no conversations yet/i)).toBeVisible();
  await shoot(page, "messages-empty-student-desktop");
  await page.goto("/app/profile");
  await expect(page.getByLabel("Full name")).toBeVisible();
  await shoot(page, "student-profile-edit-desktop");

  // Complete profile, send a request to Jae.
  await page.getByLabel("Full name").fill("Demo Student");
  await page.getByLabel("School").fill("Wellington College");
  await page.getByLabel("Year level").fill("Year 13");
  await page.getByLabel("Education system").click();
  await page.getByRole("option", { name: "IB", exact: true }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await page.goto("/mentors/jae-park");
  await page.getByRole("button", { name: "Connect with this mentor" }).click();
  await page.getByLabel("Purpose").click();
  await page.getByRole("option", { name: "Essay review" }).click();
  await page
    .getByLabel("Short message or question")
    .fill("Could you review my main application essay before the deadline?");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Request pending")).toBeVisible();

  await page.goto("/app/connections");
  await expect(
    page.getByRole("heading", { name: "Pending requests" }),
  ).toBeVisible();
  await shoot(page, "student-pending-connection-desktop");

  // Mentor: requests inbox, accept, inbox/conversation.
  await switchRole(page, "Mentor");
  await page.goto("/app/requests");
  await expect(page.getByText("Demo Student")).toBeVisible();
  await shoot(page, "mentor-requests-desktop");
  await page
    .locator("li")
    .filter({ hasText: "Demo Student" })
    .first()
    .getByRole("button", { name: "Accept" })
    .click();
  await expect(page.getByText("Request accepted")).toBeVisible();

  await page.goto("/app/messages");
  await expect(page.getByRole("link", { name: /Lily Zhang/ })).toBeVisible();
  await shoot(page, "inbox-mentor-desktop");
  await page.getByRole("link", { name: /Lily Zhang/ }).click();
  await expect(
    page.getByRole("heading", { name: "Lily Zhang" }),
  ).toBeVisible();
  await shoot(page, "conversation-mentor-desktop");

  // Mobile inbox + conversation.
  await page.setViewportSize(MOBILE);
  await page.goto("/app/messages");
  await shoot(page, "inbox-mentor-mobile");
  await page.getByRole("link", { name: /Lily Zhang/ }).click();
  await expect(
    page.getByRole("heading", { name: "Lily Zhang" }),
  ).toBeVisible();
  await shoot(page, "conversation-mentor-mobile");
  await page.setViewportSize(DESKTOP);

  // Mentor profile edit (with private price field).
  await page.goto("/app/profile");
  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(page.getByLabel("Session rate (USD)")).toBeVisible();
  await shoot(page, "mentor-profile-edit-desktop");

  // Disconnect Lily -> read-only conversation.
  await page.goto("/app/connections");
  await page
    .locator("li")
    .filter({ hasText: "Lily Zhang" })
    .first()
    .getByRole("button", { name: "Disconnect" })
    .click();
  await page.goto("/app/messages");
  await page.getByRole("link", { name: /Lily Zhang/ }).click();
  await expect(page.getByText(/read-only/i).first()).toBeVisible();
  await shoot(page, "conversation-disconnected-desktop");

  // Student: accepted connection with private price visible.
  await switchRole(page, "Student");
  await page.goto("/mentors/jae-park");
  await expect(page.getByText("$40 USD")).toBeVisible();
  await shoot(page, "accepted-connection-price-desktop");
});
