// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock Lucide-react and Recharts to avoid DOM drawing issues
vi.mock("lucide-react", () => ({
  LayoutDashboard: () => <div data-testid="icon-dashboard" />,
  Play: () => <div data-testid="icon-play" />,
  Database: () => <div data-testid="icon-database" />,
  CheckSquare: () => <div data-testid="icon-check" />,
  FileText: () => <div data-testid="icon-file" />,
  HelpCircle: () => <div data-testid="icon-help" />,
  Sun: () => <span>Sun</span>,
  Moon: () => <span>Moon</span>,
  Activity: () => <span>Activity</span>,
  ShieldCheck: () => <span>ShieldCheck</span>,
  DollarSign: () => <span>$</span>,
  CheckCircle: () => <span>CheckCircle</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
  RefreshCw: () => <span>Refresh</span>,
  Terminal: () => <span>Terminal</span>,
  Info: () => <span>Info</span>,
  MapPin: () => <span>MapPin</span>,
  Tag: () => <span>Tag</span>,
  Layers: () => <span>Layers</span>,
  Network: () => <span>Network</span>,
  Filter: () => <span>Filter</span>,
  Sparkles: () => <span>Sparkles</span>,
  Cpu: () => <span>Cpu</span>,
  Shield: () => <span>Shield</span>,
  Award: () => <span>Award</span>,
  ChevronRight: () => <span>ChevronRight</span>,
  X: () => <span>X</span>,
  User: () => <span>User</span>,
  Lock: () => <span>Lock</span>,
  Globe: () => <span>Globe</span>,
  Server: () => <span>Server</span>,
  ArrowDown: () => <span>ArrowDown</span>,
  Settings: () => <span>Settings</span>,
  Search: () => <span>Search</span>,
  Zap: () => <span>Zap</span>,
  Send: () => <span>Send</span>,
  Sparkle: () => <span>Sparkle</span>,
  MessageSquare: () => <span>MessageSquare</span>,
  ServerCrash: () => <span>ServerCrash</span>,
  ShieldAlert: () => <span>ShieldAlert</span>,
  CheckCircle2: () => <span>CheckCircle2</span>,
  AlertCircle: () => <span>AlertCircle</span>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => <div />,
  Legend: () => <div />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
}));

import { DashboardLayout } from "./components/DashboardLayout";
import { Overview } from "./views/Overview";
import { Inventory } from "./views/Inventory";
import type { ResourceDTO, RunDTO, RecommendationDTO, ApprovalDTO } from "./api/client";

describe("Dashboard UI Shell", () => {
  test("renders sidebar navigation links and health indicator", () => {
    render(
      <DashboardLayout currentTab="overview" setCurrentTab={() => {}}>
        <div data-testid="main-content">Test Child</div>
      </DashboardLayout>
    );

    // Verify system title & capstone credit
    expect(screen.getByText("CloudOps")).toBeDefined();
    expect(screen.getByText("Test Child")).toBeDefined();
    expect(screen.getByText("Kernel Uplink")).toBeDefined();
  });
});

describe("Overview Panel Metrics", () => {
  test("correctly calculates and renders cost savings figures", () => {
    const mockRecommendations: RecommendationDTO[] = [
      {
        id: "reco-1",
        run_id: "run-1",
        resource_id: "vm-1",
        action_type: "stop",
        saving_amount: 50.0,
        rationale: "test",
        risk_level: "low",
        status: "executed",
      },
      {
        id: "reco-2",
        run_id: "run-1",
        resource_id: "vm-2",
        action_type: "resize",
        saving_amount: 30.0,
        rationale: "test",
        risk_level: "high",
        status: "pending",
      },
    ];

    render(
      <Overview
        runs={[]}
        resources={[]}
        recommendations={mockRecommendations}
        approvals={[]}
        activeRunDetails={null}
      />
    );

    // Discovered savings = 50 + 30 = 80
    expect(screen.getByText("$80.00")).toBeDefined();
    // Realized savings = 50 (executed)
    expect(screen.getAllByText("$50.00")[0]).toBeDefined();
  });
});

describe("Inventory List & Topology", () => {
  test("renders resource inventory list grid", () => {
    const mockResources: ResourceDTO[] = [
      {
        id: "vm-idle-01",
        provider_id: "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-idle-01",
        name: "vm-idle-01",
        type: "Microsoft.Compute/virtualMachines",
        region: "eastus",
        status: "Stopped",
        tags: { env: "prod" },
        last_seen: new Date().toISOString(),
      },
    ];

    render(<Inventory resources={mockResources} />);

    // Verify grid list headers and items exist
    expect(screen.getAllByText("vm-idle-01").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Microsoft.Compute/virtualMachines")[0]).toBeDefined();
    expect(screen.getAllByText("eastus")[0]).toBeDefined();
  });
});
