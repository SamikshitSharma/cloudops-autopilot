import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface RunDTO {
  id: string;
  status: "running" | "completed" | "failed" | "blocked_on_approval";
  started_at: string;
  completed_at: string | null;
  log_file_path: string | null;
}

export interface AuditLogDTO {
  id: string;
  run_id: string;
  timestamp: string;
  agent_name: string;
  step_name: string;
  event_type: string;
  payload: any;
  status: "success" | "warning" | "failure";
}

export interface RunDetailsDTO {
  db_record: RunDTO;
  in_memory_state: {
    run_id: string;
    scenario_name: string;
    dry_run: boolean;
    status: string;
    steps: Array<{
      step_name: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      error: string | null;
    }>;
  } | null;
  audit_logs: AuditLogDTO[];
}

export interface ResourceDTO {
  id: string;
  provider_id: string;
  name: string;
  type: string;
  region: string;
  status: string;
  tags: Record<string, string>;
  last_seen: string;
}

export interface RecommendationDTO {
  id: string;
  run_id: string;
  resource_id: string;
  action_type: "stop" | "resize" | "delete" | "audit";
  saving_amount: number;
  rationale: string;
  risk_level: "low" | "high";
  status: "pending" | "auto_executed" | "escalated" | "approved" | "denied" | "executed" | "rolled_back";
  confidence_score?: number;
  evidence?: string;
  reasoning_chain?: any;
}


export interface ApprovalDTO {
  id: string;
  recommendation_id: string;
  token: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
  operator_id: string | null;
}

export interface HealthDTO {
  status: string;
  database: string;
}

// Sequential Workflow Interfaces
export interface WorkflowStageDTO {
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
  confidence: number;
  errors: any;
  llm_trace: any;
}

export interface SequentialWorkflowDTO {
  workflow_id: string;
  run_id: string;
  status: "pending" | "running" | "completed" | "failed" | "blocked_on_approval";
  objective: string;
  scenario_name: string;
  execution_mode: "MOCK" | "LIVE";
  correlation_id: string;
  created_at: string;
  updated_at: string;
  context: any;
  metrics: any;
  visualization_model: any;
  reasoning_chain: any;
  stages: WorkflowStageDTO[];
}

export interface WorkflowCardDTO {
  workflow_id: string;
  run_id: string;
  correlation_id: string;
  status: string;
  objective: string;
  scenario_name: string;
  execution_mode: string;
  created_at: string;
  updated_at: string;
  progress_percentage: number;
  duration_seconds: number | null;
  confidence: number;
  estimated_savings: number;
}

export interface LiveWorkflowStateDTO {
  workflow_id: string;
  status: string;
  current_stage: string | null;
  completed_stages: string[];
  remaining_stages: string[];
  progress_percentage: number;
  estimated_time_remaining_seconds: number;
  active_agent: string | null;
  current_reasoning_summary: string | null;
  correlation_id: string;
  execution_mode: string;
}

export interface WorkflowMetricsDTO {
  total_workflow_executions: number;
  success_rate: number;
  failure_rate: number;
  average_workflow_duration: number;
  average_stage_duration: Record<string, number>;
  average_confidence: number;
  estimated_total_savings: number;
  most_common_failure_reasons: Array<{ reason: string; count: number }>;
  azure_api_utilization_statistics: Record<string, number>;
}

export interface TimelineCardDTO {
  stage_id: string;
  stage_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
}

// API Methods
export const api = {
  async getHealth(): Promise<APIResponse<HealthDTO>> {
    const res = await apiClient.get<APIResponse<HealthDTO>>("/health");
    return res.data;
  },

  async getRuns(): Promise<APIResponse<RunDTO[]>> {
    const res = await apiClient.get<APIResponse<RunDTO[]>>("/runs");
    return res.data;
  },

  async getRunDetails(runId: string): Promise<APIResponse<RunDetailsDTO>> {
    const res = await apiClient.get<APIResponse<RunDetailsDTO>>(`/runs/${runId}`);
    return res.data;
  },

  async triggerRun(scenarioName: string, dryRun: boolean): Promise<APIResponse<{ run_id: string; status: string }>> {
    const res = await apiClient.post<APIResponse<{ run_id: string; status: string }>>("/runs", {
      scenario_name: scenarioName,
      dry_run: dryRun,
    });
    return res.data;
  },

  async getResources(): Promise<APIResponse<ResourceDTO[]>> {
    const res = await apiClient.get<APIResponse<ResourceDTO[]>>("/resources");
    return res.data;
  },

  async getRecommendations(): Promise<APIResponse<RecommendationDTO[]>> {
    const res = await apiClient.get<APIResponse<RecommendationDTO[]>>("/recommendations");
    return res.data;
  },

  async getApprovals(): Promise<APIResponse<ApprovalDTO[]>> {
    const res = await apiClient.get<APIResponse<ApprovalDTO[]>>("/approvals");
    return res.data;
  },

  async approveRecommendation(approvalId: string, operatorId: string = "Dashboard-Operator"): Promise<APIResponse<{ approval: ApprovalDTO; workflow_resumed: boolean }>> {
    const res = await apiClient.post<APIResponse<{ approval: ApprovalDTO; workflow_resumed: boolean }>>(
      `/approvals/${approvalId}/approve`,
      { operator_id: operatorId }
    );
    return res.data;
  },

  // Sequential Workflow API endpoints
  async triggerWorkflow(scenarioName: string, objective?: string, executionMode: string = "MOCK"): Promise<any> {
    const res = await apiClient.post("/workflows", {
      scenario_name: scenarioName,
      objective: objective,
      execution_mode: executionMode
    });
    return res.data;
  },

  async getWorkflows(): Promise<WorkflowCardDTO[]> {
    const res = await apiClient.get<WorkflowCardDTO[]>("/workflows");
    return res.data;
  },

  async getWorkflowContext(workflowId: string): Promise<SequentialWorkflowDTO> {
    const res = await apiClient.get<SequentialWorkflowDTO>(`/workflows/${workflowId}`);
    return res.data;
  },

  async getWorkflowTimeline(workflowId: string): Promise<TimelineCardDTO[]> {
    const res = await apiClient.get<TimelineCardDTO[]>(`/workflows/${workflowId}/timeline`);
    return res.data;
  },

  async getLiveWorkflowState(workflowId: string): Promise<LiveWorkflowStateDTO> {
    const res = await apiClient.get<LiveWorkflowStateDTO>(`/workflows/${workflowId}/state`);
    return res.data;
  },

  async approveWorkflow(workflowId: string, approvalToken: string): Promise<any> {
    const res = await apiClient.post(`/workflows/${workflowId}/approve`, {
      approval_token: approvalToken
    });
    return res.data;
  },

  async getWorkflowMetrics(): Promise<WorkflowMetricsDTO> {
    const res = await apiClient.get<WorkflowMetricsDTO>("/workflows/metrics/summary");
    return res.data;
  }
};
