import { Suspense } from "react";
import { HomeScreen } from "@/components/home/home-screen";

export default function HomePage() {
  return <Suspense fallback={<p role="status">Loading Home…</p>}><HomeScreen /></Suspense>;
}
