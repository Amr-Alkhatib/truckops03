import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  awaiting_approval: { label: "Awaiting client approval", cls: "bg-warning/20 text-warning-foreground dark:text-warning" },
  confirmed: { label: "Confirmed", cls: "bg-success/15 text-success" },
  rejected: { label: "Rejected by client", cls: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground line-through" },
  completed: { label: "Completed", cls: "bg-primary/15 text-primary" },
};

export const STATUS_LABELS = Object.fromEntries(Object.entries(MAP).map(([k, v]) => [k, v.label]));

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, cls: "bg-muted" };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls)}>{s.label}</span>;
}
