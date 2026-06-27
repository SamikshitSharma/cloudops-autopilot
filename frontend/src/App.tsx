import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./components/DashboardLayout";
import { Overview } from "./views/Overview";
import { WorkflowExecution } from "./views/WorkflowExecution";
import { Inventory } from "./views/Inventory";
import { Recommendations } from "./views/Recommendations";
import { Explainability } from "./views/Explainability";
import { AuditLogs } from "./views/AuditLogs";
import { useWorkflow } from "./hooks/useWorkflow";

function App() {
  const [currentTab, setCurrentTab] = useState("overview");
  const {
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
    refresh
  } = useWorkflow();

  // If a run starts, switch to execution tab so the user sees it running in real-time!
  useEffect(() => {
    if (activeRunId) {
      setCurrentTab("execution");
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
      case "execution":
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
      case "inventory":
        return <Inventory resources={resources} />;
      case "recommendations":
        return (
          <Recommendations
            recommendations={recommendations}
            approvals={approvals}
            approve={approve}
          />
        );
      case "explainability":
        return <Explainability recommendations={recommendations} />;
      case "logs":
        return <AuditLogs runs={runs} refresh={refresh} />;
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
    <DashboardLayout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

export default App;
