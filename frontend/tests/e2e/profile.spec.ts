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
  profileFieldErrors: { field: string; message: string }[];
  rejectItemSave: boolean;
  view: View;
  profileSaves: Record<string, unknown>[];
  itemSaves: Record<string, unknown>[];
  uploads: number;
  unexpected: string[];
};

async function installApi(page: Page, authenticated = true): Promise<Stub> {
  const state: Stub = {
    authenticated, unavailable: false, rejectLogin: false, rejectProfileSave: false, profileFieldErrors: [], rejectItemSave: false,
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
      if (state.profileFieldErrors.length) return json(route, 422, { detail: "Check the highlighted fields.", fields: state.profileFieldErrors });
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
      if (state.rejectItemSave) return json(route, 409, { detail: "Item changed. Reload before saving.", code: "STALE_ITEM" });
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
    if (/^items\/[^/]+\/identify$/.test(path) && method === "POST") {
      return json(route, 200, { title: "Synthetic lamp", category: "Household essentials", description: "Synthetic lamp description" });
    }
    const analysisId = /^items\/([^/]+)\/analysis$/.exec(path)?.[1];
    if (analysisId && method === "POST") {
      const analysis = { analysis_id: "test-analysis", status: "estimated" as const, comparison_basis: "asking" as const, estimate_minor: 4200, uncertainty: "low", generated_at: fixtureTime, item_revision: 1, attributes: { description: "Synthetic lamp", brand: null, model: null, clarification_needed: false, clarification_questions: [] }, range: { low_minor: 3000, high_minor: 5000 }, evidence: [{ uri: "https://example.com/synthetic-lamp", title: "Comparable lamp", price_minor: 4200, condition: "used" }], attribution: { search_entry_point_html: '<a href="https://example.com/search" target="_blank">Search</a>' } };
      state.view.items = state.view.items.map((candidate) => candidate.id === analysisId ? { ...candidate, analysis } : candidate);
      return json(route, 200, analysis);
    }
    if (path === "recommendations" && method === "GET") {
      return json(route, 200, {
        retrieval: "synthetic frontend test", reason: null,
        matching_item_ids: ["test-monitor"],
        matching_item_revisions: { "test-monitor": state.view.items[1].revision },
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

async function setEntries(page: Page, kind: "interest" | "exclusion", values: string[]) {
  const input = page.getByLabel(kind === "interest" ? "Interests" : "Exclusions", { exact: true });
  await expect(input).toBeVisible();
  const removals = page.getByRole("button", { name: new RegExp(`^Remove ${kind} `) });
  while (await removals.count()) {
    const count = await removals.count();
    await removals.first().click();
    await expect(removals).toHaveCount(count - 1);
  }
  for (const value of values) {
    await input.click();
    await page.getByRole("menuitem", { name: value, exact: true }).click();
    await expect(page.getByRole("button", { name: `Remove ${kind} ${value}`, exact: true })).toBeVisible();
  }
}

async function profileEditor(page: Page) {
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit profile", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeDialog(page: Page, name: "Add item" | "Edit item" | "Edit profile") {
  const dialog = page.getByRole("dialog", { name, exact: true });
  await dialog.getByRole("button", { name: `Close ${name}`, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function selectSection(page: Page, name: "Items" | "Preferences") {
  await page.getByRole("tab", { name, exact: true }).click();
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
}

test("initial signed-out entry is a normal state rather than an error", async ({ page }) => {
  const state = await installApi(page, false);
  await page.goto("/home");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  expect(state.authenticated).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("anonymous profile subpages return Home and restore the requested destination after sign-in", async ({ page }) => {
  await installApi(page, false);
  await page.goto("/profile/preferences");
  await expect(page).toHaveURL(/\/home\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/profile/preferences");
  await expect(page.getByRole("button", { name: "Save preferences" })).not.toBeVisible();
  await signIn(page);
  await expect(page).toHaveURL(/\/profile\/preferences$/);
  await expect(page.getByRole("tab", { name: "Preferences", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list", { name: "Interests list", exact: true }).getByRole("listitem")).toHaveText(["Monitor", "Study supplies"]);
  await expect(page.getByLabel("Interests", { exact: true })).toHaveText("Search interests");
});

test("service unavailability offers retry without treating a member as signed out", async ({ page }) => {
  const state = await installApi(page);
  state.unavailable = true;
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Session unavailable" })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("button", { name: "Edit profile" })).not.toBeVisible();
  state.unavailable = false;
  await page.getByRole("button", { name: /^Retry/ }).click();
  await expect(page.getByRole("heading", { name: "Alice Example", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeEnabled();
});

test("a saved cookie session restores the profile and opens private account fields only on request", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Alice Example", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByLabel("Username", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Display name", { exact: true })).toHaveCount(0);
  const dialog = await profileEditor(page);
  await expect(dialog.getByLabel("Display name", { exact: true })).toHaveValue("Alice Example");
  await expect(dialog.getByLabel("Username", { exact: true })).toHaveValue("alice.test");
  await expect(dialog.getByLabel("Username", { exact: true })).not.toBeEditable();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await profileEditor(page);
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Alice Example");
});

test("account save preserves trading preferences and updates the profile header", async ({ page }) => {
  const state = await installApi(page);
  await page.goto("/profile");
  const dialog = await profileEditor(page);
  await dialog.getByLabel("Display name", { exact: true }).fill("Alice Updated");
  await expect(dialog.getByLabel("Community", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect.poll(() => state.profileSaves.length).toBe(1);
  expect(state.profileSaves[0]).toMatchObject({
    name: "Alice Updated", community: "Test Campus", interests: ["Monitor", "Study supplies"],
    exclusions: ["Damaged items"], gap_limit: 20, expected_revision: 3,
  });
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Alice Updated", exact: true, level: 1 })).toBeVisible();
  await profileEditor(page);
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Alice Updated");
  expect(state.unexpected).toEqual([]);
});

test("preferences update on the same profile page and preserve the saved account details", async ({ page }) => {
  const state = await installApi(page);
  await page.goto("/profile");
  await selectSection(page, "Preferences");
  await expect(page).toHaveURL(/\/profile$/);
  await setEntries(page, "interest", ["Furniture", "Monitor"]);
  await setEntries(page, "exclusion", ["Electronics"]);
  await page.getByRole("combobox", { name: "Estimated value difference (%)", exact: true }).click();
  await page.getByRole("option", { name: "15%", exact: true }).click();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect.poll(() => state.profileSaves.length).toBe(1);
  expect(state.profileSaves[0]).toMatchObject({
    name: "Alice Example", community: "Test Campus", interests: ["Furniture", "Monitor"],
    exclusions: ["Electronics"], gap_limit: 15, expected_revision: 3,
  });
  await expect(page.getByRole("heading", { name: "Alice Example", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Preferences", exact: true }).getByRole("status")).toContainText("Preferences saved");
});

test("closing profile editing and refreshing inventory preserves an unsaved account draft", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  await profileEditor(page);
  await page.getByLabel("Display name", { exact: true }).fill("Unsaved private draft");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("New synthetic draft");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Private draft saved. You can finish it later.", { exact: true })).toBeVisible();
  await closeDialog(page, "Add item");
  await profileEditor(page);
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Unsaved private draft");
});

test("a stale profile save keeps the draft and reports renewed review in its modal", async ({ page }) => {
  const state = await installApi(page);
  state.rejectProfileSave = true;
  await page.goto("/profile");
  const dialog = await profileEditor(page);
  await dialog.getByLabel("Display name", { exact: true }).fill("Keep this draft");
  await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Profile changed");
  await expect(dialog.getByLabel("Display name", { exact: true })).toHaveValue("Keep this draft");
});

test("profile field errors identify the affected modal control and preserve its draft", async ({ page }) => {
  const state = await installApi(page);
  state.profileFieldErrors = [{ field: "body.name", message: "Choose a display name." }];
  await page.goto("/profile");
  const dialog = await profileEditor(page);
  const name = dialog.getByLabel("Display name", { exact: true });
  await name.fill("Keep my name draft");
  await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-describedby", /profile-name-error/);
  await expect(dialog.locator("#profile-name-error")).toHaveText("Choose a display name.");
  await expect(name).toHaveValue("Keep my name draft");
  await expect(dialog.getByRole("alert")).toContainText("Review the highlighted fields");
});

test("logout removes old private drafts before another member signs in", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  await profileEditor(page);
  await page.getByLabel("Display name", { exact: true }).fill("Old member private draft");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/home(?:\?.*)?$/);
  await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toHaveCount(0);
  await signIn(page, "bob.test");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Bob Example", exact: true, level: 1 })).toBeVisible();
  await profileEditor(page);
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Bob Example");
  await expect(page.getByLabel("Display name", { exact: true })).not.toHaveValue("Old member private draft");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Test chair", { exact: true })).not.toBeVisible();
});

test("an invalid login stays on Home with actionable feedback", async ({ page }) => {
  const state = await installApi(page, false);
  state.rejectLogin = true;
  await page.goto("/home");
  await signIn(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Invalid username or password");
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

test("inventory draft saving and photo attachment preserve unsaved details", async ({ page }) => {
  const state = await installApi(page);
  await page.goto("/profile/inventory");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Synthetic desk lamp");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(() => state.itemSaves.length).toBe(1);
  expect(state.itemSaves[0]).toMatchObject({ title: "Synthetic desk lamp", status: "draft" });
  await page.getByLabel("Title", { exact: true }).fill("Unsaved title before upload");
  await page.getByLabel("Description", { exact: true }).fill("Unsaved description before upload");
  await page.getByLabel("Item photo", { exact: true }).setInputFiles({
    name: "synthetic-pixel.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG2kAAAAASUVORK5CYII=", "base64"),
  });
  await expect.poll(() => state.uploads).toBe(1);
  await expect(page.getByText("Photo saved. Enter your item details.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Unsaved title before upload");
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Unsaved description before upload");
  expect(state.itemSaves).toHaveLength(1);
  await page.getByLabel("Title", { exact: true }).fill("Reviewed synthetic desk lamp");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(() => state.itemSaves.length).toBe(2);
  expect(state.itemSaves[1]).toMatchObject({ title: "Reviewed synthetic desk lamp", expected_revision: 2 });
});

test("an item can be removed from the inventory after confirmation", async ({ page }) => {
  const state = await installApi(page);
  await page.goto("/profile/inventory");
  const item = state.view.items.find(candidate => candidate.owner === state.view.profile.id && candidate.status === "available")!;
  await page.getByRole("button", { name: `Remove ${item.title}`, exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(state.itemSaves).toHaveLength(0);
  await page.getByRole("button", { name: `Remove ${item.title}`, exact: true }).click();
  await page.getByRole("button", { name: "Remove item", exact: true }).click();
  await expect.poll(() => state.itemSaves.length).toBe(1);
  expect(state.itemSaves[0]).toMatchObject({ status: "removed", expected_revision: item.revision, title: item.title });
});

test("photo assistance shows the estimate for review without changing the draft", async ({ page }) => {
  const state = await installApi(page);
  state.view.integrations.gemini_configured = true;
  await page.goto("/profile/inventory");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item" });
  await dialog.getByLabel("Title", { exact: true }).fill("My draft title");
  await dialog.getByLabel("Item photo", { exact: true }).setInputFiles({
    name: "synthetic.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG2kAAAAASUVORK5CYII=", "base64"),
  });
  await expect(dialog.getByRole("button", { name: "Estimate price", exact: true })).toBeDisabled();
  await dialog.getByRole("combobox", { name: "Condition", exact: true }).click();
  await page.getByRole("option", { name: "Used", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Estimate price", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Estimate price", exact: true }).click();
  await expect(dialog.getByText(/Suggested value: \$42\.00/)).toBeVisible();
  expect(state.itemSaves).toHaveLength(2);
  await expect(dialog.getByText(/Comparable range: \$30\.00–\$50\.00/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Comparable lamp/ })).toHaveAttribute("href", "https://example.com/synthetic-lamp");
  await expect(dialog.getByTitle("Google Search suggestions")).toHaveCount(0);
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("My draft title");
  await expect(dialog.getByLabel("Comparison value (USD)")).toHaveCount(0);
  await expect(dialog.getByText("Estimate selected")).toBeVisible();
});

test("item evaluation errors stay in the item dialog when navigating to trades", async ({ page }) => {
  const state = await installApi(page);
  state.view.integrations.gemini_configured = true;
  await page.route("**/api/items/*/analysis", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Evaluation temporarily unavailable", code: "ANALYSIS_UNAVAILABLE" }) }));
  await page.goto("/profile/inventory");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item" });
  await dialog.getByLabel("Item photo", { exact: true }).setInputFiles({
    name: "synthetic.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG2kAAAAASUVORK5CYII=", "base64"),
  });
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Synthetic lamp");
  await dialog.getByRole("combobox", { name: "Condition", exact: true }).click();
  await page.getByRole("option", { name: "Used", exact: true }).click();
  await dialog.getByRole("button", { name: "Estimate price", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Evaluation temporarily unavailable");
  await dialog.getByRole("button", { name: "Close Add item" }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Trade", exact: true }).click();
  await expect(page).toHaveURL(/\/trades$/);
  await expect(page.getByText("Evaluation temporarily unavailable")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Trades", exact: true })).toBeVisible();
});

test("a stale item edit retains its reviewed revision and unsaved draft", async ({ page }) => {
  const state = await installApi(page);
  state.rejectItemSave = true;
  await page.goto("/profile/inventory");
  await page.getByRole("button", { name: "Edit Test chair", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit item", exact: true });
  await dialog.getByLabel("Title", { exact: true }).fill("Keep my reviewed item draft");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Item changed");
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Keep my reviewed item draft");
  expect(state.itemSaves[0]).toMatchObject({ title: "Keep my reviewed item draft", expected_revision: 1 });
});

test("photo-first preparation creates only a private draft until reviewed publication", async ({ page }) => {
  const state = await installApi(page);
  state.view.integrations.gemini_configured = true;
  await page.goto("/profile/inventory");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  for (const field of ["Item photo", "Title", "Category", "Condition", "Description"]) {
    const label = dialog.locator("label").filter({ hasText: field });
    await expect(label.locator(".." )).toContainText("*");
  }
  const photo = page.getByLabel("Item photo", { exact: true });
  await expect(photo).toBeEnabled();
  await expect(page.getByRole("button", { name: "Publish listing", exact: true })).toBeDisabled();
  await photo.setInputFiles({
    name: "synthetic-pixel.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG2kAAAAASUVORK5CYII=", "base64"),
  });
  await expect.poll(() => state.uploads).toBe(1);
  await expect(page.getByText("Photo saved. Review the suggested details and choose a condition.", { exact: true })).toBeVisible();
  expect(state.itemSaves).toHaveLength(1);
  expect(state.itemSaves[0]).toMatchObject({ title: "", status: "draft" });
  expect(state.view.items.find(candidate => candidate.id === "test-new-item")?.status).toBe("draft");
  await expect(page.getByRole("button", { name: "Publish listing", exact: true })).toBeDisabled();
  await page.getByLabel("Title", { exact: true }).fill("Reviewed synthetic lamp");
  await page.getByRole("combobox", { name: "Category", exact: true }).click();
  await page.getByRole("option", { name: "Household essentials", exact: true }).click();
  await page.getByRole("combobox", { name: "Condition", exact: true }).click();
  await page.getByRole("option", { name: "Good", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("A synthetic lamp prepared for publication.");
  await expect(page.getByRole("button", { name: "Publish listing", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Estimate price", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish listing", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Publish listing", exact: true }).click();
  await expect(page.getByText("Listing published. It is available for trading.", { exact: true })).toBeVisible();
  expect(state.itemSaves).toHaveLength(3);
  expect(state.itemSaves[2]).toMatchObject({ title: "Reviewed synthetic lamp", status: "available", expected_revision: 3, value_minor: 4200, analysis_id: "test-analysis" });
  expect(state.view.items.find(candidate => candidate.id === "test-new-item")).toMatchObject({ status: "available", image_id: "test-uploaded-image" });
  expect(state.unexpected).toEqual([]);
});

test("mobile item sheets restore focus and keep separate item and new drafts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installApi(page);
  state.view.items.push(item("test-lamp", "test-alice", "Test lamp"));
  await page.goto("/profile");
  const chairEdit = page.getByRole("button", { name: "Edit Test chair", exact: true });
  await chairEdit.click();
  const chairDialog = page.getByRole("dialog", { name: "Edit item", exact: true });
  await expect(chairDialog.getByRole("heading", { name: "Edit item", level: 2, exact: true })).toBeFocused();
  await expect(chairDialog).toBeInViewport();
  await chairDialog.getByLabel("Title", { exact: true }).fill("Unfinished chair edit");
  await page.keyboard.press("Escape");
  await expect(chairDialog).not.toBeVisible();
  await expect(chairEdit).toBeFocused();
  const add = page.getByRole("button", { name: "Add item", exact: true });
  await add.click();
  await expect(page.getByRole("dialog", { name: "Add item", exact: true }).getByRole("heading", { name: "Add item", level: 2, exact: true })).toBeFocused();
  await page.getByLabel("Title", { exact: true }).fill("Unfinished new item");
  await closeDialog(page, "Add item");
  await expect(add).toBeFocused();
  await page.getByRole("button", { name: "Edit Test lamp", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Unfinished lamp edit");
  await closeDialog(page, "Edit item");
  await chairEdit.click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Unfinished chair edit");
  await closeDialog(page, "Edit item");
  await add.click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Unfinished new item");
  await closeDialog(page, "Add item");
  await selectSection(page, "Preferences");
  await expect(page).toHaveURL(/\/profile$/);
  await selectSection(page, "Items");
  await add.click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Unfinished new item");
  expect(state.itemSaves).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("add item sheet blurs and protects the profile while trapping keyboard focus", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  const add = page.getByRole("button", { name: "Add item", exact: true });
  await add.click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  const overlay = page.locator('[data-slot="modal-overlay"]');
  await expect(overlay).toBeVisible();
  const blur = await overlay.evaluate(element => getComputedStyle(element).backdropFilter || getComputedStyle(element).getPropertyValue("-webkit-backdrop-filter"));
  expect(blur).toMatch(/blur\(/);
  const heading = dialog.getByRole("heading", { name: "Add item", exact: true });
  await expect(heading).toBeFocused();
  await dialog.getByRole("button", { name: "Close Add item", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(add).toBeFocused();
});

test("outside dismissal keeps the unfinished item and returns to the same profile", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  const add = page.getByRole("button", { name: "Add item", exact: true });
  await add.click();
  await page.getByLabel("Title", { exact: true }).fill("Draft kept after clicking outside");
  await page.locator('[data-slot="modal-overlay"]').click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect(page).toHaveURL(/\/profile$/);
  await add.click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Draft kept after clicking outside");
});

test("preferences draft remains in the profile while switching its tabs", async ({ page }) => {
  const state = await installApi(page);
  await page.goto("/profile");
  await selectSection(page, "Preferences");
  await page.getByLabel("Interests", { exact: true }).click();
  await page.getByRole("menuitem", { name: "Furniture", exact: true }).click();
  await page.getByRole("combobox", { name: "Estimated value difference (%)", exact: true }).click();
  await page.getByRole("option", { name: "12%", exact: true }).click();
  await selectSection(page, "Items");
  await expect(page.getByRole("button", { name: "Add item", exact: true })).toBeVisible();
  await selectSection(page, "Preferences");
  await expect(page.getByRole("button", { name: "Remove interest Furniture", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Estimated value difference (%)", exact: true })).toHaveText("12%");
  await expect(page).toHaveURL(/\/profile$/);
  expect(state.profileSaves).toEqual([]);
});

test("profile navigation opens the offer workspace at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto("/profile/inventory");
  const main = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await expect(main.getByRole("link")).toHaveText(["Home", "Profile", "Trade"]);
  await expect(main.getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("tab", { name: "Items", exact: true })).toHaveAttribute("aria-selected", "true");
  await selectSection(page, "Preferences");
  await expect(page).toHaveURL(/\/profile\/inventory$/);
  await expect(page.getByLabel("Interests", { exact: true })).toBeVisible();
  await main.getByRole("link", { name: "Trade", exact: true }).click();
  await expect(page).toHaveURL(/\/trades$/);
  await expect(page.getByText("Choose your exchange", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send offer" })).toHaveCount(0);
  await expect(page.getByText("Choose an item on Home to start an offer.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const [legacy, canonical] of [
  ["/inventory", "/profile/inventory"], ["/preferences", "/profile/preferences"],
  ["/trade", "/trades"],
]) {
  test(`legacy ${legacy} redirects to ${canonical}`, async ({ page }) => {
    await installApi(page);
    await page.goto(legacy);
    await expect(page).toHaveURL(new RegExp(`${canonical}$`));
  });
}

test("discovery retains the signed-in marketplace and profile sidebar", async ({ page }) => {
  await installApi(page);
  await page.goto("/discover");
  await expect(page).toHaveURL(/\/\?view=matches#browse$/);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByText("Test monitor").first()).toBeVisible();
  await page.getByRole("button", { name: "Build an offer" }).first().click();
  await expect(page).toHaveURL(/\/trades$/);
  await expect(page.getByText("Bob Example", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Trade with")).toHaveCount(0);
});

test("a listing on Home starts an offer with its owner and item selected", async ({ page }) => {
  await installApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "View details for Test monitor" }).click();
  await page.getByRole("link", { name: "Compose an offer" }).click();
  await expect(page).toHaveURL(/\/trades$/);
  await expect(page.getByText("Bob Example", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Test monitor/ })).toBeChecked();
});

test("DynamoDB semantic matching displays semantic candidates", async ({ page }) => {
  const state = await installApi(page);
  state.view.storage = "dynamodb";
  state.view.integrations.bedrock_configured = true;
  state.view.profile.interests = ["computer display"];
  await page.goto("/?view=matches#browse");
  await expect(page.getByRole("switch", { name: "Semantic matching" })).toBeChecked();
  const request = page.waitForRequest((candidate) => candidate.url().includes('/api/recommendations?') && candidate.method() === 'GET');
  await page.getByRole("button", { name: "Find bundle matches" }).click();
  expect(new URL((await request).url()).searchParams.get('semantic')).toBe('true');
  await expect(page.getByText("Test monitor").first()).toBeVisible();
  await expect(page.getByText("Synthetic eligible recommendation.")).toBeVisible();
});

test("the signed-out landing page offers account access without a sidebar", async ({ page }) => {
  await installApi(page, false);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Join Bartr" })).toBeVisible();
  await expect(page.locator("header").first().getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("sidebar collapses to accessible navigation and expands again", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installApi(page);
  await page.goto("/profile");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-pressed", "true");
  await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
  await nav.getByRole("link", { name: "Trade" }).click();
  await expect(page).toHaveURL(/\/trades$/);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-pressed", "false");
});

test("Home opens the landing page and account access remains available", async ({ page }) => {
  await installApi(page);
  await page.goto("/profile");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Bart.*r/i, level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});

test("keyboard sign-in and profile saving work in the mobile layout", async ({ page }, testInfo) => {
  const state = await installApi(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");
  await page.getByLabel("Username", { exact: true }).focus();
  await page.keyboard.type("alice.test");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.type("synthetic-password");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/profile$/);
  await profileEditor(page);
  const displayName = page.getByLabel("Display name", { exact: true });
  await expect(displayName).toHaveValue("Alice Example");
  await displayName.focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" Keyboard");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Reload profile", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save profile", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Alice Example Keyboard", exact: true, level: 1 })).toBeVisible();
  expect(state.profileSaves[0]).toMatchObject({ name: "Alice Example Keyboard" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("profile-mobile.png"), fullPage: true });
  await selectSection(page, "Preferences");
  await expect(page.getByRole("button", { name: "Save preferences", exact: true })).toBeVisible();
  await selectSection(page, "Items");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("browse listings stay usable on desktop and mobile", async ({ page }, testInfo) => {
  const state = await installApi(page);
  state.view.items.push(
    item("test-lamp", "test-bob", "A longer synthetic desk lamp name"),
    item("test-keyboard", "test-bob", "Synthetic keyboard"),
    item("test-speaker", "test-bob", "Synthetic speaker"),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const member = page.getByRole("article", { name: "Bob Example" });
  await expect(member).toBeVisible();
  await member.getByRole("button", { name: "Show all 4 items" }).click();
  await expect(member.getByText("Synthetic speaker")).toBeVisible();
  await member.getByRole("button", { name: "View details for Test monitor" }).click();
  await expect(page.getByRole("dialog")).toContainText("Synthetic test listing");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(member).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("browse-mobile.png"), fullPage: true });
});
