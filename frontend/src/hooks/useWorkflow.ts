import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface WorkflowCard {
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
  confidence: number | null;
  estimated_savings: number;
}

export interface WorkflowStage {
  id: string;
  stage_id: string;
  stage_name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  started_at: string | null;
  completed_at: string | null;
  duration: number | null;
  input_summary: any;
  output_summary: any;
  reasoning_summary: any;
  confidence: number | null;
  errors: any;
  llm_trace: any;
}

export interface WorkflowDetails {
  workflow_id: string;
  run_id: string;
  status: string;
  objective: string | null;
  scenario_name: string | null;
  execution_mode: string;
  correlation_id: string;
  created_at: string;
  updated_at: string;
  context: any;
  metrics: any;
  visualization_model: any;
  reasoning_chain: any;
  stages: WorkflowStage[];
}

export interface LiveWorkflowState {
  workflow_id: string;
  status: string;
  current_stage: string | null;
  completed_stages: string[];
  remaining_stages: string[];
  progress_percentage: number;
  estimated_time_remaining_seconds: number | null;
  active_agent: string | null;
  current_reasoning_summary: string | null;
  correlation_id: string;
  execution_mode: string;
}

export interface WorkflowReplayEvent {
  event_type: string;
  timestamp: string;
  stage_id: string | null;
  payload: any;
}

export interface WorkflowReplay {
  workflow_id: string;
  run_id: string;
  status: string;
  events: WorkflowReplayEvent[];
}

export interface TriggerWorkflowRequest {
  scenario_name: string;
  objective?: string | null;
  execution_mode?: string;
}

export interface ApproveWorkflowRequest {
  approval_token: string;
}

export function useWorkflows() {
  return useQuery<WorkflowCard[]>({
    queryKey: ["workflows"],
    queryFn: async () => {
      const res = await api.get<WorkflowCard[]>("/api/v1/workflows");
      if (!res) return [];
      if (!Array.isArray(res)) {
        console.error("Unexpected API response for workflows list", res);
        return [];
      }
      return res;
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export function useWorkflowDetails(workflowId: string | null) {
  return useQuery<WorkflowDetails>({
    queryKey: ["workflowDetails", workflowId],
    queryFn: () => api.get<WorkflowDetails>(`/api/v1/workflows/${workflowId}`),
    enabled: !!workflowId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "running" || data.status === "pending" || data.status === "blocked_on_approval")) {
        return 750;
      }
      return false;
    },
    staleTime: 5000,
  });
}

export function useLiveWorkflowState(workflowId: string | null) {
  return useQuery<LiveWorkflowState>({
    queryKey: ["liveWorkflowState", workflowId],
    queryFn: () => api.get<LiveWorkflowState>(`/api/v1/workflows/${workflowId}/state`),
    enabled: !!workflowId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "running" || data.status === "pending" || data.status === "blocked_on_approval")) {
        return 750;
      }
      return false;
    },
    staleTime: 1000,
  });
}

export function useWorkflowReplay(workflowId: string | null) {
  return useQuery<WorkflowReplay>({
    queryKey: ["workflowReplay", workflowId],
    queryFn: () => api.get<WorkflowReplay>(`/api/v1/workflows/${workflowId}/replay`),
    enabled: !!workflowId,
    refetchInterval: 1000,
    staleTime: 1000,
  });
}

export function useTriggerWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TriggerWorkflowRequest) =>
      api.post<any, TriggerWorkflowRequest>("/api/v1/workflows", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflowHistory"] });
      queryClient.invalidateQueries({ queryKey: ["workflowMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["runsDetails"] });
    },
  });
}

export function useApproveWorkflow(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApproveWorkflowRequest) =>
      api.post<any, ApproveWorkflowRequest>(`/api/v1/workflows/${workflowId}/approve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflowDetails", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["liveWorkflowState", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["workflowMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["runsDetails"] });
    },
  });
}

export function usePauseWorkflow(workflowId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<any>(`/api/v1/workflows/${workflowId}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      if (workflowId) {
        queryClient.invalidateQueries({ queryKey: ["workflowDetails", workflowId] });
        queryClient.invalidateQueries({ queryKey: ["liveWorkflowState", workflowId] });
      }
    },
  });
}

export function useResumeWorkflow(workflowId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<any>(`/api/v1/workflows/${workflowId}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      if (workflowId) {
        queryClient.invalidateQueries({ queryKey: ["workflowDetails", workflowId] });
        queryClient.invalidateQueries({ queryKey: ["liveWorkflowState", workflowId] });
      }
    },
  });
}

export function useRerunWorkflow(workflowId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wfId?: string) =>
      api.post<any>(`/api/v1/workflows/${wfId || workflowId}/rerun`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflowHistory"] });
      queryClient.invalidateQueries({ queryKey: ["workflowMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["runsDetails"] });
      if (workflowId) {
        queryClient.invalidateQueries({ queryKey: ["workflowDetails", workflowId] });
        queryClient.invalidateQueries({ queryKey: ["liveWorkflowState", workflowId] });
      }
    },
  });
}
