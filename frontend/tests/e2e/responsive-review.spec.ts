import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createSeedView } from "../../data/seed";

const captures = process.env.BARTR_CAPTURE_REVIEW === "1";
const reviewDir = path.resolve(process.cwd(), "../.impeccable/review");
const sizes = [
  { name: "desktop", width: 1440, height: 1000, dark: false, enlarged: false },
  { name: "mobile", width: 390, height: 844, dark: false, enlarged: false },
  { name: "compact", width: 320, height: 760, dark: false, enlarged: false },
  { name: "dark", width: 390, height: 844, dark: true, enlarged: false },
  { name: "enlarged", width: 390, height: 844, dark: false, enlarged: true },
];

for (const size of sizes) {
  test(`core screens reflow at ${size.name} size and appearance`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ colorScheme: size.dark ? "dark" : "light", reducedMotion: "reduce" });
    const view = createSeedView();
    let authenticated = false;
    await page.route("**/api/**", async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/api/me") return route.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? view : { detail: "Sign in to continue.", code: "UNAUTHORIZED" } });
      return route.fulfill({ status: 501, json: { detail: "Synthetic presentation review; no records changed.", code: "REVIEW_ONLY" } });
    });
    async function capture(name: string) {
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const dialog = page.getByRole("dialog");
      if (await dialog.count()) {
        await expect(dialog).toBeInViewport();
        await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      if (captures) {
        await mkdir(reviewDir, { recursive: true });
        await page.screenshot({ path: path.join(reviewDir, `${size.name}${name === "profile" ? "" : `-${name}`}.png`), fullPage: !["account", "item"].includes(name), animations: "disabled" });
      }
    }
    await page.goto("/home");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    if (size.enlarged) await page.addStyleTag({ content: "html { font-size: 200%; }" });
    if (!size.enlarged && size.width < 768) await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeInViewport();
    await capture("home");
    authenticated = true;
    await page.goto("/profile");
    if (size.enlarged) await page.addStyleTag({ content: "html { font-size: 200%; }" });
    await expect(page.getByRole("heading", { name: "Alice Chen", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Items", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Display name", { exact: true })).toHaveCount(0);
    const fragmentedItemFacts = await page.locator(".inventory-row-copy").evaluateAll(copies => copies.flatMap(copy => {
      const fragments: string[] = [];
      const textNodes = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
      while (textNodes.nextNode()) {
        const node = textNodes.currentNode;
        for (const word of (node.textContent ?? "").matchAll(/[A-Za-z]{2,}|\$[\d,.]+|\d{1,2}\/\d{1,2}\/\d{4}/g)) {
          const range = document.createRange();
          range.setStart(node, word.index!);
          range.setEnd(node, word.index! + word[0].length);
          if (range.getClientRects().length > 1) fragments.push(word[0]);
        }
      }
      return fragments;
    }));
    expect(fragmentedItemFacts, "Item words, prices and dates should stay intact when text is enlarged").toEqual([]);
    await capture("profile");
    await page.getByRole("button", { name: "Edit profile", exact: true }).click();
    const account = page.getByRole("dialog", { name: "Edit profile", exact: true });
    await expect(account.getByLabel("Display name", { exact: true })).toHaveValue("Alice Chen");
    await expect(account.getByRole("heading", { name: "Edit profile", exact: true })).toBeFocused();
    await capture("account");
    await page.keyboard.press("Escape");
    await expect(account).not.toBeVisible();
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    const item = page.getByRole("dialog", { name: "Add item", exact: true });
    await expect(item.getByRole("heading", { name: "Add item", exact: true })).toBeFocused();
    await expect(item.getByLabel("Item photo", { exact: true })).toBeEnabled();
    await capture("item");
    await page.keyboard.press("Escape");
    await expect(item).not.toBeVisible();
    await page.getByRole("tab", { name: "Preferences", exact: true }).click();
    await expect(page.getByLabel("Interests", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
    await capture("preferences");
    await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Trade", exact: true }).click();
    await expect(page.getByText("Compose an offer", { exact: true })).toBeVisible();
    await capture("trade");
  });
}
