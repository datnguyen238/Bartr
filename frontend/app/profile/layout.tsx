"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/workspace/auth-gate";
import { Button } from "@/components/ui/button";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <AuthGate>
    <nav aria-label="Profile navigation" className="mb-6 flex flex-wrap gap-2">
      {[["/profile", "Account"], ["/profile/inventory", "Inventory"], ["/profile/preferences", "Preferences"]].map(([href, label]) => (
        <Button key={href} asChild variant={pathname === href ? "secondary" : "ghost"}>
          <Link href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
        </Button>
      ))}
    </nav>
    {children}
  </AuthGate>;
}
