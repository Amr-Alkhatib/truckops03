import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicHome } from "@/lib/public-data.functions";

/** Active packages + public price settings (served by the server). */
export function usePublicHome() {
  const fn = useServerFn(getPublicHome);
  return useQuery({ queryKey: ["public-home"], queryFn: () => fn(), staleTime: 60_000 });
}

export function usePackages() {
  const q = usePublicHome();
  return { ...q, data: q.data?.packages };
}
