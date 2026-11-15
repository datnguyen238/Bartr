// Small shared states for trading views. The page frame (header, navigation, seed-data notice)
// comes from the app-wide WorkspaceShell.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function PageMessage({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-5 text-center sm:p-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      {children && <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function SignedOutMessage() {
  return (
    <PageMessage title="Sign in to trade" action={<Button asChild variant="outline"><Link href="/inventory">Go to inventory</Link></Button>}>
      Your session has ended or you haven’t signed in yet.
    </PageMessage>
  );
}

export function Loading({ label }: { label: string }) {
  return <p role="status" className="py-10 text-center text-sm text-muted-foreground">{label}</p>;
}

export function EmptyList({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg bg-secondary/30 p-4 text-center text-sm leading-6 text-muted-foreground">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      {children}
    </Link>
  );
}
