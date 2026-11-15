import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({
  href = "/",
  className,
  compact = false,
}: {
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      aria-label="Bartr home"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </span>
      <span className="font-display text-[1.65rem] leading-none tracking-[-0.03em]">
        bartr<span className="text-accent-warm">.</span>
      </span>
      {!compact && (
        <span className="sr-only">AI-powered, money-free bartering</span>
      )}
    </Link>
  );
}
