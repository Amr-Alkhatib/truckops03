import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { BadgeEuro, CalendarDays, ClipboardList, FileCheck2, LayoutDashboard, Map, NotebookText, Package, History, Warehouse, Scale, Truck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", (context as any).userId);
    const roles = (data ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("staff")) throw redirect({ to: "/bookings" });
  },
  head: () => ({ meta: [{ title: "Back office — TruckOps" }, { name: "description", content: "Rolling Feast operations back office." }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/admin/fleet", label: "Fleet", icon: Truck },
  { to: "/admin/yards", label: "Yards", icon: Warehouse },
  { to: "/admin/rules", label: "Rules", icon: Scale },
  { to: "/admin/pricing", label: "Pricing", icon: BadgeEuro },
  { to: "/admin/towns", label: "Towns & permits", icon: Map },
  { to: "/admin/compliance", label: "Compliance", icon: FileCheck2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/packages", label: "Packages", icon: Package },
  { to: "/admin/changes", label: "Change log", icon: History },
  { to: "/admin/policy", label: "Policy notes", icon: NotebookText },
] as const;

function AdminLayout() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
      <aside className="lg:sticky lg:top-24 lg:w-56 lg:self-start">
        <nav className="glass flex gap-1 overflow-x-auto rounded-2xl p-2 lg:flex-col">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent" activeProps={{ className: "bg-gradient-primary !text-primary-foreground" }}>
              <n.icon className="size-4" />{n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1"><Outlet /></div>
    </div>
  );
}
