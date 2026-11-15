import { test, expect } from "@playwright/test";

test("real local cookies, profile revisions, inventory and expired-session protection", async ({ page, context }) => {
  const username = `profile.${Date.now()}`;
  await page.goto("/profile/preferences");
  await expect(page).toHaveURL(/\/home\?next=/);
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password-only");
  await page.getByLabel("Display name", { exact: true }).fill("Local synthetic member");
  await page.getByLabel("Community", { exact: true }).fill("Synthetic Campus");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/preferences$/);
  const cookie = (await context.cookies()).find(c => c.name === "bartr_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");

  for (const interest of ["Monitor", "Study supplies"]) {
    await page.getByLabel("Interests", { exact: true }).fill(interest);
    await page.getByLabel("Interests", { exact: true }).press("Enter");
    await expect(page.getByRole("button", { name: `Remove interest ${interest}`, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("region", { name: "What you’re looking for", exact: true }).getByRole("status")).toContainText("Preferences saved");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("Display name", { exact: true }).fill("Local updated member");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit profile", exact: true })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Local updated member", exact: true, level: 1 })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Local updated member");
  const saved = await (await page.request.get("/api/me")).json();
  expect(saved.storage).toBe("temporary-memory");
  expect(saved.profile.interests).toEqual(["Monitor", "Study supplies"]);

  await page.getByLabel("Display name", { exact: true }).fill("Unsaved stale member");
  const external = await page.request.patch("/api/profile", {
    headers: { "X-Bartr-Request": "1" },
    data: { expected_revision: saved.profile.revision, name: "Updated elsewhere", community: saved.profile.community,
      interests: saved.profile.interests, exclusions: saved.profile.exclusions, gap_limit: saved.profile.gap_limit },
  });
  expect(external.ok()).toBe(true);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit profile", exact: true }).getByRole("alert")).toContainText("Profile changed");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Unsaved stale member");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Items", exact: true }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Local synthetic chair");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Private draft saved. You can finish it later.", { exact: true })).toBeVisible();
  const itemState = await (await page.request.get("/api/me")).json();
  expect(itemState.items.some((item: {title: string; status: string}) => item.title === "Local synthetic chair" && item.status === "draft")).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/home(?:\?.*)?$/);
  expect((await context.cookies()).some(c => c.name === "bartr_session")).toBe(false);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/profile(?:\/.*)?$/);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Updated elsewhere");

  const logout = await page.request.post("/api/auth/logout", { headers: { "X-Bartr-Request": "1" }, data: {} });
  expect(logout.ok()).toBe(true);
  await page.getByLabel("Display name", { exact: true }).fill("Expired private draft");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page).toHaveURL(/\/home\?next=/);
  await expect(page.getByText("Expired private draft", { exact: true })).not.toBeVisible();
});
