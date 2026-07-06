import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface RunDTO {
  id: string;
  status: string;
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
  audit_logs: AuditLogDTO[];
}

export function useAudit() {
  return useQuery<AuditLogDTO[]>({
    queryKey: ["runsDetails"],
    queryFn: async () => {
      // 1. Fetch all runs
      const runsRes = await api.get<{ success: boolean; data: RunDTO[] }>("/api/v1/runs");
      const runsList = runsRes?.data;
      if (!runsList || !Array.isArray(runsList)) {
        console.error("Unexpected API response for runs list", runsRes);
        return [];
      }

      // 2. Fetch details for each run in parallel to get audit logs
      const detailsList = await Promise.all(
        runsList.map(async (run) => {
          try {
            const details = await api.get<{ success: boolean; data: RunDetailsDTO }>(`/api/v1/runs/${run.id}`);
            const auditLogs = details?.data?.audit_logs;
            if (!auditLogs || !Array.isArray(auditLogs)) {
              console.error(`Unexpected audit_logs format for run ${run.id}`, details);
              return [];
            }
            return auditLogs;
          } catch (err) {
            console.error(`Failed to load details for run ${run.id}:`, err);
            return [];
          }
        })
      );

      // 3. Flatten and sort logs by timestamp desc
      const allLogs = detailsList.flat();
      return allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
}
