import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: Users });

const ROLES = ["admin", "staff", "planner"] as const;

function Users() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from("profiles").select("id, full_name, email, company_name").order("created_at"), supabase.from("user_roles").select("*")]);
      return (p.data ?? []).map((x) => ({ ...x, roles: (r.data ?? []).filter((y) => y.user_id === x.id).map((y) => y.role) }));
    },
  });
  const toggle = async (uid: string, role: (typeof ROLES)[number], has: boolean) => {
    if (uid === user?.id && role === "admin" && has) return toast.error("You can't remove your own admin role");
    const { error } = has ? await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role) : await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    toast.success("Roles updated");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Users</h1>
      {!isAdmin && <p className="text-sm text-muted-foreground">Only admins can change roles.</p>}
      <div className="glass overflow-x-auto rounded-2xl p-2">
        {q.isLoading ? <Skeleton className="h-40" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Company</th><th className="p-2">Roles</th></tr></thead>
            <tbody>
              {q.data!.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{u.full_name || "—"}</td><td className="p-2">{u.email}</td><td className="p-2">{u.company_name || "—"}</td>
                  <td className="flex gap-1.5 p-2">
                    {ROLES.map((r) => {
                      const has = u.roles.includes(r);
                      return <button key={r} disabled={!isAdmin} onClick={() => toggle(u.id, r, has)} className={`rounded-full border px-2.5 py-0.5 text-xs ${has ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{r}</button>;
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
