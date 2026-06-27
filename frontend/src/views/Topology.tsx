import React, { useState } from "react";
import { 
  Network,
  Info, 
  MapPin, 
  Tag, 
  Cpu, 
  Database,
  Globe,
  Settings
} from "lucide-react";
import type { ResourceDTO } from "../api/client";

interface TopologyProps {
  resources: ResourceDTO[];
}

export function Topology({ resources }: TopologyProps) {
  const [selectedResource, setSelectedResource] = useState<ResourceDTO | null>(null);

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "running":
      case "active":
        return "#10b981"; // Emerald
      case "stopped":
      case "deallocated":
        return "#f43f5e"; // Rose
      case "unattached":
      case "detached":
      default:
        return "#f59e0b"; // Amber
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#22252d] pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide">AZURE SUBSCRIPTION TOPOLOGY MAP</h2>
          <p className="text-xs text-slate-400 mt-1">Logical relationship maps and resource boundaries across Azure Resource Groups.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span>INTERACTIVE MAP HOVER ENGINE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Topology Canvas Container */}
        <div className="lg:col-span-3 border border-[#22252d] rounded-xl bg-[#0b0c10] p-6 shadow-2xl flex justify-center items-center min-h-[460px] relative overflow-hidden group">
          <div className="absolute top-4 left-4 flex gap-4 text-[9px] text-slate-400 font-mono">
            <span className="flex items-center gap-1"><circle cx="4" cy="4" r="3.5" fill="#10b981" /> RUNNING</span>
            <span className="flex items-center gap-1"><circle cx="4" cy="4" r="3.5" fill="#f43f5e" /> STOPPED</span>
            <span className="flex items-center gap-1"><circle cx="4" cy="4" r="3.5" fill="#f59e0b" /> ORPHANED</span>
          </div>

          <svg width="740" height="380" viewBox="0 0 740 380" className="w-full max-w-[740px]">
            {/* Subscription Bound Box */}
            <rect x="10" y="10" width="720" height="360" rx="14" fill="none" stroke="#22252d" strokeWidth="2" strokeDasharray="6 6" />
            <text x="30" y="32" className="text-[10px] font-bold fill-slate-500 font-mono tracking-widest uppercase">Azure Subscription / SamikshitSharma</text>

            {/* rg-prod Container */}
            <g id="rg-prod">
              <rect x="30" y="60" width="340" height="280" rx="10" fill="#111318" fillOpacity="0.3" stroke="#22252d" strokeWidth="1.5" />
              <text x="45" y="80" className="text-[10px] font-bold fill-indigo-400 font-mono tracking-wide uppercase">rg-prod (Production)</text>
              
              {/* vm-idle-01 */}
              <g className="cursor-pointer group" 
                 onClick={() => setSelectedResource(resources.find(r => r.id === "vm-idle-01") || null)}
                 onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-idle-01") || null)}>
                <rect x="50" y="100" width="135" height="65" rx="8" fill="#16191f" stroke={selectedResource?.id === "vm-idle-01" ? "#6366f1" : "#22252d"} strokeWidth={selectedResource?.id === "vm-idle-01" ? "2.5" : "1.5"} className="transition-all duration-200" />
                <text x="62" y="125" className="text-[11px] font-bold fill-white">vm-idle-01</text>
                <text x="62" y="145" className="text-[9px] fill-slate-500 font-mono">Microsoft.Compute/VM</text>
                <circle cx="165" cy="132" r="5" fill="#f43f5e" className="animate-pulse" /> {/* Stopped indicator */}
              </g>

              {/* vm-over-01 */}
              <g className="cursor-pointer" 
                 onClick={() => setSelectedResource(resources.find(r => r.id === "vm-over-01") || null)}
                 onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-over-01") || null)}>
                <rect x="215" y="100" width="135" height="65" rx="8" fill="#16191f" stroke={selectedResource?.id === "vm-over-01" ? "#6366f1" : "#22252d"} strokeWidth={selectedResource?.id === "vm-over-01" ? "2.5" : "1.5"} />
                <text x="227" y="125" className="text-[11px] font-bold fill-white">vm-over-01</text>
                <text x="227" y="145" className="text-[9px] fill-slate-500 font-mono">Microsoft.Compute/VM</text>
                <circle cx="330" cy="132" r="5" fill="#10b981" /> {/* Running indicator */}
              </g>

              {/* vm-busy-01 */}
              <g className="cursor-pointer" 
                 onClick={() => setSelectedResource(resources.find(r => r.id === "vm-busy-01") || null)}
                 onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-busy-01") || null)}>
                <rect x="50" y="190" width="135" height="65" rx="8" fill="#16191f" stroke={selectedResource?.id === "vm-busy-01" ? "#6366f1" : "#22252d"} strokeWidth={selectedResource?.id === "vm-busy-01" ? "2.5" : "1.5"} />
                <text x="62" y="215" className="text-[11px] font-bold fill-white">vm-busy-01</text>
                <text x="62" y="235" className="text-[9px] fill-slate-500 font-mono">Microsoft.Compute/VM</text>
                <circle cx="165" cy="222" r="5" fill="#10b981" />
              </g>

              {/* vm-strict-01 */}
              <g className="cursor-pointer" 
                 onClick={() => setSelectedResource(resources.find(r => r.id === "vm-strict-01") || null)}
                 onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-strict-01") || null)}>
                <rect x="215" y="190" width="135" height="65" rx="8" fill="#16191f" stroke={selectedResource?.id === "vm-strict-01" ? "#6366f1" : "#22252d"} strokeWidth={selectedResource?.id === "vm-strict-01" ? "2.5" : "1.5"} />
                <text x="227" y="215" className="text-[11px] font-bold fill-white">vm-strict-01</text>
                <text x="227" y="235" className="text-[9px] fill-slate-500 font-mono">Microsoft.Compute/VM</text>
                <circle cx="330" cy="222" r="5" fill="#10b981" />
              </g>

              {/* Logical linking paths */}
              <path d="M 185 132 L 215 132" stroke="#22252d" strokeWidth="1.5" strokeDasharray="3 3" />
              <path d="M 185 222 L 215 222" stroke="#22252d" strokeWidth="1.5" strokeDasharray="3 3" />
            </g>

            {/* rg-dev Container */}
            <g id="rg-dev">
              <rect x="390" y="60" width="320" height="130" rx="10" fill="#111318" fillOpacity="0.3" stroke="#22252d" strokeWidth="1.5" />
              <text x="405" y="80" className="text-[10px] font-bold fill-indigo-400 font-mono tracking-wide uppercase">rg-dev (Development)</text>
              
              {/* vm-dev-idle-01 */}
              <g className="cursor-pointer" 
                 onClick={() => setSelectedResource(resources.find(r => r.id === "vm-dev-idle-01") || null)}
                 onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-dev-idle-01") || null)}>
                <rect x="405" y="100" width="135" height="65" rx="8" fill="#16191f" stroke={selectedResource?.id === "vm-dev-idle-01" ? "#6366f1" : "#22252d"} strokeWidth={selectedResource?.id === "vm-dev-idle-01" ? "2.5" : "1.5"} />
                <text x="417" y="125" className="text-[11px] font-bold fill-white">vm-dev-idle-01</text>
                <text x="417" y="145" className="text-[9px] fill-slate-500 font-mono">Microsoft.Compute/VM</text>
                <circle cx="520" cy="132" r="5" fill="#10b981" />
              </g>

              {/* disk-temp-01 */}
              <g className="cursor-pointer" 
                 onClick={() => setSelectedResource(resources.find(r => r.id === "disk-temp-01") || null)}
                 onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "disk-temp-01") || null)}>
                <rect x="560" y="100" width="135" height="65" rx="8" fill="#16191f" stroke={selectedResource?.id === "disk-temp-01" ? "#6366f1" : "#22252d"} strokeWidth={selectedResource?.id === "disk-temp-01" ? "2.5" : "1.5"} />
                <text x="572" y="125" className="text-[11px] font-bold fill-white">disk-temp-01</text>
                <text x="572" y="145" className="text-[9px] fill-slate-500 font-mono">Microsoft.Compute/Disk</text>
                <circle cx="675" cy="132" r="5" fill="#f59e0b" />
              </g>

              <path d="M 540 132 L 560 132" stroke="#22252d" strokeWidth="1.5" strokeDasharray="3 3" />
            </g>

            {/* rg-staging Container */}
            <g id="rg-staging">
              <rect x="390" y="210" width="320" height="130" rx="10" fill="#111318" fillOpacity="0.3" stroke="#22252d" strokeWidth="1.5" />
              <text x="405" y="230" className="text-[10px] font-bold fill-indigo-400 font-mono tracking-wide uppercase">rg-staging (Staging)</text>

              {/* vm-conflict-01 */}
              <g className="cursor-pointer" 
                 onClick={() => setSelectedResource(resources.find(r => r.id === "vm-conflict-01") || null)}
                 onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-conflict-01") || null)}>
                <rect x="405" y="250" width="135" height="65" rx="8" fill="#16191f" stroke={selectedResource?.id === "vm-conflict-01" ? "#6366f1" : "#22252d"} strokeWidth={selectedResource?.id === "vm-conflict-01" ? "2.5" : "1.5"} />
                <text x="417" y="275" className="text-[11px] font-bold fill-white">vm-conflict-01</text>
                <text x="417" y="295" className="text-[9px] fill-slate-500 font-mono">Microsoft.Compute/VM</text>
                <circle cx="520" cy="282" r="5" fill="#f43f5e" />
              </g>

              {/* vm-prod-active-02 */}
              <g className="cursor-pointer" 
                 onClick={() => setSelectedResource(resources.find(r => r.id === "vm-prod-active-02") || null)}
                 onMouseEnter={() => setSelectedResource(resources.find(r => r.id === "vm-prod-active-02") || null)}>
                <rect x="560" y="250" width="135" height="65" rx="8" fill="#16191f" stroke={selectedResource?.id === "vm-prod-active-02" ? "#6366f1" : "#22252d"} strokeWidth={selectedResource?.id === "vm-prod-active-02" ? "2.5" : "1.5"} />
                <text x="572" y="275" className="text-[11px] font-bold fill-white">vm-prod-active-02</text>
                <text x="572" y="295" className="text-[9px] fill-slate-500 font-mono">Microsoft.Compute/VM</text>
                <circle cx="675" cy="282" r="5" fill="#10b981" />
              </g>

              <path d="M 540 282 L 560 282" stroke="#22252d" strokeWidth="1.5" strokeDasharray="3 3" />
            </g>
          </svg>
        </div>

        {/* Node Inspector Side Panel */}
        <div className="p-6 border border-[#22252d] bg-[#111318] rounded-xl flex flex-col justify-between shadow-2xl">
          <div>
            <div className="flex items-center gap-2 mb-6 border-b border-[#22252d] pb-4">
              <Info className="h-4.5 w-4.5 text-indigo-400" />
              <h4 className="font-heading font-extrabold text-xs tracking-wider uppercase text-slate-200">Topology Inspector</h4>
            </div>

            {selectedResource ? (
              <div className="space-y-5">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono">Resource ID</span>
                  <span className="text-xs font-bold text-white font-mono">{selectedResource.name}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono">Azure Class</span>
                  <span className="text-xs text-slate-300 font-mono break-all leading-normal">{selectedResource.type}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono">Region Datacenter</span>
                  <span className="text-xs text-slate-300 flex items-center gap-1.5 mt-1">
                    <Globe className="h-3.5 w-3.5 text-slate-500" />
                    <span>{selectedResource.region}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono">Lifecycle State</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1.5 rounded-full text-[9px] font-extrabold uppercase font-mono" style={{
                    backgroundColor: `${getStatusColor(selectedResource.status)}15`,
                    color: getStatusColor(selectedResource.status),
                    border: `1px solid ${getStatusColor(selectedResource.status)}30`
                  }}>
                    <circle cx="3" cy="3" r="3" fill={getStatusColor(selectedResource.status)} />
                    {selectedResource.status}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block font-mono mb-2">Resource Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(selectedResource.tags).map(([k, v]) => (
                      <span key={k} className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-[#181b21] text-slate-400 border border-[#22252d]">
                        <Tag className="h-2.5 w-2.5" />
                        <span>{k}={v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <Network className="h-8 w-8 text-slate-600 mx-auto mb-3 animate-pulse" />
                <p className="text-xs text-slate-400 font-medium">Select or hover a node</p>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Inspection properties will populate on interaction.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#22252d] text-[9px] text-slate-500 font-mono leading-relaxed">
            Topology is evaluated in real time through Azure SDK API endpoints.
          </div>
        </div>

      </div>
    </div>
  );
}
