import { cn } from "@/lib/utils";
import { initials } from "@/lib/marketplace";

export function Avatar({
  name,
  className,
  tone = "dark",
}: {
  name: string;
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
        tone === "dark"
          ? "bg-primary text-primary-foreground"
          : "border bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
