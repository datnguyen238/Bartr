import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryScreen } from "@/components/inventory/inventory-screen";
import type { Item } from "@/lib/marketplace";

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
    view: { profile: { id: "alice" } }, busy: false, mine: [savedItem], editing: savedItem,
    form: { title: "Unsaved title", description: "Unsaved description", category: "Furniture", condition: "Good", value: "", status: "draft" },
    setMessage: vi.fn(), setEditing: vi.fn(), setForm: vi.fn(), edit: vi.fn(), saveItem: vi.fn(),
    load: vi.fn(async () => ({ profile: { id: "alice" } })),
    guardSession: vi.fn(async <T,>(promise: Promise<T>) => promise),
    run: vi.fn(async (action: () => Promise<void>) => { try { await action(); } catch { /* shared provider owns feedback */ } }),
  };
});

describe("inventory photo attachment", () => {
  it("updates the saved editing revision without replacing unsaved listing fields", async () => {
    const attached = { ...savedItem, revision: 3, image_id: "synthetic-image" };
    mocks.upload.mockResolvedValue(attached);
    render(<InventoryScreen />);
    fireEvent.change(screen.getByLabelText("Item photo"), { target: { files: [new File(["synthetic"], "photo.png", { type: "image/png" })] } });
    await waitFor(() => expect(mocks.workspace.setMessage).toHaveBeenCalledWith("Photo normalized and saved. Review before publishing."));
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
    render(<InventoryScreen />);
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
    render(<InventoryScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Latest saved listing" })).toBeVisible());
    expect(screen.getByText("Latest saved description")).toBeVisible();
    expect(screen.getByText("Electronics", { exact: true })).toBeVisible();
    expect(screen.getByText("$25.00", { exact: true })).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
    expect((mocks.workspace.editing as Item).revision).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Replace draft with saved listing" }));
    await waitFor(() => expect(mocks.workspace.edit).toHaveBeenCalledWith(latest));
  });

  it.each(["reserved", "exchanged", "removed"] as const)("does not adopt a %s listing into an editable draft", async (status) => {
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [{ ...savedItem, revision: 3, status }] }));
    render(<InventoryScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(screen.getByText(/This listing is no longer editable/)).toBeVisible());
    expect(screen.queryByRole("button", { name: "Replace draft with saved listing" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save listing" })).toBeDisabled();
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved title");
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
  });

  it("keeps the draft when the saved listing is unavailable", async () => {
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [] }));
    render(<InventoryScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(screen.getByText(/This listing is no longer available/)).toBeVisible());
    expect(screen.getByRole("button", { name: "Save listing" })).toBeDisabled();
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
  });

  it("hides a saved comparison after the active member changes", async () => {
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [{ ...savedItem, revision: 3, description: "Private comparison" }] }));
    const { rerender } = render(<InventoryScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(screen.getByText("Private comparison")).toBeVisible());
    mocks.workspace.view = { profile: { id: "bob" } };
    rerender(<InventoryScreen />);
    expect(screen.queryByText("Private comparison")).not.toBeInTheDocument();
  });

  it("does not reveal a late saved comparison after its session was superseded", async () => {
    mocks.workspace.load = vi.fn(async () => ({ profile: { id: "alice" }, items: [{ ...savedItem, revision: 3 }] }));
    mocks.workspace.guardSession = vi.fn(async (promise: Promise<unknown>) => { await promise; throw new Error("Superseded session"); });
    render(<InventoryScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Review latest saved listing" }));
    await waitFor(() => expect(mocks.workspace.guardSession).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { name: "Latest saved listing" })).not.toBeInTheDocument();
    expect(mocks.workspace.edit).not.toHaveBeenCalled();
  });
});
