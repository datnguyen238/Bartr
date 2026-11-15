import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryScreen } from "@/components/inventory/inventory-screen";
import { ApiError, type Item } from "@/lib/marketplace";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), api: vi.fn(), workspace: {} as Record<string, unknown> }));

vi.mock("@/components/workspace/provider", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("@/lib/marketplace", async () => ({
  ...await vi.importActual<typeof import("@/lib/marketplace")>("@/lib/marketplace"),
  upload: mocks.upload, api: mocks.api,
}));

const savedItem: Item = {
  id: "synthetic-draft", owner: "alice", revision: 2, title: "Saved title", description: "Saved description",
  category: "Furniture", condition: "Good", image_id: null, value_minor: null, value_source: "unknown",
  value_set_at: null, uncertainty: null, status: "draft", analysis: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace = {
    view: { profile: { id: "alice" }, integrations: { gemini_configured: false, bedrock_configured: false } }, busy: false, seeded: false, listingDirty: true, mine: [savedItem], editing: savedItem,
    form: { title: "Unsaved title", description: "Unsaved description", category: "Furniture", condition: "Good", value: "", status: "draft" },
    setMessage: vi.fn(), setEditing: vi.fn(), setForm: vi.fn(), edit: vi.fn(), replaceItemDraft: vi.fn(), saveItem: vi.fn(async () => savedItem),
    load: vi.fn(async () => ({ profile: { id: "alice" } })),
    guardSession: vi.fn(async <T,>(promise: Promise<T>) => promise),
    run: vi.fn(async (action: () => Promise<void>) => { try { await action(); } catch { /* shared provider owns feedback */ } }),
  };
});

function renderEditor() {
  const result = render(<InventoryScreen />);
  const selected = mocks.workspace.editing as Item | null;
  const button = selected
    ? screen.getByRole("button", { name: `Edit ${selected.title || "untitled draft"}` })
    : screen.getByRole("button", { name: "Add item" });
  button.focus();
  fireEvent.click(button);
  vi.mocked(mocks.workspace.edit as () => void).mockClear();
  return result;
}

describe("inventory photo attachment", () => {
  it("updates the saved editing revision without replacing unsaved listing fields", async () => {
    const attached = { ...savedItem, revision: 3, image_id: "synthetic-image" };
    mocks.upload.mockResolvedValue(attached);
    renderEditor();
    fireEvent.change(screen.getByLabelText("Item photo"), { target: { files: [new File(["synthetic"], "photo.png", { type: "image/png" })] } });
    await waitFor(() => expect(mocks.workspace.setMessage).toHaveBeenCalledWith("Photo saved. Review your details before publishing."));
    const update = vi.mocked(mocks.workspace.setEditing as (updater: (current: Item) => Item) => void).mock.calls[0][0];
    expect(update(savedItem)).toEqual(attached);
    expect(update({ ...savedItem, id: "another-draft" })).toEqual({ ...savedItem, id: "another-draft" });
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
    expect(mocks.workspace.setForm).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
    expect(screen.getByLabelText("Description")).toHaveValue("Unsaved description");
    expect(mocks.workspace.load).toHaveBeenCalledOnce();
  });

  it("withholds photo state updates when the session guard rejects a late response", async () => {
    mocks.upload.mockResolvedValue({ ...savedItem, revision: 3, image_id: "synthetic-image" });
    mocks.workspace.guardSession = vi.fn(async (promise: Promise<unknown>) => {
      await promise;
      throw new Error("Session was superseded");
    });
    renderEditor();
    fireEvent.change(screen.getByLabelText("Item photo"), { target: { files: [new File(["synthetic"], "photo.png", { type: "image/png" })] } });
    await waitFor(() => expect(mocks.workspace.guardSession).toHaveBeenCalledOnce());
    expect(mocks.workspace.setEditing).not.toHaveBeenCalled();
    expect(mocks.workspace.setForm).not.toHaveBeenCalled();
    expect(mocks.workspace.load).not.toHaveBeenCalled();
    expect(mocks.workspace.setMessage).not.toHaveBeenCalled();
  });
});

describe("stale listing review", () => {
  it("reviews the latest saved facts without adopting its revision until the member explicitly replaces the draft", async () => {
    const latest = { ...savedItem, revision: 3, title: "Changed elsewhere", description: "Latest saved description", category: "Electronics", condition: "Fair", value_minor: 2500, status: "available" as const };
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [latest] }));
    renderEditor();
    fireEvent.click(screen.getByText("Saved version and listing options"));
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Latest saved listing" })).toBeVisible());
    expect(screen.getByText("Latest saved description")).toBeVisible();
    expect(screen.getByText("Electronics", { exact: true })).toBeVisible();
    expect(screen.getByText("$25.00", { exact: true })).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
    expect((mocks.workspace.editing as Item).revision).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Replace draft with saved listing" }));
    await waitFor(() => expect(mocks.workspace.replaceItemDraft).toHaveBeenCalledWith(latest));
  });

  it.each(["reserved", "exchanged", "removed"] as const)("does not adopt a %s listing into an editable draft", async (status) => {
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [{ ...savedItem, revision: 3, status }] }));
    renderEditor();
    fireEvent.click(screen.getByText("Saved version and listing options"));
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(screen.getByText(/This listing is no longer editable/)).toBeVisible());
    expect(screen.queryByRole("button", { name: "Replace draft with saved listing" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
  });

  it("keeps the draft when the saved listing is unavailable", async () => {
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [] }));
    renderEditor();
    fireEvent.click(screen.getByText("Saved version and listing options"));
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(screen.getByText(/This listing is no longer available/)).toBeVisible());
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
  });

  it("hides a saved comparison after the active member changes", async () => {
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [{ ...savedItem, revision: 3, description: "Private comparison" }] }));
    const { rerender } = renderEditor();
    fireEvent.click(screen.getByText("Saved version and listing options"));
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(screen.getByText("Private comparison")).toBeVisible());
    mocks.workspace.view = { profile: { id: "bob" }, integrations: { gemini_configured: false, bedrock_configured: false } };
    rerender(<InventoryScreen />);
    expect(screen.queryByText("Private comparison")).not.toBeInTheDocument();
  });

  it("does not reveal a late saved comparison after its session was superseded", async () => {
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [{ ...savedItem, revision: 3 }] }));
    mocks.workspace.guardSession = vi.fn(async (promise: Promise<unknown>) => { await promise; throw new Error("Superseded session"); });
    renderEditor();
    fireEvent.click(screen.getByText("Saved version and listing options"));
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(mocks.workspace.guardSession).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { name: "Latest saved listing" })).not.toBeInTheDocument();
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
  });
});

describe("listing preparation", () => {
  it("creates a private draft behind a new item's photo attachment", async () => {
    const newDraft = { ...savedItem, id: "new-photo-draft", revision: 1 };
    mocks.workspace.editing = null;
    mocks.workspace.saveItem = vi.fn(async () => newDraft);
    const attached = { ...newDraft, revision: 2, image_id: "new-image" };
    mocks.upload.mockResolvedValue(attached);
    const { rerender } = renderEditor();
    expect(screen.getByLabelText("Item photo")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Item photo"), { target: { files: [new File(["synthetic"], "new.png", { type: "image/png" })] } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith(newDraft, expect.any(File)));
    expect(mocks.workspace.saveItem).toHaveBeenCalledWith({ status: "draft" });
    expect(mocks.workspace.saveItem).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Photo saved"));
    mocks.workspace.editing = attached;
    mocks.workspace.mine = [attached];
    rerender(<InventoryScreen />);
    expect(screen.getByRole("dialog", { name: "Add item" })).toBeVisible();
  });

  it("does not upload if creating the private draft fails", async () => {
    mocks.workspace.editing = null;
    mocks.workspace.saveItem = vi.fn(async () => { throw new Error("Unable to save draft. Try again."); });
    renderEditor();
    fireEvent.change(screen.getByLabelText("Item photo"), { target: { files: [new File(["synthetic"], "new.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to save draft"));
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.workspace.setEditing).not.toHaveBeenCalled();
  });

  it("keeps publication disabled until required listing information and photo exist", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: "Publish listing" })).toBeDisabled();
    expect(screen.getByText("Photo: needed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
  });

  it("publishes reviewed complete details explicitly and permits an unknown value", async () => {
    mocks.workspace.editing = { ...savedItem, image_id: "reviewed-image" };
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));
    await waitFor(() => expect(mocks.workspace.saveItem).toHaveBeenCalledWith({ status: "available" }));
    expect(screen.getByRole("status")).toHaveTextContent("Listing published");
    expect(screen.getByLabelText("Comparison value (USD, optional)")).toHaveValue(null);
  });

  it("opens an item in a focused modal and restores focus without discarding its fields", async () => {
    render(<InventoryScreen />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Edit Saved title" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Edit item", level: 2 })).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Edit item" })).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Edit item" })).toHaveAttribute("aria-modal", "true");
    expect(mocks.workspace.edit).toHaveBeenCalledWith(savedItem);
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
    fireEvent.click(screen.getByRole("button", { name: "Close Edit item" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(mocks.workspace.setForm).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
  });

  it("keeps the manager visible and presents new items only after Add item", async () => {
    mocks.workspace.editing = null;
    render(<InventoryScreen embedded />);
    expect(screen.getByRole("heading", { name: "Your items", level: 2 })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Item photo")).not.toBeInTheDocument();
    const add = screen.getByRole("button", { name: "Add item" });
    add.focus();
    fireEvent.click(add);
    expect(screen.getByRole("dialog", { name: "Add item" })).toBeVisible();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Add item", level: 2 })).toHaveFocus());
    fireEvent.keyDown(document.activeElement!, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(add).toHaveFocus());
    expect(mocks.workspace.setForm).not.toHaveBeenCalled();
  });

  it("closes a modal when its profile section is no longer active without replacing the draft", async () => {
    const { rerender } = renderEditor();
    expect(screen.getByRole("dialog")).toBeVisible();
    rerender(<InventoryScreen embedded active={false} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.workspace.setForm).not.toHaveBeenCalled();
    expect(mocks.workspace.replaceItemDraft).not.toHaveBeenCalled();
  });

  it("does not bypass value validation when publication is chosen", () => {
    mocks.workspace.editing = { ...savedItem, image_id: "reviewed-image" };
    mocks.workspace.form = { ...(mocks.workspace.form as Record<string, unknown>), value: "-1" };
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));
    expect(screen.getByLabelText("Comparison value (USD, optional)")).toBeInvalid();
    expect(mocks.workspace.saveItem).not.toHaveBeenCalled();
  });

  it("places returned field errors beside their listing controls", async () => {
    mocks.workspace.saveItem = vi.fn(async () => { throw new ApiError("Review the highlighted detail.", 422, "VALIDATION_ERROR", [{ field: "title", message: "Use a shorter item title." }]); });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription("Use a shorter item title.");
    expect(screen.getByRole("alert")).toHaveTextContent("Review the highlighted item details");
  });

  it("normalizes dotted server field paths for local feedback", async () => {
    mocks.workspace.saveItem = vi.fn(async () => { throw new ApiError("body.title: A title is needed.", 422, "VALIDATION_ERROR", [{ field: "body.title", message: "A title is needed." }]); });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveAccessibleDescription("A title is needed."));
    expect(screen.getByRole("alert")).toHaveTextContent("Title: A title is needed.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("body.title");
  });

  it.each(["reserved", "removed", "missing"] as const)("locks a dirty editor when the saved inventory reports %s", (status) => {
    const cached = { ...savedItem, status: "available" as const, revision: 2 };
    mocks.workspace.editing = cached;
    mocks.workspace.mine = [cached];
    mocks.workspace.form = { ...(mocks.workspace.form as Record<string, unknown>), status: "available" };
    const { rerender } = renderEditor();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    mocks.workspace.mine = status === "missing" ? [] : [{ ...cached, revision: 3, status }];
    rerender(<InventoryScreen />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByLabelText("Item photo")).toBeDisabled();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
    expect(screen.getByRole("status")).toHaveTextContent(status === "missing" ? "isn’t in your current saved inventory" : status === "reserved" ? "Current status: Reserved for a trade" : "Current status: Removed");
    expect(screen.getByRole("button", { name: "Check saved listing" })).toBeEnabled();
    expect((mocks.workspace.editing as Item).revision).toBe(2);
    expect(mocks.workspace.setForm).not.toHaveBeenCalled();
    expect(mocks.workspace.replaceItemDraft).not.toHaveBeenCalled();
  });
});
