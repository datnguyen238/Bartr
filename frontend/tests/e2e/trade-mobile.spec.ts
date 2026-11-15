import { expect, test } from "@playwright/test";
import { createSeedView } from "../../data/seed";

for (const width of [320, 390]) {
  test(`trade workspace stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const view = createSeedView();
    await page.route("**/api/**", (route) => {
      if (new URL(route.request().url()).pathname === "/api/me") {
        return route.fulfill({ status: 200, json: view });
      }
      return route.fulfill({ status: 501, json: { detail: "Synthetic presentation test." } });
    });

    await page.goto("/trades");
    const list = page.getByRole("complementary", { name: "Trade list" });
    await list.getByRole("button", { name: /Brian Patel.*Open/ }).click();
    const exchange = page.getByText("Exchange with Brian Patel");
    const conversation = page.locator("#trade-conversation");
    await expect(exchange).toBeVisible();
    await expect(page.getByRole("log", { name: "Trade messages" })).toContainText("HDMI cable");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await list.boundingBox())!.y).toBeLessThan((await exchange.boundingBox())!.y);
    expect((await exchange.boundingBox())!.y).toBeLessThan((await conversation.boundingBox())!.y);
    await page.getByRole("link", { name: "Go to conversation" }).click();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
    await page.getByRole("textbox", { name: "Message" }).fill("Hello");
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("Hello");
  });
}
