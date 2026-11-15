import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TradePage() {
  return (
    <section className="max-w-xl space-y-4">
      <h2 className="text-2xl font-semibold">Trading is coming next</h2>
      <p className="text-sm leading-6 text-muted-foreground">Start with your profile, add the things you’re ready to exchange, and tell Bartr what you’re looking for.</p>
      <Button asChild><Link href="/profile">Prepare your profile</Link></Button>
    </section>
  );
}
