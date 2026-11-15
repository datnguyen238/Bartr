import { redirect } from "next/navigation";
import { safeNext } from "@/lib/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  redirect(`/sign-in?next=${encodeURIComponent(safeNext(params.next))}`);
}
