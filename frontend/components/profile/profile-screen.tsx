"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { useWorkspace } from "@/components/workspace/provider";
import { InventoryScreen } from "@/components/inventory/inventory-screen";
import { AccountScreen } from "./account-screen";
import { PreferencesScreen } from "./preferences-screen";

type ProfileSection = "items" | "preferences";

export function ProfileScreen({ initialSection = "items" }: { initialSection?: ProfileSection }) {
  const { view, mine } = useWorkspace();
  const [section, setSection] = useState<ProfileSection>(initialSection);
  const [editingProfile, setEditingProfile] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const itemTab = useRef<HTMLButtonElement>(null);
  const preferenceTab = useRef<HTMLButtonElement>(null);
  useEffect(() => { setSection(initialSection); setEditingProfile(false); }, [initialSection]);
  const profile = view.profile;
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join("").toLocaleUpperCase() || "B";
  const itemCount = mine.filter(item => item.status !== "removed").length;
  const availableCount = mine.filter(item => item.status === "available").length;
  const draftCount = mine.filter(item => item.status === "draft").length;

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
    let next: ProfileSection | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") next = section === "items" ? "preferences" : "items";
    if (event.key === "Home") next = "items";
    if (event.key === "End") next = "preferences";
    if (!next) return;
    event.preventDefault();
    setSection(next);
    (next === "items" ? itemTab : preferenceTab).current?.focus();
  }

  return <section className="profile-hub" aria-label="Your profile">
    <header className="profile-identity">
      <div className="profile-avatar" aria-hidden="true">{initials}</div>
      <div className="profile-identity-copy">
        <h1 className="screen-title">{profile.name}</h1>
      </div>
      <Button ref={editButton} variant="outline" onClick={() => setEditingProfile(true)}><Icon name="account" />Edit profile</Button>
      <dl className="profile-stats" aria-label="Your inventory summary">
        <div><dt>Items</dt><dd>{itemCount}</dd></div>
        <div><dt>Available</dt><dd>{availableCount}</dd></div>
        <div><dt>Private drafts</dt><dd>{draftCount}</dd></div>
      </dl>
    </header>
    <div className="profile-tabs" role="tablist" aria-label="Profile sections">
      <button ref={itemTab} id="profile-items-tab" type="button" role="tab" aria-selected={section === "items"} aria-controls="profile-items-panel" tabIndex={section === "items" ? 0 : -1} onKeyDown={navigateTabs} onClick={() => setSection("items")}><Icon name="inventory" />Items</button>
      <button ref={preferenceTab} id="profile-preferences-tab" type="button" role="tab" aria-selected={section === "preferences"} aria-controls="profile-preferences-panel" tabIndex={section === "preferences" ? 0 : -1} onKeyDown={navigateTabs} onClick={() => setSection("preferences")}><Icon name="preferences" />Preferences</button>
    </div>
    <div id="profile-items-panel" role="tabpanel" aria-labelledby="profile-items-tab" className="profile-tab-panel" hidden={section !== "items"}>
      <InventoryScreen embedded active={section === "items"} />
    </div>
    <div id="profile-preferences-panel" role="tabpanel" aria-labelledby="profile-preferences-tab" className="profile-tab-panel" hidden={section !== "preferences"}>
      <PreferencesScreen embedded />
    </div>
    <ModalSheet open={editingProfile} onOpenChange={setEditingProfile} title="Edit profile" description="Update the name other members see. Changes are saved only when you choose Save profile." returnFocusRef={editButton} className="profile-edit-sheet">
      <AccountScreen embedded onSaved={() => setEditingProfile(false)} />
    </ModalSheet>
  </section>;
}
