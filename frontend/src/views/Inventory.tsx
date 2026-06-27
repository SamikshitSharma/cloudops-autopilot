import React, { useState } from "react";
import { 
  Database, 
  Search, 
  Filter, 
  Globe, 
  Tag, 
  Cpu, 
  Server
} from "lucide-react";
import type { ResourceDTO } from "../api/client";

interface InventoryProps {
  resources: ResourceDTO[];
}

export function Inventory({ resources }: InventoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");

  // Get unique resource types for filter dropdown
  const uniqueTypes = ["all", ...new Set(resources.map(r => r.type))];

  // Get unique regions for filter dropdown
  const uniqueRegions = ["all", ...new Set(resources.map(r => r.region))];

  // Filter resources
  const filteredResources = resources.filter(res => {
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

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#22252d] pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">LIVE AZURE RESOURCE INVENTORY</h2>
          <p className="text-xs text-slate-400 mt-1">Discovered cloud resources across all configured resource groups and namespaces.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SYNCHRONIZED METADATA ASSETS</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4.5 w-4.5 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Asset Discovery Query Engine</h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
            TOTAL ASSETS Discovered: {resources.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search assets by name, ID, or tag details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-[#090b0f] border border-[#22252d] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-0"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-[#090b0f] border border-[#22252d] rounded-lg text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="all">All Resource Classes</option>
            {uniqueTypes.filter(t => t !== "all").map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Region Filter */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-3 py-2 bg-[#090b0f] border border-[#22252d] rounded-lg text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="all">All Regions</option>
            {uniqueRegions.filter(r => r !== "all").map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Assets Table */}
      <div className="p-6 bg-[#111318] border border-[#22252d] rounded-xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#22252d] text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">Asset Name</th>
                <th className="py-3 px-4">Resource Class</th>
                <th className="py-3 px-4">Datacenter Region</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Metadata Tags</th>
                <th className="py-3 px-4">Last Scanned Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                    No discovered resources matching the active filter query parameters.
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => (
                  <tr key={res.id} className="border-b border-[#1c1e24] hover:bg-[#16191f]/50 transition-all duration-150">
                    <td className="py-3.5 px-4 font-mono font-bold text-white flex items-center gap-2">
                      {res.type.toLowerCase().includes("vm") ? (
                        <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                      ) : (
                        <Server className="h-3.5 w-3.5 text-purple-400" />
                      )}
                      <span>{res.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[10px]">{res.type}</td>
                    <td className="py-3.5 px-4 text-slate-400 flex items-center gap-1.5 mt-1">
                      <Globe className="h-3.5 w-3.5 text-slate-500" />
                      <span>{res.region}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase font-mono border ${
                        res.status === "Running"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : res.status === "Stopped"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        <circle cx="2" cy="2" r="2" fill={
                          res.status === "Running" ? "#10b981" : res.status === "Stopped" ? "#f43f5e" : "#f59e0b"
                        } />
                        {res.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(res.tags).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-[#181b21] text-slate-400 border border-[#22252d]">
                            <Tag className="h-2.5 w-2.5" />
                            <span>{k}={v}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[10px]">
                      {new Date(res.last_seen).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
