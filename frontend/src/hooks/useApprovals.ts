import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface ApprovalDTO {
  id: string;
  recommendation_id: string;
  token: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
  operator_id: string | null;
}

export function useApprovals() {
  return useQuery<ApprovalDTO[]>({
    queryKey: ["approvals"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ApprovalDTO[] }>("/api/v1/approvals");
      const payload = res?.data;
      if (!payload) return [];
      if (!Array.isArray(payload)) {
        console.error("Unexpected API response for approvals", res);
        return [];
      }
      return payload;
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, operatorId }: { approvalId: string; operatorId?: string }) =>
      api.post<any, { operator_id: string }>(`/api/v1/approvals/${approvalId}/approve`, {
        operator_id: operatorId || "Dashboard-Operator",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflowHistory"] });
      queryClient.invalidateQueries({ queryKey: ["workflowMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["runsDetails"] });
    },
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, operatorId }: { approvalId: string; operatorId?: string }) =>
      api.post<any, { operator_id: string }>(`/api/v1/approvals/${approvalId}/reject`, {
        operator_id: operatorId || "Dashboard-Operator",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflowHistory"] });
      queryClient.invalidateQueries({ queryKey: ["workflowMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["runsDetails"] });
    },
  });
}
