import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/navigation";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="register" next={safeNext(params.next)} />;
}
