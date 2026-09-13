import { expect, test } from "@playwright/test";
import { signInAs, signOut } from "./clerk-helpers";

test.describe("connect-with-mentor journey", () => {
  test("a visitor gets real sign-up/sign-in actions with a preserved return path", async ({
    page,
  }) => {
    await page.goto("/mentors/jae-park");
    await page
      .getByRole("button", { name: "Connect with this mentor" })
      .click();
    await expect(
      page.getByText(/you.ll need an account to connect/i),
    ).toBeVisible();

    const signUpLink = page.getByRole("link", { name: "Create account" });
    await expect(signUpLink).toHaveAttribute(
      "href",
      `/sign-up?redirect_url=${encodeURIComponent("/mentors/jae-park")}`,
    );
    await signUpLink.click();
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.getByText(/create your account/i)).toBeVisible();
  });

  test("student → profile setup → request → mentor accept → messaging → private price", async ({
    page,
  }) => {
    // 1. Authenticated student with an incomplete local profile starts the
    //    connect flow and detours through profile setup.
    await signInAs(page, "student");
    await page.goto("/mentors/jae-park");
    await page
      .getByRole("button", { name: "Connect with this mentor" })
      .click();
    await expect(page).toHaveURL(/\/app\/profile\?setup=connect/);
    await expect(
      page.getByText(/finish your profile to send your request/i),
    ).toBeVisible();

    // 2. Complete the profile; the intent resumes on the mentor page.
    await page.getByLabel("Full name").fill("Demo Student");
    await page.getByLabel("School").fill("Wellington College");
    await page.getByLabel("Year level").fill("Year 13");
    await page.getByLabel("Education system").click();
    await page.getByRole("option", { name: "IB", exact: true }).click();
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page).toHaveURL(/\/mentors\/jae-park/);
    await expect(
      page.getByRole("heading", { name: "Connect with Jae Park" }),
    ).toBeVisible();

    await page.getByLabel("Purpose").click();
    await page.getByRole("option", { name: "Essay review" }).click();
    await page
      .getByLabel("Short message or question")
      .fill("Could you review my main application essay before the deadline?");
    await page.getByRole("button", { name: "Send request" }).click();

    // 3. Pending state; duplicates impossible.
    await expect(page.getByText("Request sent")).toBeVisible();
    await expect(page.getByText("Request pending")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect with this mentor" }),
    ).toHaveCount(0);

    await page.goto("/app/connections");
    await expect(
      page.getByRole("heading", { name: "Pending requests" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Jae Park" })).toBeVisible();

    // 4. The mapped mentor signs in (same browser: shared local mock data),
    //    sees the request, and accepts it. No reject action exists.
    await signOut(page);
    await signInAs(page, "mentor");
    await page.goto("/app/requests");
    const requestCard = page
      .locator("li")
      .filter({ hasText: "Demo Student" })
      .first();
    await expect(requestCard).toBeVisible();
    expect(await page.locator("main").textContent()).not.toMatch(
      /reject|decline/i,
    );
    await requestCard.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("Request accepted")).toBeVisible();

    // 5. Messaging unlocked: mentor messages the student.
    await page.goto("/app/messages");
    await page.getByRole("link", { name: /Demo Student/ }).click();
    await page
      .getByRole("textbox", { name: /message demo student/i })
      .fill("Welcome aboard! Send the essay over whenever you're ready.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page
        .getByLabel("Conversation with Demo Student")
        .getByText("Welcome aboard! Send the essay over whenever you're ready."),
    ).toBeVisible();

    // 6. The student sees the accepted connection, the mentor's private
    //    price, and the conversation.
    await signOut(page);
    await signInAs(page, "student");
    await page.goto("/mentors/jae-park");
    await expect(page.getByText(/you.re connected/i)).toBeVisible();
    await expect(page.getByText("$40 USD")).toBeVisible();
    // The header badge counts the mentor's message until the thread is read.
    await expect(page.getByTestId("unread-badge").first()).toHaveText("1");
    if (process.env.BADGE_SHOT) {
      await page.screenshot({ path: process.env.BADGE_SHOT, clip: { x: 0, y: 0, width: 1280, height: 120 } });
    }

    await page.goto("/app/messages");
    await page.getByRole("link", { name: /Jae Park/ }).click();
    await expect(page.getByTestId("unread-badge")).toHaveCount(0);
    const conversation = page.getByLabel("Conversation with Jae Park");
    await expect(
      conversation.getByText(
        "Welcome aboard! Send the essay over whenever you're ready.",
      ),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: /message jae park/i })
      .fill("Thank you! Sending it tonight.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      conversation.getByText("Thank you! Sending it tonight."),
    ).toBeVisible();
  });
});
