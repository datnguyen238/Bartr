import { Suspense } from "react";
import { HomeScreen } from "@/components/home/home-screen";

export default function SignInPage() {
  return <Suspense fallback={<p role="status">Loading sign in…</p>}><HomeScreen /></Suspense>;
}
