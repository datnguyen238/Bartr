import { test, expect } from "@playwright/test";
import { createSeedView } from "../../data/seed";

test("signed-in UI review at phone, tablet and desktop widths", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const screenshot = (name: string) => page.screenshot({ path: testInfo.outputPath(name), fullPage: true, animations: "disabled" });
  const username = `ui.${Date.now()}`;
  const registration = await page.request.post("/api/auth/register", {
    headers: { "X-Bartr-Request": "1" },
    data: { username, password: "synthetic-ui-password", name: "Synthetic member" },
  });
  expect(registration.ok()).toBe(true);
  await page.request.post("/api/auth/logout", { headers: { "X-Bartr-Request": "1" }, data: {} });
  await page.goto("/sign-in");
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await screenshot("auth.png");
  await page.goto("/register");
  await expect(page.getByLabel("Display name", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("register.png");
  await page.goto("/sign-in");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("synthetic-ui-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/profile/);

  // Presentation fixtures after exercising real cookie-backed sign-in.
  const presentation = createSeedView();
  await page.route("**/api/me", route => route.fulfill({ json: presentation }));
  await page.route("**/api/trades/seed-open-trade", route => route.fulfill({ json: presentation.trades[0] }));
  await page.routeWebSocket("**/api/trades/*/live", () => {});
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/profile", "/profile/preferences", "/trades"]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
      if (path === "/trades") await page.getByRole("complementary", { name: "Trade list" }).getByRole("button", { name: /Brian Patel.*Open/ }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screenshot(`after-${width}-${path.replaceAll("/", "_")}.png`);
      await expect(page.locator("main")).toHaveCount(1);
      if (path === "/profile") {
        await page.getByRole("button", { name: "Add item", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
        await dialog.getByRole("combobox", { name: "Category" }).click();
        const option = page.getByRole("option", { name: "Electronics", exact: true });
        await expect(option).toBeVisible();
        // Portalled dropdown options remain above the dialog and receive pointer events.
        await option.click();
        await expect(dialog.getByRole("combobox", { name: "Category" })).toHaveText("Electronics");
        await screenshot(`item-${width}.png`);
        await page.keyboard.press("Escape");
      }
    }
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Your matches", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Items matching your interests" })).toBeVisible();
  await screenshot("matches.png");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/trades/new?with=seed-brian&item=seed-monitor");
    await expect(page.getByRole("heading", { name: "Trade with Brian Patel", exact: true })).toBeVisible();
    if (width < 1024) await page.getByRole("button", { name: "Your items (0)", exact: true }).click();
    const chair = page.getByRole("checkbox", { name: /Wooden study chair/ });
    await chair.focus();
    await page.keyboard.press("Space");
    await expect(chair).toBeChecked();
    await page.getByRole("button", { name: "Review offer", exact: true }).click();
    const reviewDialog = page.getByRole("dialog", { name: "Review your offer to Brian" });
    await expect(reviewDialog).toBeVisible();
    const closeButton = reviewDialog.getByRole("button", { name: "Close", exact: true });
    // Measure after the dialog's entrance scale animation has settled.
    await expect.poll(async () => Math.round((await closeButton.boundingBox())!.width)).toBeGreaterThanOrEqual(44);
    await expect.poll(async () => Math.round((await closeButton.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("button", { name: "Send offer", exact: true })).toBeDisabled();
    await screenshot(`offer-review-${width}.png`);
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    if (width < 768) {
      const review = page.getByRole("button", { name: "Review offer", exact: true });
      await review.scrollIntoViewIfNeeded();
      const reviewBounds = await review.boundingBox();
      const navBounds = await page.getByRole("navigation", { name: "Main navigation" }).boundingBox();
      expect(reviewBounds!.y + reviewBounds!.height).toBeLessThanOrEqual(navBounds!.y);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(`compose-${width}.png`);
    await page.goto("/trades/seed-open-trade");
    await expect(page.getByRole("heading", { name: "Trade with Brian Patel", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(`detail-${width}.png`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const openTrade = presentation.trades.find(trade => trade.status === "open")!;
  openTrade.notes = Array.from({ length: 60 }, (_, index) => ({ sender: openTrade.participants[index % 2], text: `Synthetic message ${index}`, created_at: "2026-11-14T18:00:00Z" }));
  await page.goto("/trades");
  await page.getByRole("complementary", { name: "Trade list" }).getByRole("button", { name: /Brian Patel.*Open/ }).click();
  const conversation = page.locator("#trade-conversation");
  await expect.poll(() => conversation.evaluate(element => element.clientHeight)).toBeLessThanOrEqual(720);
  const log = page.getByRole("log", { name: "Trade messages" });
  await expect.poll(() => log.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await screenshot("long-chat.png");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/profile");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "Condition" }).click();
  const menu = page.getByRole("listbox");
  await expect(menu).toBeInViewport({ ratio: 1 });
  await page.getByRole("option", { name: "Used", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("combobox", { name: "Condition" })).toHaveText("Used");
});
