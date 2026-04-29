import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ScanOutcomeBadge({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const variant =
    normalized === "PASS"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : normalized === "FAIL"
        ? "border-destructive bg-destructive text-destructive-foreground"
        : "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-400";

  return (
    <Badge variant="outline" className={cn("font-semibold tabular-nums", variant)}>
      {status}
    </Badge>
  );
}
