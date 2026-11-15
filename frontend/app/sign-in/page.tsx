import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="sign-in" next={safeNext(params.next)} />;
}
