import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface ResourceDTO {
  id: string;
  provider_id: string;
  name: string;
  type: string;
  region: string;
  status: string;
  tags: Record<string, string>;
  last_seen: string;
  provider: string;
  utilization: number | null;
  monthly_cost: number | null;
}


export function useResources(q?: string) {
  return useQuery<ResourceDTO[]>({
    queryKey: ["resources", q],
    queryFn: async () => {
      const url = q ? `/api/v1/resources?q=${encodeURIComponent(q)}` : "/api/v1/resources";
      const res = await api.get<{ success: boolean; data: ResourceDTO[] }>(url);
      const payload = res?.data;
      if (!payload) return [];
      if (!Array.isArray(payload)) {
        console.error("Unexpected API response for resources", res);
        return [];
      }
      return payload;
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });
}
