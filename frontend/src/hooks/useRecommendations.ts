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

export interface ExecutionPlanDTO {
  recommendation_id: string;
  run_id: string;
  workflow_id: string;
  correlation_id?: string | null;
  execution_mode: string;
  status: string;
  action: string;
  risk_level: string;
  requires_approval: boolean;
  target: {
    resource_id: string;
    provider_id?: string | null;
    name: string;
    type: string;
    region: string;
    status: string;
  };
  evidence: string;
  rationale: string;
  estimated_monthly_savings: number;
  steps: string[];
  blockers: string[];
  command_preview?: string | null;
  truth_note: string;
}

export function useRecommendationExecutionPlan(recoId?: string) {
  return useQuery<ExecutionPlanDTO>({
    queryKey: ["recommendationExecutionPlan", recoId],
    enabled: Boolean(recoId),
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ExecutionPlanDTO }>(`/api/v1/recommendations/${recoId}/execution-plan`);
      if (!res?.data) throw new Error("Execution plan response did not include data.");
      return res.data;
    },
    staleTime: 5000,
  });
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
