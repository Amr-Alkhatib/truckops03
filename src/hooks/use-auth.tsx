import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "staff" | "planner";
interface AuthState {
  user: User | null;
  roles: Role[];
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
}

const Ctx = createContext<AuthState>({ user: null, roles: [], loading: true, isStaff: false, isAdmin: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoles = async (u: User | null) => {
      if (!u) return setRoles([]);
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
      setRoles((data ?? []).map((r) => r.role as Role));
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setTimeout(() => loadRoles(session?.user ?? null), 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null);
      await loadRoles(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isStaff = isAdmin || roles.includes("staff");
  return <Ctx.Provider value={{ user, roles, loading, isStaff, isAdmin }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
