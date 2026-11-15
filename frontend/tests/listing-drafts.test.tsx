import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { listingForm, useListingDrafts } from "@/components/workspace/listing-drafts";
import type { Item } from "@/lib/marketplace";

const chair: Item = {
  id: "synthetic-chair", owner: "synthetic-member", revision: 1,
  title: "Study chair", description: "A wooden chair", category: "Furniture", condition: "Good",
  image_id: null, value_minor: 4000, value_source: "owner", value_set_at: null,
  uncertainty: null, status: "draft", analysis: null,
};
const lamp: Item = { ...chair, id: "synthetic-lamp", title: "Desk lamp" };

function mountDrafts() {
  let drafts!: ReturnType<typeof useListingDrafts>;
  function Editor() {
    drafts = useListingDrafts();
    return <>
      <label>Title<input value={drafts.form.title} onChange={(event) => drafts.setForm((current) => ({ ...current, title: event.target.value }))} /></label>
      <output aria-label="Selected">{drafts.editing?.id ?? "new"}</output>
      <output aria-label="Revision">{drafts.editing?.revision ?? 0}</output>
      <output aria-label="Dirty">{String(drafts.listingDirty)}</output>
      <button onClick={() => drafts.edit(null)}>New item</button>
      <button onClick={() => drafts.edit(chair)}>Edit chair</button>
      <button onClick={() => drafts.edit(lamp)}>Edit lamp</button>
    </>;
  }
  const mounted = render(<Editor />);
  return { get drafts() { return drafts; }, ...mounted };
}

describe("listing draft journeys", () => {
  it("keeps separate unfinished drafts when switching between existing and new items", () => {
    mountDrafts();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New unfinished item" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit chair" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Study chair");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My unsaved chair title" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit lamp" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My unsaved lamp title" } });
    fireEvent.click(screen.getByRole("button", { name: "New item" }));
    expect(screen.getByLabelText("Title")).toHaveValue("New unfinished item");
    fireEvent.click(screen.getByRole("button", { name: "Edit chair" }));
    expect(screen.getByLabelText("Title")).toHaveValue("My unsaved chair title");
    fireEvent.click(screen.getByRole("button", { name: "Edit lamp" }));
    expect(screen.getByLabelText("Title")).toHaveValue("My unsaved lamp title");
    expect(screen.getByLabelText("Dirty")).toHaveTextContent("true");
  });

  it("keeps dirty facts and their reviewed revision when an external refresh changes the listing", () => {
    const mounted = mountDrafts();
    fireEvent.click(screen.getByRole("button", { name: "Edit chair" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My unfinished edit" } });
    const changed = { ...chair, revision: 2, title: "Updated elsewhere" };
    act(() => mounted.drafts.reconcileListings([changed]));
    expect(screen.getByLabelText("Title")).toHaveValue("My unfinished edit");
    expect(screen.getByLabelText("Revision")).toHaveTextContent("1");
    act(() => mounted.drafts.edit(changed));
    expect(screen.getByLabelText("Title")).toHaveValue("My unfinished edit");
    act(() => mounted.drafts.replaceItemDraft(changed));
    expect(screen.getByLabelText("Title")).toHaveValue("Updated elsewhere");
    expect(screen.getByLabelText("Revision")).toHaveTextContent("2");
    expect(screen.getByLabelText("Dirty")).toHaveTextContent("false");
  });

  it("refreshes untouched facts and retains unsaved fields while a photo updates the revision", () => {
    const mounted = mountDrafts();
    fireEvent.click(screen.getByRole("button", { name: "Edit chair" }));
    act(() => mounted.drafts.reconcileListings([{ ...chair, title: "Latest title", revision: 2 }]));
    expect(screen.getByLabelText("Title")).toHaveValue("Latest title");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved with photo" } });
    act(() => mounted.drafts.setEditing((current) => current ? { ...current, image_id: "synthetic-image", revision: 3 } : current));
    expect(screen.getByLabelText("Title")).toHaveValue("Unsaved with photo");
    expect(screen.getByLabelText("Revision")).toHaveTextContent("3");
    expect(screen.getByLabelText("Dirty")).toHaveTextContent("true");
  });

  it("reconciles a successful new-item save without resurrecting the previous new draft", () => {
    const mounted = mountDrafts();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New chair" } });
    const submitted = { ...mounted.drafts.form };
    const saved = { ...chair, title: "New chair" };
    act(() => mounted.drafts.savedListing(saved, submitted, null));
    expect(screen.getByLabelText("Selected")).toHaveTextContent(chair.id);
    expect(screen.getByLabelText("Dirty")).toHaveTextContent("false");
    fireEvent.click(screen.getByRole("button", { name: "New item" }));
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("preserves typing made during a save and does not switch the member away from another item", () => {
    const mounted = mountDrafts();
    fireEvent.click(screen.getByRole("button", { name: "Edit chair" }));
    const submitted = listingForm(chair);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Later typing" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit lamp" }));
    act(() => mounted.drafts.savedListing({ ...chair, revision: 2 }, submitted, chair));
    expect(screen.getByLabelText("Selected")).toHaveTextContent(lamp.id);
    fireEvent.click(screen.getByRole("button", { name: "Edit chair" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Later typing");
    expect(screen.getByLabelText("Revision")).toHaveTextContent("2");
  });

  it("clears every cached draft when the member session ends", () => {
    const mounted = mountDrafts();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Private new draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit chair" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Private saved draft" } });
    act(() => mounted.drafts.resetListingDrafts());
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(mounted.drafts.hasListingDrafts).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Edit chair" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Study chair");
    fireEvent.click(screen.getByRole("button", { name: "New item" }));
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });
});
