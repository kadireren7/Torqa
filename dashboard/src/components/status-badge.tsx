import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ValidationStatus } from "@/data/types";

const styles: Record<ValidationStatus, string> = {
  queued: "bg-muted text-muted-foreground border-transparent",
  running: "border-primary/30 bg-primary/10 text-primary",
  succeeded: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "border-destructive bg-destructive text-destructive-foreground",
  canceled: "bg-muted text-muted-foreground border-transparent",
};

export function StatusBadge({ status }: { status: ValidationStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[status])}>
      {status}
    </Badge>
  );
}
