"use client";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/workspace/auth-gate";
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
