import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api/client";
import type { RunDetailsDTO, RunDTO, RecommendationDTO, ApprovalDTO, ResourceDTO } from "../api/client";

export function useWorkflow() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<RunDetailsDTO | null>(null);
  const [runs, setRuns] = useState<RunDTO[]>([]);
  const [resources, setResources] = useState<ResourceDTO[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationDTO[]>([]);
  const [approvals, setApprovals] = useState<ApprovalDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // References to keep polling callbacks fresh
  const pollingRef = useRef<any>(null);

  const fetchGlobalState = useCallback(async () => {
    try {
      const [runsRes, resRes, recRes, appRes] = await Promise.all([
        api.getRuns(),
        api.getResources(),
        api.getRecommendations(),
        api.getApprovals(),
      ]);
      setRuns(runsRes.data);
      setResources(resRes.data);
      setRecommendations(recRes.data);
      setApprovals(appRes.data);
    } catch (err: any) {
      console.error("Failed to load global workspace state:", err);
      setError("Failed to sync workspace database metrics.");
    }
  }, []);

  const fetchDetails = useCallback(async (runId: string) => {
    try {
      const details = await api.getRunDetails(runId);
      setRunDetails(details.data);
      
      // If the run reached a terminal state, clear active run so polling stops
      const status = details.data.db_record.status;
      if (status === "completed" || status === "failed") {
        setActiveRunId(null);
      }
    } catch (err: any) {
      console.error(`Failed to fetch run details for ${runId}:`, err);
    }
  }, []);

  // Poll details when activeRunId changes
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!activeRunId) {
      return;
    }

    // Fetch immediately
    fetchDetails(activeRunId);
    fetchGlobalState();

    // Setup 2-second short polling interval
    pollingRef.current = setInterval(() => {
      fetchDetails(activeRunId);
      fetchGlobalState();
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeRunId, fetchDetails, fetchGlobalState]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    fetchGlobalState()
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [fetchGlobalState]);

  const triggerRun = useCallback(async (scenarioName: string, dryRun: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.triggerRun(scenarioName, dryRun);
      const newRunId = res.data.run_id;
      setActiveRunId(newRunId);
      await fetchGlobalState();
      return newRunId;
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Failed to trigger autopilot reasoning run.";
      setError(errMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchGlobalState]);

  const approve = useCallback(async (approvalId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.approveRecommendation(approvalId);
      await fetchGlobalState();
      // If the currently active run is waiting on this approval, poll for state updates immediately
      if (activeRunId) {
        await fetchDetails(activeRunId);
      } else {
        // Find which run this approval belongs to and start polling it to see execution outcome
        const app = approvals.find((a) => a.id === approvalId);
        const reco = recommendations.find((r) => r.id === app?.recommendation_id);
        if (reco) {
          setActiveRunId(reco.run_id);
        }
      }
      return res.data;
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Failed to grant manual approval.";
      setError(errMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [activeRunId, approvals, recommendations, fetchDetails, fetchGlobalState]);

  const selectRun = useCallback((runId: string) => {
    // If selecting a completed or running run, load its details
    fetchDetails(runId);
    // If the run is running or blocked, we want to poll it
    const matchingRun = runs.find((r) => r.id === runId);
    if (matchingRun && (matchingRun.status === "running" || matchingRun.status === "blocked_on_approval")) {
      setActiveRunId(runId);
    } else {
      setActiveRunId(null);
    }
  }, [runs, fetchDetails]);

  return {
    runs,
    resources,
    recommendations,
    approvals,
    activeRunId,
    runDetails,
    isLoading,
    error,
    triggerRun,
    approve,
    selectRun,
    refresh: fetchGlobalState
  };
}
