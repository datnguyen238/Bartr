"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useWorkspace } from "./provider";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { view, hasSession, seeded, busy, message, error, signOut } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [signOutError, setSignOutError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const links = hasSession
    ? [{ href: "/", label: "Home", icon: "home" }, { href: "/profile", label: "Profile", icon: "account" }, { href: "/trades", label: "Trade", icon: "trade" }] as const
    : [{ href: "/", label: "Home", icon: "home" }, { href: "/trades", label: "Trade", icon: "trade" }] as const;
  const localFeedback = pathname === "/home" || pathname.startsWith("/profile");
  return (
    <div className="app-shell" data-sidebar={sidebarCollapsed ? "collapsed" : "expanded"} data-authenticated={hasSession}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {hasSession && <aside className="app-rail">
        <div className="rail-header">
          <Link className="wordmark" href="/" aria-label="Bartr home">{sidebarCollapsed ? "b" : "bartr"}<span>.</span></Link>
          <Button variant="ghost" size="icon" className="sidebar-toggle" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={sidebarCollapsed} aria-controls="main-navigation" onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}</Button>
        </div>
        <nav id="main-navigation" className="app-navigation" aria-label="Main navigation">
          {links.map(({ href, label, icon }) => <Link key={href} href={href} aria-label={label} className="app-nav-link" aria-current={pathname === href || (href === "/profile" && pathname.startsWith("/profile/")) ? "page" : undefined}><Icon name={icon} /><span>{label}</span></Link>)}
          {hasSession && <button type="button" className="app-nav-link app-nav-logout" aria-label="Sign out" disabled={busy} onClick={async () => { setSignOutError(""); try { await signOut(); router.replace("/home"); } catch { setSignOutError("We couldn’t sign you out. Your account is still open; try Sign out again."); } }}><LogOut size={20} aria-hidden="true" /><span>Sign out</span></button>}
        </nav>
      </aside>}
      <div className="app-body">
        <main id="main-content" className="workspace-content" tabIndex={-1}>
          {hasSession && view.storage === "temporary-memory" && <details className="preview-details"><summary>Preview</summary><p>Temporary preview: accounts and listings disappear when the service restarts.</p></details>}
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
