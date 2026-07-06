import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface RecommendationDTO {
  id: string;
  run_id: string;
  resource_id: string;
  action_type: "stop" | "resize" | "delete" | "audit";
  saving_amount: number;
  rationale: string;
  risk_level: "low" | "high";
  status: "pending" | "auto_executed" | "escalated" | "approved" | "denied" | "executed" | "rolled_back";
  confidence_score?: number | null;
  evidence?: string | null;
  reasoning_chain?: any;
}

export function useRecommendations() {
  return useQuery<RecommendationDTO[]>({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RecommendationDTO[] }>("/api/v1/recommendations");
      const payload = res?.data;
      if (!payload) return [];
      if (!Array.isArray(payload)) {
        console.error("Unexpected API response for recommendations", res);
        return [];
      }
      return payload;
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useApproveRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recoId }: { recoId: string }) =>
      api.post<any>(`/api/v1/recommendations/${recoId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflowHistory"] });
      queryClient.invalidateQueries({ queryKey: ["workflowMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["runsDetails"] });
    },
  });
}

export function useDismissRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recoId: string) =>
      api.post<any>(`/api/v1/recommendations/${recoId}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflowHistory"] });
      queryClient.invalidateQueries({ queryKey: ["workflowMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["runsDetails"] });
    },
  });
}
