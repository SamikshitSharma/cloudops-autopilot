import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface AgentReasoningPathDTO {
  id: string;
  timestamp: string;
  resource_id: string | null;
  agent_name: string;
  trigger_event: string;
  observations: Record<string, any>;
  hypotheses: Array<{ hypothesis: string; confidence_score: number; evidence?: string }>;
  policy_check_status: string;
  recommended_action: string;
}

export function useExplainability() {
  return useQuery<AgentReasoningPathDTO[]>({
    queryKey: ["reasoningPaths"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AgentReasoningPathDTO[] }>("/api/v1/reasoning-paths");
      const payload = res?.data;
      if (!payload) return [];
      if (!Array.isArray(payload)) {
        console.error("Unexpected API response for reasoning paths", res);
        return [];
      }
      return payload;
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });
}
