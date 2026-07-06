import { useQuery } from "@tanstack/react-query";
import { useAudit, type AuditLogDTO } from "./useAudit";
import type { EventItem, Severity } from "@/lib/types";

function mapAuditStatusToSeverity(status: string): Severity {
  switch (status.toLowerCase()) {
    case "failure":
      return "critical";
    case "warning":
      return "high";
    case "success":
    default:
      return "info";
  }
}

export function useEvents(pollingEnabled = true) {
  const auditQuery = useAudit();

  // Map the flattened audit logs to events
  const events: EventItem[] = (auditQuery.data || []).map((log: AuditLogDTO) => {
    const tsDate = new Date(log.timestamp);
    const ts = tsDate.toTimeString().slice(0, 8);
    
    // Construct description payload details
    let message = `${log.event_type} on step ${log.step_name}`;
    if (log.payload) {
      const innerPayload = log.payload.payload || log.payload;
      if (innerPayload.tool_name) {
        message = `Invoked tool ${innerPayload.tool_name} successfully.`;
        if (innerPayload.results_count !== undefined) {
          message += ` Found ${innerPayload.results_count} resources.`;
        }
      } else if (innerPayload.scenario) {
        message = `Triggered workflow run scenario: ${innerPayload.scenario}.`;
      } else if (innerPayload.remediated_resources) {
        message = `Successfully remediated resources: ${innerPayload.remediated_resources.join(", ")}.`;
      } else if (innerPayload.monthly_savings !== undefined) {
        message = `Computed optimization potential. Monthly savings: $${innerPayload.monthly_savings.toFixed(2)}.`;
      } else if (innerPayload.error) {
        message = `Stage failed with error: ${innerPayload.error}`;
      } else if (innerPayload.duration_sec !== undefined) {
        message = `Stage completed in ${innerPayload.duration_sec.toFixed(3)}s.`;
      } else if (log.payload.event_type === "WorkflowStarted") {
        message = `Workflow started. Scenario: ${innerPayload.scenario || "N/A"}. Mode: ${innerPayload.mode || "N/A"}`;
      } else if (log.payload.event_type === "WorkflowCompleted") {
        message = `Workflow completed successfully in ${innerPayload.duration_sec?.toFixed(3) || "—"}s. Savings: $${innerPayload.savings || "0.00"}/mo.`;
      } else {
        message = typeof innerPayload === "object" ? JSON.stringify(innerPayload) : String(innerPayload);
      }
    }

    return {
      id: log.id,
      ts,
      topic: log.step_name || log.event_type,
      severity: mapAuditStatusToSeverity(log.status),
      message,
      source: log.agent_name || "orchestrator",
    };
  });

  return {
    ...auditQuery,
    data: events,
  };
}
