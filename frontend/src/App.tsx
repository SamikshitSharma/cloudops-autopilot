import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./components/DashboardLayout";
import { Overview } from "./views/Overview";
import { WorkflowExecution } from "./views/WorkflowExecution";
import { Inventory } from "./views/Inventory";
import { Topology } from "./views/Topology";
import { Recommendations } from "./views/Recommendations";
import { Approvals } from "./views/Approvals";
import { Explainability } from "./views/Explainability";
import { AuditLogs } from "./views/AuditLogs";
import { EventBus } from "./views/EventBus";
import { useWorkflow } from "./hooks/useWorkflow";

function App() {
  const [currentTab, setCurrentTab] = useState("overview");
  const {
    runs,
    runsDetails,
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
    refresh
  } = useWorkflow();

  // If a run starts, switch to workflow tab so the user sees it running in real-time!
  useEffect(() => {
    if (activeRunId) {
      setCurrentTab("workflow");
    }
  }, [activeRunId]);

  const renderContent = () => {
    switch (currentTab) {
      case "overview":
        return (
          <Overview 
            runs={runs}
            resources={resources}
            recommendations={recommendations}
            approvals={approvals}
            activeRunDetails={runDetails}
          />
        );
      case "inventory":
        // Keep inventory view in compiler for tests, although hidden from navigation rail
        return <Inventory resources={resources} />;
      case "topology":
        return <Topology resources={resources} recommendations={recommendations} activeRunDetails={runDetails} />;
      case "recommendations":
        return <Recommendations recommendations={recommendations} />;
      case "workflow":
        return (
          <WorkflowExecution
            runs={runs}
            activeRunId={activeRunId}
            runDetails={runDetails}
            isLoading={isLoading}
            error={error}
            triggerRun={triggerRun}
            selectRun={selectRun}
          />
        );
      case "approvals":
        return (
          <Approvals
            recommendations={recommendations}
            approvals={approvals}
            approve={approve}
          />
        );
      case "explainability":
        return <Explainability recommendations={recommendations} />;
      case "eventbus":
        return <EventBus runs={runsDetails} activeRunDetails={runDetails} />;
      case "audit":
        return <AuditLogs runs={runsDetails} refresh={refresh} />;
      default:
        return (
          <Overview 
            runs={runs}
            resources={resources}
            recommendations={recommendations}
            approvals={approvals}
            activeRunDetails={runDetails}
          />
        );
    }
  };

  return (
    <DashboardLayout 
      currentTab={currentTab} 
      setCurrentTab={setCurrentTab}
      recommendations={recommendations}
      activeRunDetails={runDetails}
    >
      {renderContent()}
    </DashboardLayout>
  );
}

export default App;
