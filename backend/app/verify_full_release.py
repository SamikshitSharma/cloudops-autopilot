"""
Full Release Integration Verification
Covers all 8 engineering contracts + workflow trigger, AI, Azure, Events, Audit, Approvals
"""
import sys
import json
import time
import httpx

BASE = "http://localhost:8000/api/v1"
PASSES = []
FAILURES = []

def check(name: str, condition: bool, detail: str = ""):
    if condition:
        PASSES.append(name)
        print(f"  [PASS] {name}")
    else:
        FAILURES.append(f"{name}: {detail}")
        print(f"  [FAIL] {name} -- {detail}")

def get(path: str, timeout: int = 10):
    try:
        r = httpx.get(f"{BASE}{path}", timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        detail = str(e)
        response = getattr(e, "response", None)
        if response is not None:
            try:
                detail = f"{detail} | body={response.json()}"
            except Exception:
                detail = f"{detail} | body={response.text[:500]}"
        return {"_error": detail}

def post(path: str, payload: dict, timeout: int = 15):
    try:
        r = httpx.post(f"{BASE}{path}", json=payload, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        detail = str(e)
        response = getattr(e, "response", None)
        if response is not None:
            try:
                detail = f"{detail} | body={response.json()}"
            except Exception:
                detail = f"{detail} | body={response.text[:500]}"
        return {"_error": detail}

# ─────────────────────────────────────────────
# SECTION 1 — HEALTH & AZURE MODE
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 1: Health, Azure & Cloud Mode")
print("="*60)
health = get("/health")
if "_error" in health:
    check("Health endpoint reachable", False, health["_error"])
else:
    hd = health.get("data", {})
    check("Health endpoint reachable", True)
    check("Health returns cloud_mode", "cloud_mode" in hd, f"keys={list(hd.keys())}")
    check("Database healthy", hd.get("database") == "healthy", f"got: {hd.get('database')}")
    check("Cloud mode set", hd.get("cloud_mode") in {"LIVE","MOCK"}, f"got: {hd.get('cloud_mode')}")
    print(f"    -> Cloud Mode: {hd.get('cloud_mode')}")

# ─────────────────────────────────────────────
# SECTION 2 — RESOURCES (Azure Inventory)
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 2: Resources / Azure Inventory")
print("="*60)
resources = get("/resources")
if "_error" in resources:
    check("Resources endpoint reachable", False, resources["_error"])
else:
    res_list = resources.get("data", [])
    check("Resources endpoint reachable", True)
    check("Resources returns list", isinstance(res_list, list))
    check("At least 1 resource present", len(res_list) > 0, f"count={len(res_list)}")
    if res_list:
        r0 = res_list[0]
        check("Resource has id", bool(r0.get("id")))
        check("Resource has type", bool(r0.get("type")))
        check("Resource has status", bool(r0.get("status")))
        print(f"    -> {len(res_list)} resources. Sample: {r0.get('name')} [{r0.get('type')}]")

# ─────────────────────────────────────────────
# SECTION 3 — WORKFLOW ENGINE
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 3: Workflow Engine")
print("="*60)
wf_list = get("/workflows")
if isinstance(wf_list, dict) and "_error" in wf_list:
    check("Workflows endpoint reachable", False, wf_list["_error"])
else:
    wf_list = wf_list if isinstance(wf_list, list) else []
    check("Workflows endpoint reachable", True)
    check("Workflows returns list", isinstance(wf_list, list))
    print(f"    -> {len(wf_list)} workflow(s) found")
    if wf_list:
        wf0 = wf_list[0]
        VALID = {"pending","running","completed","failed","paused","blocked_on_approval"}
        check("Workflow has valid status", wf0.get("status") in VALID, f"got: {wf0.get('status')}")
        check("Workflow has progress_percentage", "progress_percentage" in wf0)
        check("Workflow has confidence", "confidence" in wf0)

# Trigger a new workflow run
print("    -> Triggering new workflow run...")
trigger_resp = post("/runs", {
    "scenario_name": "release-verification-sweep",
    "objective": "Release integration verification: full sweep of idle resources",
    "dry_run": True
})
if "_error" in trigger_resp:
    check("Trigger new workflow run", False, trigger_resp["_error"])
else:
    check("Trigger new workflow run", trigger_resp.get("success") is True,
          f"response: {str(trigger_resp)[:120]}")
    new_run_id = trigger_resp.get("data", {}).get("run_id") or trigger_resp.get("data", {}).get("id")
    if new_run_id:
        print(f"    -> New run id: {new_run_id}")

# Metrics summary
metrics = get("/workflows/metrics/summary")
if "_error" not in metrics:
    m = metrics
    check("Metrics endpoint reachable", True)
    check("success_rate is numeric", isinstance(m.get("success_rate"), (int, float)),
          f"got: {m.get('success_rate')}")
    check("total_workflow_executions present", m.get("total_workflow_executions") is not None)
    check("llm_requests not hardcoded 189", m.get("llm_requests") != 189)
    check("azure_api_calls not hardcoded 1182",
          (m.get("azure_api_calls") or m.get("azure_api_calls_today")) != 1182)
    sr = m.get("success_rate", 0) or 0
    fr = m.get("failure_rate", 0) or 0
    check("success_rate + failure_rate <= 100", sr + fr <= 100.01, f"{sr}+{fr}={sr+fr}")
    print(f"    -> Metrics: success_rate={sr}%, total_execs={m.get('total_workflow_executions')}")
else:
    check("Metrics endpoint reachable", False, metrics["_error"])

# ─────────────────────────────────────────────
# SECTION 4 — EVENT BUS (derived from audit logs across runs)
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 4: Event Bus (via Run Audit Logs)")
print("="*60)
runs_resp = get("/runs")
if "_error" in runs_resp:
    check("Runs endpoint reachable (for event bus)", False, runs_resp["_error"])
else:
    runs_data = runs_resp.get("data", [])
    check("Runs endpoint reachable (for event bus)", True)
    all_events = []
    for run in runs_data[:3]:  # check first 3 runs
        run_id = run.get("id")
        if run_id:
            run_detail = get(f"/runs/{run_id}")
            if "_error" not in run_detail:
                logs = (run_detail.get("data") or {}).get("audit_logs", [])
                all_events.extend(logs)
    check("Event bus (audit logs) has entries", len(all_events) > 0,
          f"total events across runs={len(all_events)}")
    print(f"    -> {len(all_events)} event entries found across runs")
    if all_events:
        ev0 = all_events[0]
        check("Event has event_type field", bool(ev0.get("event_type")))


# ─────────────────────────────────────────────
# SECTION 5 — AUDIT LOG (via run details)
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 5: Audit Log (via Run Details)")
print("="*60)
runs_resp2 = get("/runs")
if "_error" in runs_resp2:
    check("Audit logs endpoint reachable", False, runs_resp2["_error"])
else:
    runs_data2 = runs_resp2.get("data", [])
    check("Audit logs endpoint reachable", True)
    if runs_data2:
        first_run_id = runs_data2[0].get("id")
        run_detail2 = get(f"/runs/{first_run_id}")
        if "_error" not in run_detail2:
            al = (run_detail2.get("data") or {}).get("audit_logs", [])
            check("Audit logs returns list", isinstance(al, list))
            print(f"    -> {len(al)} audit log entries in run {first_run_id[:8]}")
            if al:
                a0 = al[0]
                check("Audit log has event_type",
                      bool(a0.get("event_type") or a0.get("action") or a0.get("tool_name")))
        else:
            check("Audit logs reachable via run detail", False, run_detail2.get("_error", ""))
    else:
        check("Runs available for audit check", False, "no runs found")


# ─────────────────────────────────────────────
# SECTION 6 — AI / EXPLAINABILITY (Reasoning Paths)
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 6: AI / Explainability (Reasoning Paths)")
print("="*60)
paths = get("/reasoning-paths")
if "_error" in paths:
    check("Reasoning paths endpoint reachable", False, paths["_error"])
else:
    pl = paths.get("data", [])
    check("Reasoning paths endpoint reachable", True)
    check("Reasoning paths returns list", isinstance(pl, list))
    print(f"    -> {len(pl)} reasoning path(s)")
    if pl:
        p0 = pl[0]
        check("Reasoning path has agent_name", bool(p0.get("agent_name")))
        check("Reasoning path has trigger_event", bool(p0.get("trigger_event")))
        check("Reasoning path has observations", bool(p0.get("observations")))
        check("Reasoning path has hypotheses", bool(p0.get("hypotheses")))
        if p0.get("hypotheses"):
            h0 = p0["hypotheses"][0]
            check("Hypothesis has confidence", "confidence_score" in h0 or "confidence" in h0)

# Ask AI endpoint — correct path is /ask-ai, correct field is 'query'
ai_resp = post("/ask-ai", {"query": "What is the current system health status?"})
if "_error" in ai_resp:
    check("AI ask endpoint reachable", False, ai_resp["_error"])
else:
    answer = (ai_resp.get("data") or {}).get("response") or (ai_resp.get("data") or {}).get("answer") or ai_resp.get("answer") or ai_resp.get("response", "")
    answer_text = str(answer).strip()
    check("AI ask endpoint reachable", ai_resp.get("success") is True, f"resp keys={list(ai_resp.keys())[:5]}")
    check("AI ask returns non-empty answer", bool(answer_text), "empty AI response")
    check("AI ask does not return an error payload", not answer_text.lower().startswith(("error:", "ai generation failed")), answer_text[:160])
    print(f"    -> AI response sample: {answer_text[:100]}")


# ─────────────────────────────────────────────
# SECTION 7 — RECOMMENDATIONS
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 7: Recommendations")
print("="*60)
recos = get("/recommendations")
if "_error" in recos:
    check("Recommendations endpoint reachable", False, recos["_error"])
else:
    rl = recos.get("data", [])
    check("Recommendations endpoint reachable", True)
    check("Recommendations returns list", isinstance(rl, list))
    print(f"    -> {len(rl)} recommendation(s)")
    if rl:
        for reco in rl[:3]:
            check(f"Reco {str(reco.get('id',''))[:12]} has run_id", bool(reco.get("run_id")))
            check(f"Reco {str(reco.get('id',''))[:12]} has evidence", reco.get("evidence") is not None)

# ─────────────────────────────────────────────
# SECTION 8 — APPROVALS
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 8: Approvals")
print("="*60)
approvals = get("/approvals")
if "_error" in approvals:
    check("Approvals endpoint reachable", False, approvals["_error"])
else:
    al2 = approvals.get("data", [])
    check("Approvals endpoint reachable", True)
    check("Approvals returns list", isinstance(al2, list))
    print(f"    -> {len(al2)} approval(s)")
    for ap in al2:
        check(f"Approval {str(ap.get('id',''))[:12]} has valid status",
              ap.get("status") in {"pending","approved","rejected"},
              f"got: {ap.get('status')}")
    if not al2:
        check("Approvals endpoint operational (0 approvals is valid)", True)

# ─────────────────────────────────────────────
# SECTION 9 — TOPOLOGY
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 9: Topology Visualizer")
print("="*60)
topo = get("/topology")
if "_error" in topo:
    check("Topology endpoint reachable", False, topo["_error"])
else:
    td = topo.get("data", topo)
    check("Topology endpoint reachable", True)
    infra_nodes = td.get("infrastructure", {}).get("nodes", [])
    # API returns key 'agent' (not 'agents')
    agent_nodes = td.get("agent", {}).get("nodes", [])
    check("Topology has infra nodes", len(infra_nodes) > 0, f"count={len(infra_nodes)}")
    check("Topology has agent nodes", len(agent_nodes) > 0, f"count={len(agent_nodes)}")
    print(f"    -> Infra nodes: {len(infra_nodes)}, Agent nodes: {len(agent_nodes)}")

# ─────────────────────────────────────────────
# FINAL SUMMARY
# ─────────────────────────────────────────────
print("\n" + "="*60)
print("RELEASE VERIFICATION SUMMARY")
print("="*60)
total = len(PASSES) + len(FAILURES)
print(f"\n  Total Checks : {total}")
print(f"  Passed       : {len(PASSES)}")
print(f"  Failed       : {len(FAILURES)}")

if FAILURES:
    print("\n  FAILURES:")
    for f in FAILURES:
        print(f"    [FAIL] {f}")
    print()
    sys.exit(1)
else:
    print("\n  [ALL PASS] ALL RELEASE CHECKS PASSED. INTEGRATION IS COMPLETE.\n")
    sys.exit(0)
