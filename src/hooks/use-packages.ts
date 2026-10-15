import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePackages() {
  return useQuery({
    queryKey: ["packages"],
    queryFn: async () => (await supabase.from("packages").select("*").eq("active", true).order("sort")).data ?? [],
  });
}
