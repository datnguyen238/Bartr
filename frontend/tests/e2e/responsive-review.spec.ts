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
      if (captures) {
        await mkdir(reviewDir, { recursive: true });
        await page.screenshot({ path: path.join(reviewDir, `${size.name}${name === "inventory" ? "" : `-${name}`}.png`), fullPage: true, animations: "disabled" });
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
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Alice Chen");
    await capture("account");
    await page.getByRole("link", { name: "Inventory", exact: true }).click();
    await page.getByRole("button", { name: "Edit Wooden study chair", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Wooden study chair", exact: true, level: 2 })).toBeFocused();
    await expect(page.getByRole("heading", { name: "Wooden study chair", exact: true, level: 2 })).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture("inventory");
    await page.getByRole("link", { name: "Preferences", exact: true }).click();
    await expect(page.getByLabel("Interests", { exact: true })).toBeVisible();
    await capture("preferences");
    await page.getByRole("link", { name: "Trade", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Trading is coming next" })).toBeVisible();
    await capture("trade");
  });
}
