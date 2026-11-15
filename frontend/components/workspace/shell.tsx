"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useWorkspace } from "./provider";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { view, hasSession, seeded, busy, message, error, signOut } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [signOutError, setSignOutError] = useState("");
  const links = hasSession
    ? [{ href: "/home", label: "Home", icon: "home" }, { href: "/profile/inventory", label: "Inventory", icon: "inventory" }, { href: "/profile/preferences", label: "Preferences", icon: "preferences" }, { href: "/trade", label: "Trade", icon: "trade" }] as const
    : [{ href: "/home", label: "Home", icon: "home" }, { href: "/trade", label: "Trade", icon: "trade" }] as const;
  const localFeedback = pathname === "/home" || pathname.startsWith("/profile");
  return (
    <div className={`app-shell ${hasSession ? "" : "app-shell-public"}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="app-rail">
        <Link className="wordmark" href="/home" aria-label="Bartr home">bartr<span>.</span></Link>
        <nav className="app-navigation" aria-label="Main navigation">
          {links.map(({ href, label, icon }) => <Link key={href} href={href} className="app-nav-link" aria-current={pathname === href ? "page" : undefined}><Icon name={icon} /><span>{label}</span></Link>)}
        </nav>
        {hasSession && <div className="rail-note"><Icon name="trade" /><p>Good things deserve<br />another chapter.</p></div>}
      </aside>
      <div className="app-body">
        {hasSession && <header className="app-topbar">
          <Link className="wordmark mobile-wordmark" href="/home" aria-label="Bartr home">bartr<span>.</span></Link>
          <p className="workspace-community">{view.profile.community}</p>
          {view.storage === "temporary-memory" && <details className="preview-details"><summary>Preview</summary><p>Temporary preview: accounts and listings disappear when the service restarts.</p></details>}
          <div className="account-actions">
            <Link className="account-link" href="/profile" aria-current={pathname === "/profile" ? "page" : undefined}><span className="account-avatar" aria-hidden="true">{Array.from(view.profile.name.trim())[0]?.toLocaleUpperCase() || "B"}</span><span>Account</span></Link>
            <Button variant="ghost" disabled={busy} onClick={async () => { setSignOutError(""); try { await signOut(); router.replace("/home"); } catch { setSignOutError("We couldn’t sign you out. Your account is still open; try Sign out again."); } }}>Sign out</Button>
          </div>
        </header>}
        <main id="main-content" className="workspace-content" tabIndex={-1}>
          {signOutError && hasSession && <p className="inline-feedback is-error mb-6" role="alert">{signOutError}</p>}
          {seeded && <p className="preview-notice">Sample preview. These items are fictional; sign-in and saving are unavailable.</p>}
          {!localFeedback && <div className="sr-only" role="status" aria-live="polite">{busy ? "Working…" : message}</div>}
          {!localFeedback && error && <p className="inline-feedback is-error" role="alert">{error}</p>}
          {!localFeedback && message && <p className="inline-feedback" role="status">{message}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
