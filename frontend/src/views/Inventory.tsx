import React, { useState, useMemo } from "react";
import { 
  Database, 
  Search, 
  Filter, 
  Globe, 
  Tag, 
  Cpu, 
  Server,
  ArrowUpDown,
  ExternalLink,
  DollarSign
} from "lucide-react";
import type { ResourceDTO } from "../api/client";

interface InventoryProps {
  resources: ResourceDTO[];
}

type SortField = "name" | "type" | "region" | "status" | "cost";
type SortOrder = "asc" | "desc";

export function Inventory({ resources }: InventoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Derive resource types & regions
  const uniqueTypes = useMemo(() => ["all", ...new Set(resources.map(r => r.type))], [resources]);
  const uniqueRegions = useMemo(() => ["all", ...new Set(resources.map(r => r.region))], [resources]);

  // Compute resource cost estimate dynamically
  const getResourceCost = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes("virtualmachine") || lower.includes("compute")) return 145.00;
    if (lower.includes("disk") || lower.includes("storage")) return 32.50;
    if (lower.includes("network") || lower.includes("ip")) return 18.00;
    return 45.00;
  };

  // Filter resources
  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      const matchesSearch = searchQuery === "" || 
        res.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        res.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Object.entries(res.tags).some(([k, v]) => 
          k.toLowerCase().includes(searchQuery.toLowerCase()) || 
          v.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesType = selectedType === "all" || res.type === selectedType;
      const matchesRegion = selectedRegion === "all" || res.region === selectedRegion;

      return matchesSearch && matchesType && matchesRegion;
    });
  }, [resources, searchQuery, selectedType, selectedRegion]);

  // Sort resources
  const sortedResources = useMemo(() => {
    return [...filteredResources].sort((a, b) => {
      let valA: any = a[sortField as keyof ResourceDTO] || "";
      let valB: any = b[sortField as keyof ResourceDTO] || "";
      
      if (sortField === "cost") {
        valA = getResourceCost(a.type);
        valB = getResourceCost(b.type);
      }

      if (typeof valA === "string") {
        return sortOrder === "asc" 
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc"
          ? (valA > valB ? 1 : -1)
          : (valB > valA ? 1 : -1);
      }
    });
  }, [filteredResources, sortField, sortOrder]);

  // Pagination
  const paginatedResources = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedResources.slice(start, start + itemsPerPage);
  }, [sortedResources, currentPage]);

  const totalPages = Math.ceil(sortedResources.length / itemsPerPage);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-extrabold text-foreground uppercase">Tenant Resource Explorer</h2>
          <p className="text-xs text-muted-foreground mt-1">Real-time inventory mapping of active Azure cloud resources and assets.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono font-bold">
          <span className="h-2 w-2 rounded-full bg-success animate-success-glow" />
          <span>Synchronized ARM Database</span>
        </div>
      </div>

      {/* Query Filter Toolbar */}
      <div className="p-4 bg-card border border-border rounded shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono">Query Index Filters</span>
          </div>
          <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
            Total Assets Discovered: {resources.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Field */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by name, tags, subscriptions ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-8 pr-3 py-1.5 w-full bg-background border border-border rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Class Filter */}
          <select
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
            className="px-2 py-1.5 bg-background border border-border rounded text-xs text-foreground focus:outline-none cursor-pointer font-semibold"
          >
            <option value="all">All Classes</option>
            {uniqueTypes.filter(t => t !== "all").map(t => (
              <option key={t} value={t}>{t.split('/').pop()}</option>
            ))}
          </select>

          {/* Region Filter */}
          <select
            value={selectedRegion}
            onChange={(e) => { setSelectedRegion(e.target.value); setCurrentPage(1); }}
            className="px-2 py-1.5 bg-background border border-border rounded text-xs text-foreground focus:outline-none cursor-pointer font-semibold"
          >
            <option value="all">All Regions</option>
            {uniqueRegions.filter(r => r !== "all").map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Explorer Table List */}
      <div className="bg-card border border-border rounded shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/15 text-muted-foreground uppercase font-bold text-[10px] tracking-wider select-none">
                <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => toggleSort("name")}>
                  <div className="flex items-center gap-1.5">
                    Asset Name <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => toggleSort("type")}>
                  <div className="flex items-center gap-1.5">
                    Class <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => toggleSort("region")}>
                  <div className="flex items-center gap-1.5">
                    Region <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => toggleSort("status")}>
                  <div className="flex items-center gap-1.5">
                    Status <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-foreground" onClick={() => toggleSort("cost")}>
                  <div className="flex items-center gap-1.5">
                    Est. Cost <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Metadata Tags</th>
              </tr>
            </thead>
            <tbody>
              {paginatedResources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground italic font-mono">
                    Zero tenant resources found matching the active query bounds.
                  </td>
                </tr>
              ) : (
                paginatedResources.map((res) => (
                  <tr key={res.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground flex items-center gap-2">
                      {res.type.toLowerCase().includes("vm") ? (
                        <Cpu className="h-3.5 w-3.5 text-primary shrink-0" />
                      ) : (
                        <Server className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      )}
                      <span className="truncate max-w-[160px]" title={res.name}>{res.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-[10px]">
                      {res.type}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3 w-3 text-muted-foreground/60" />
                        <span>{res.region}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono border ${
                        res.status === "Running"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : res.status === "Stopped"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        <span className={`h-1 w-1 rounded-full ${
                          res.status === "Running" ? "bg-emerald-500" : res.status === "Stopped" ? "bg-rose-500" : "bg-amber-500"
                        }`} />
                        {res.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      ${getResourceCost(res.type).toFixed(2)}/mo
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(res.tags).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded bg-secondary/35 text-slate-300 border border-border/55">
                            <Tag className="h-2 w-2" />
                            <span>{k}={v}</span>
                          </span>
                        ))}
                        {Object.keys(res.tags).length > 3 && (
                          <span className="text-[8px] text-muted-foreground font-mono font-bold">+{Object.keys(res.tags).length - 3} more</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Panel */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-border bg-secondary/5 flex items-center justify-between text-xs select-none">
            <span className="text-muted-foreground font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-2.5 py-1 rounded border border-border bg-card hover:bg-secondary/45 disabled:opacity-40 font-bold"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-2.5 py-1 rounded border border-border bg-card hover:bg-secondary/45 disabled:opacity-40 font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
