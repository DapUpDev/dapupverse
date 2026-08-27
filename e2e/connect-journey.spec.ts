import { expect, test, type Page } from "@playwright/test";

async function switchRole(page: Page, label: string) {
  await page.getByTestId("role-switcher").click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
}

test.describe("connect-with-mentor journey", () => {
  test("visitor → preview student → profile setup → request → mentor accept → messaging", async ({
    page,
  }) => {
    // 1. Visitor opens a mentor and hits the auth-required dialog.
    await page.goto("/mentors/jae-park");
    await page
      .getByRole("button", { name: "Connect with this mentor" })
      .click();
    await expect(
      page.getByText(/you.ll need an account to connect/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create account" }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();

    // 2. Preview as student — the incomplete profile detours to setup.
    await page.getByRole("button", { name: "Preview as student" }).click();
    await expect(page).toHaveURL(/\/app\/profile\?setup=connect/);
    await expect(
      page.getByText(/finish your profile to send your request/i),
    ).toBeVisible();

    // 3. Complete the profile.
    await page.getByLabel("Full name").fill("Demo Student");
    await page.getByLabel("School").fill("Wellington College");
    await page.getByLabel("Year level").fill("Year 13");
    await page.getByLabel("Education system").click();
    await page.getByRole("option", { name: "IB", exact: true }).click();
    await page.getByRole("button", { name: "Save profile" }).click();

    // 4. The flow resumes on the mentor page with the request form open.
    await expect(page).toHaveURL(/\/mentors\/jae-park/);
    await expect(
      page.getByRole("heading", { name: "Connect with Jae Park" }),
    ).toBeVisible();

    // Validation blocks an empty submission.
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(
      page.getByText(/choose what you.d like help with/i),
    ).toBeVisible();

    await page.getByLabel("Purpose").click();
    await page.getByRole("option", { name: "Essay review" }).click();
    await page
      .getByLabel("Short message or question")
      .fill("Could you review my main application essay before the deadline?");
    await page.getByRole("button", { name: "Send request" }).click();

    // 5. Confirmation and pending state; no duplicate request possible.
    await expect(page.getByText("Request sent")).toBeVisible();
    await expect(page.getByText("Request pending")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect with this mentor" }),
    ).toHaveCount(0);

    await page.goto("/app/connections");
    await expect(
      page.getByRole("heading", { name: "Pending requests" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Jae Park" }),
    ).toBeVisible();

    // 6. The mentor sees the request and accepts it. No reject exists.
    await switchRole(page, "Mentor");
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

    // 7. Messaging is now unlocked: the mentor messages the student.
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

    // 8. The student sees the conversation, the unread message, and the
    //    mentor's private price now that the connection is accepted.
    await switchRole(page, "Student");
    await page.goto("/mentors/jae-park");
    await expect(page.getByText(/you.re connected/i)).toBeVisible();
    await expect(page.getByText("$40 USD")).toBeVisible();

    await page.goto("/app/messages");
    await page.getByRole("link", { name: /Jae Park/ }).click();
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

  test("reset demo data returns the app to its seed state", async ({
    page,
  }) => {
    await page.goto("/");
    await switchRole(page, "Student");
    await expect(page.getByTestId("role-switcher")).toHaveText(
      /Preview role: Student/,
    );
    // The chosen role must survive a reload (persisted demo state) …
    await page.reload();
    await expect(page.getByTestId("role-switcher")).toHaveText(
      /Preview role: Student/,
    );
    // … and reset returns everything to the seed state.
    await page.getByTestId("role-switcher").click();
    await page.getByRole("menuitem", { name: "Reset demo data" }).click();
    await expect(page.getByText("Demo data reset")).toBeVisible();
    await expect(page.getByTestId("role-switcher")).toHaveText(
      /Preview role: Visitor/,
    );
  });
});
