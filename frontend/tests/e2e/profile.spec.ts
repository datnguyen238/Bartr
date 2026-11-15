import { expect, test, type Page, type Route } from "@playwright/test";
import type { Item, View } from "../../lib/marketplace";

// Frontend acceptance only: every API request is intercepted with synthetic data.
// These scenarios do not claim real authentication, database, or provider coverage.
const fixtureTime = "2026-11-14T18:00:00Z";

function item(id: string, owner: string, title: string): Item {
  return {
    id, owner, title, description: "Synthetic test listing", category: "Furniture",
    condition: "Good", value_minor: 4000, value_source: "owner", value_set_at: fixtureTime,
    image_id: null, revision: 1, status: "available", uncertainty: null, analysis: null,
  };
}

function fixture(): View {
  return {
    storage: "temporary-memory",
    integrations: { gemini_configured: false, bedrock_configured: false },
    profile: {
      id: "test-alice", username: "alice.test", name: "Alice Example", community: "Test Campus",
      interests: ["Monitor", "Study supplies"], exclusions: ["Damaged items"], gap_limit: 20, revision: 3,
    },
    members: [
      { id: "test-alice", name: "Alice Example", community: "Test Campus" },
      { id: "test-bob", name: "Bob Example", community: "Test Campus" },
    ],
    items: [item("test-chair", "test-alice", "Test chair"), item("test-monitor", "test-bob", "Test monitor")],
    trades: [],
  };
}

type Stub = {
  authenticated: boolean;
  unavailable: boolean;
  rejectLogin: boolean;
  rejectProfileSave: boolean;
  view: View;
  profileSaves: Record<string, unknown>[];
  itemSaves: Record<string, unknown>[];
  uploads: number;
  unexpected: string[];
};

async function installApi(page: Page, authenticated = true): Promise<Stub> {
  const state: Stub = {
    authenticated, unavailable: false, rejectLogin: false, rejectProfileSave: false,
    view: fixture(), profileSaves: [], itemSaves: [], uploads: 0, unexpected: [],
  };
  async function json(route: Route, status: number, data: unknown) {
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
  }
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\//, "");
    const method = request.method();
    if (path === "me" && method === "GET") {
      if (state.unavailable) return json(route, 503, { detail: "Test service unavailable. Retry shortly.", code: "DATABASE_UNAVAILABLE" });
      return state.authenticated
        ? json(route, 200, state.view)
        : json(route, 401, { detail: "Sign in to continue.", code: "UNAUTHORIZED" });
    }
    if (path === "auth/login" && method === "POST") {
      if (state.rejectLogin) return json(route, 401, { detail: "Invalid username or password.", code: "INVALID_LOGIN" });
      const body = request.postDataJSON() as { username: string };
      if (body.username === "bob.test") {
        state.view = {
          ...fixture(), items: [], trades: [],
          profile: { ...fixture().profile, id: "test-bob", username: "bob.test", name: "Bob Example", interests: [], exclusions: [], revision: 1 },
        };
      }
      state.authenticated = true;
      return json(route, 200, state.view.profile);
    }
    if (path === "auth/register" && method === "POST") {
      state.authenticated = true;
      return json(route, 200, state.view.profile);
    }
    if (path === "auth/logout" && method === "POST") {
      state.authenticated = false;
      return json(route, 200, { ok: true });
    }
    if (!state.authenticated) return json(route, 401, { detail: "Sign in to continue.", code: "UNAUTHORIZED" });
    if (path === "profile" && method === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.profileSaves.push(body);
      if (state.rejectProfileSave) return json(route, 409, { detail: "Profile changed. Reload before saving.", code: "STALE_PROFILE" });
      state.view.profile = { ...state.view.profile, ...body, revision: state.view.profile.revision + 1 } as View["profile"];
      return json(route, 200, state.view.profile);
    }
    if (path === "items" && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.itemSaves.push(body);
      const saved = { ...item("test-new-item", state.view.profile.id, ""), ...body } as Item;
      state.view.items.push(saved);
      return json(route, 200, saved);
    }
    const patchId = /^items\/([^/]+)$/.exec(path)?.[1];
    if (patchId && method === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.itemSaves.push(body);
      const current = state.view.items.find((candidate) => candidate.id === patchId)!;
      const saved = { ...current, ...body, revision: current.revision + 1 } as Item;
      state.view.items = state.view.items.map((candidate) => candidate.id === patchId ? saved : candidate);
      return json(route, 200, saved);
    }
    const imageItemId = /^items\/([^/]+)\/image$/.exec(path)?.[1];
    if (imageItemId && method === "POST") {
      state.uploads += 1;
      const current = state.view.items.find((candidate) => candidate.id === imageItemId)!;
      const saved = { ...current, image_id: "test-uploaded-image", revision: current.revision + 1 };
      state.view.items = state.view.items.map((candidate) => candidate.id === imageItemId ? saved : candidate);
      return json(route, 200, saved);
    }
    if (path === "images/test-uploaded-image" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG2kAAAAASUVORK5CYII=", "base64") });
    }
    if (path === "recommendations" && method === "GET") {
      return json(route, 200, {
        retrieval: "synthetic frontend test", reason: null,
        recommendations: [{
          id: "test-recommendation", member: state.view.members[1], explanation: "Synthetic eligible recommendation.",
          terms: {
            left_owner: "test-alice", right_owner: "test-bob", left: [state.view.items[0]], right: [state.view.items[1]],
            left_total_minor: 4000, right_total_minor: 4000, gap_percent: 0, value_warning: false,
          },
        }],
      });
    }
    state.unexpected.push(`${method} ${path}`);
    return json(route, 501, { detail: "Unexpected synthetic API request.", code: "UNEXPECTED_TEST_REQUEST" });
  });
  return state;
}

async function signIn(page: Page, username = "alice.test") {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("synthetic-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("anonymous profile subpages return Home and restore the requested destination after sign-in", async ({ page }) => {
  await installApi(page, false);
  await page.goto("/profile/preferences");
  await expect(page).toHaveURL(/\/home\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/profile/preferences");
  await expect(page.getByRole("button", { name: "Save preferences" })).not.toBeVisible();
  await signIn(page);
  await expect(page).toHaveURL(/\/profile\/preferences$/);
  await expect(page.getByLabel("Interests", { exact: false })).toHaveValue("Monitor, Study supplies");
});

test("service unavailability offers retry without treating a member as signed out", async ({ page }) => {
  const state = await installApi(page);
  state.unavailable = true;
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Session unavailable" })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("button", { name: "Save profile" })).not.toBeVisible();
  state.unavailable = false;
  await page.getByRole("button", { name: /^Retry/ }).click();
  await expect(page.getByRole("heading", { name: "Your profile", exact: true })).toBeVisible();
});

test("a saved cookie session restores the account on a direct visit and full refresh", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Alice Example");
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue("alice.test");
  await expect(page.getByLabel("Username", { exact: true })).not.toBeEditable();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Alice Example");
});

test("account save preserves the saved trading preferences", async ({ page }) => {
  const state = await installApi(page);
  await page.goto("/profile");
  await page.getByLabel("Display name", { exact: true }).fill("Alice Updated");
  await page.getByLabel("Community", { exact: true }).fill("Updated Campus");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect.poll(() => state.profileSaves.length).toBe(1);
  expect(state.profileSaves[0]).toMatchObject({
    name: "Alice Updated", community: "Updated Campus", interests: ["Monitor", "Study supplies"],
    exclusions: ["Damaged items"], gap_limit: 20, expected_revision: 3,
  });
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Alice Updated");
  expect(state.unexpected).toEqual([]);
});

test("preferences save preserves the saved account details", async ({ page }) => {
  const state = await installApi(page);
  await page.goto("/profile/preferences");
  await page.getByLabel("Interests", { exact: false }).fill("Desk, Computer monitor");
  await page.getByLabel("Exclusions", { exact: false }).fill("Damaged electronics");
  await page.getByLabel("Maximum recommendation gap (%)", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect.poll(() => state.profileSaves.length).toBe(1);
  expect(state.profileSaves[0]).toMatchObject({
    name: "Alice Example", community: "Test Campus", interests: ["Desk", "Computer monitor"],
    exclusions: ["Damaged electronics"], gap_limit: 15, expected_revision: 3,
  });
});

test("unrelated inventory refresh and Profile navigation preserve an unsaved account draft", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  await page.getByLabel("Display name", { exact: true }).fill("Unsaved private draft");
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/inventory$/);
  await page.getByLabel("Title", { exact: true }).fill("New synthetic draft");
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect(page.getByText("Listing saved.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Unsaved private draft");
});

test("a stale profile save keeps the draft and reports renewed review", async ({ page }) => {
  const state = await installApi(page);
  state.rejectProfileSave = true;
  await page.goto("/profile");
  await page.getByLabel("Display name", { exact: true }).fill("Keep this draft");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Profile changed");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Keep this draft");
});

test("logout removes old drafts before another member signs in", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  await page.getByLabel("Display name", { exact: true }).fill("Old member private draft");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/home(?:\?.*)?$/);
  await expect(page.getByText("Alice Example · Test Campus", { exact: true })).not.toBeVisible();
  await signIn(page, "bob.test");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Bob Example");
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(page.getByText("Test chair", { exact: true })).not.toBeVisible();
});

test("an invalid login stays on Home with actionable feedback", async ({ page }) => {
  const state = await installApi(page, false);
  state.rejectLogin = true;
  await page.goto("/home");
  await signIn(page);
  await expect(page.getByRole("alert")).toContainText("Invalid username or password");
  await expect(page).toHaveURL(/\/home(?:\?.*)?$/);
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue("alice.test");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).not.toBeVisible();
});

test("an external return destination cannot replace the local Profile destination", async ({ page }) => {
  await installApi(page, false);
  await page.goto("/home?next=https%3A%2F%2Fexample.invalid%2Fprivate");
  await signIn(page);
  await expect(page).toHaveURL(/\/profile$/);
});

test("inventory create, photo attachment and edit remain usable inside Profile", async ({ page }) => {
  const state = await installApi(page);
  await page.goto("/profile/inventory");
  await page.getByLabel("Title", { exact: true }).fill("Synthetic desk lamp");
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect.poll(() => state.itemSaves.length).toBe(1);
  await page.getByLabel("Item photo", { exact: true }).setInputFiles({
    name: "synthetic-pixel.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG2kAAAAASUVORK5CYII=", "base64"),
  });
  await expect.poll(() => state.uploads).toBe(1);
  await expect(page.getByText("Photo normalized and saved. Review before publishing.", { exact: true })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Reviewed synthetic desk lamp");
  await page.getByRole("button", { name: "Save listing", exact: true }).click();
  await expect.poll(() => state.itemSaves.length).toBe(2);
  expect(state.itemSaves[1]).toMatchObject({ title: "Reviewed synthetic desk lamp", expected_revision: 2 });
});

test("Home Profile Trade navigation remains usable at 390px without offers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto("/profile");
  const main = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await expect(main.getByRole("link")).toHaveText(["Home", "Profile", "Trade"]);
  await expect(main.getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("aria-current", "page");
  const profile = page.getByRole("navigation", { name: "Profile navigation", exact: true });
  await expect(profile.getByRole("link")).toHaveText(["Account", "Inventory", "Preferences"]);
  await main.getByRole("link", { name: "Trade", exact: true }).click();
  await expect(page).toHaveURL(/\/trade$/);
  await expect(page.getByRole("heading", { name: "Trading is coming next" })).toBeVisible();
  await expect(page.getByRole("button", { name: /offer|accept|handoff|Discover bundles/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const [legacy, canonical] of [
  ["/inventory", "/profile/inventory"], ["/preferences", "/profile/preferences"],
  ["/discover", "/trade"], ["/trades", "/trade"],
]) {
  test(`legacy ${legacy} redirects to ${canonical}`, async ({ page }) => {
    await installApi(page);
    await page.goto(legacy);
    await expect(page).toHaveURL(new RegExp(`${canonical}$`));
  });
}
