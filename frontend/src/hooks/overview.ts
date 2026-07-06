import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface HealthResponse {
  success: boolean;
  message: string;
  data: {
    status: string;
    database: string;
  };
}

export interface AggregatedMetrics {
  total_workflow_executions: number;
  success_rate: number;
  failure_rate: number;
  average_workflow_duration: number;
  average_stage_duration: Record<string, number>;
  average_confidence: number;
  estimated_total_savings: number;
  most_common_failure_reasons: Array<{ reason: string; count: number }>;
  azure_api_utilization_statistics: Record<string, number>;
  total_discovered_resources: number;
  // Extended KPIs from AggregatedMetricsDTO
  active_agents: number;
  azure_resources_managed: number;
  azure_regions: number;
  running_workflows: number;
  pending_approvals: number;
  resources_optimized_today: number;
  resources_under_observation: number;
  cost_saved_today: number;
  cost_saved_this_month: number;
  policies_checked: number;
  azure_api_calls_today: number;
  llm_requests: number;
  events_processed: number;
}

export interface WorkflowHistoryItem {
  workflow_id: string;
  run_id: string;
  correlation_id: string;
  status: string;
  objective: string | null;
  scenario_name: string | null;
  execution_mode: string;
  created_at: string;
  updated_at: string;
  progress_percentage: number;
  duration_seconds: number | null;
  confidence: number;
  estimated_savings: number;
}

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: () => api.get<HealthResponse>("/api/v1/health"),
    refetchInterval: 30000,
    retry: 3,
    staleTime: 10000,
  });
}

export function useWorkflowMetrics() {
  return useQuery<AggregatedMetrics>({
    queryKey: ["workflowMetrics"],
    queryFn: () => api.get<AggregatedMetrics>("/api/v1/workflows/metrics/summary"),
    refetchInterval: 15000,
    retry: 3,
    staleTime: 10000,
  });
}

export function useWorkflowHistory() {
  return useQuery<WorkflowHistoryItem[]>({
    queryKey: ["workflowHistory"],
    queryFn: async () => {
      const res = await api.get<WorkflowHistoryItem[]>("/api/v1/workflows");
      if (!res) return [];
      if (!Array.isArray(res)) {
        console.error("Unexpected API response for workflow history", res);
        return [];
      }
      return res;
    },
    refetchInterval: 15000,
    retry: 3,
    staleTime: 10000,
  });
}
