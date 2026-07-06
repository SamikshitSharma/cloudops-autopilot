"""
Final Completion Criteria Verification Script
Verifies all Engineering Contracts against the running application.

Actual API response shapes (discovered by inspection):
  GET /workflows/metrics/summary  -> flat dict (no success/data wrapper)
  GET /workflows                  -> raw list
  GET /approvals                  -> {success, message, data, timestamp}
  GET /recommendations            -> {success, message, data, timestamp}
  GET /reasoning-paths            -> {success, message, data, timestamp}
  GET /resources                  -> {success, message, data, timestamp}
  GET /health                     -> {success, message, data, timestamp}
"""
import sys
import json
import httpx
import time

BASE_URL = "http://localhost:8000/api/v1"
FAILURES = []
PASSES = []

def check(name: str, condition: bool, detail: str = ""):
    if condition:
        PASSES.append(f"PASS: {name}")
        print(f"  PASS: {name}")
    else:
        FAILURES.append(f"FAIL: {name}: {detail}")
        print(f"  FAIL: {name} -- {detail}")

def get(path: str):
    try:
        r = httpx.get(f"{BASE_URL}{path}", timeout=10)
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

# ============================================================
# CONTRACT 1: Data Integrity (No Fabricated Metrics)
# Response: flat dict with no success/data envelope
# ============================================================
print("\n" + "="*60)
print("CONTRACT 1: Data Integrity (No Fabricated Metrics)")
print("="*60)
metrics = get("/workflows/metrics/summary")
if "_error" in metrics:
    check("Metrics endpoint reachable", False, metrics["_error"])
else:
    # metrics IS the data object directly
    m = metrics
    check("Metrics endpoint reachable", True)
    check("success_rate is a real number",
          m.get("success_rate") is not None and isinstance(m.get("success_rate"), (int, float)),
          f"Got: {m.get('success_rate')}")
    check("failure_rate present", m.get("failure_rate") is not None,
          f"Got: {m.get('failure_rate')}")
    check("total_workflow_executions present",
          m.get("total_workflow_executions") is not None,
          f"Got: {m.get('total_workflow_executions')}")
    check("llm_requests present", m.get("llm_requests") is not None,
          f"Got: {m.get('llm_requests')}")
    check("events_processed present", m.get("events_processed") is not None,
          f"Got: {m.get('events_processed')}")
    check("pending_approvals present", m.get("pending_approvals") is not None,
          f"Got: {m.get('pending_approvals')}")
    check("active_agents present", m.get("active_agents") is not None,
          f"Got: {m.get('active_agents')}")
    check("cost_saved_today present", m.get("cost_saved_today") is not None,
          f"Got: {m.get('cost_saved_today')}")
    # azure_api_calls: field is 'azure_api_calls_today' in actual response
    azure_calls = m.get("azure_api_calls_today") if m.get("azure_api_calls") is None else m.get("azure_api_calls")
    check("azure_api_calls present", azure_calls is not None,
          f"Got azure_api_calls={m.get('azure_api_calls')}, azure_api_calls_today={m.get('azure_api_calls_today')}")
    sr = m.get("success_rate", 0) or 0
    fr = m.get("failure_rate", 0) or 0
    total = sr + fr
    check("success_rate + failure_rate <= 100", total <= 100.01,
          f"Got {sr} + {fr} = {total}")

# ============================================================
# CONTRACT 2: State Consistency
# Response: raw list (no envelope)
# ============================================================
print("\n" + "="*60)
print("CONTRACT 2: State Consistency")
print("="*60)
workflows_raw = get("/workflows")
if "_error" in workflows_raw if isinstance(workflows_raw, dict) else False:
    check("Workflows list reachable", False, workflows_raw.get("_error", ""))
else:
    wf_list = workflows_raw if isinstance(workflows_raw, list) else []
    check("Workflows endpoint reachable", True)
    check("Workflows endpoint returns list", isinstance(wf_list, list),
          f"Got type: {type(wf_list).__name__}")
    if wf_list:
        wf = wf_list[0]
        status = wf.get("status", "")
        VALID_STATUSES = {"pending", "running", "completed", "failed", "paused", "blocked_on_approval"}
        check("Workflow has valid status", status in VALID_STATUSES,
              f"Got: {status}")
        check("progress_percentage present", "progress_percentage" in wf,
              f"Keys: {list(wf.keys())}")
        check("confidence present", "confidence" in wf,
              f"Keys: {list(wf.keys())}")
        if status == "completed":
            check("Completed workflow has 100% progress",
                  wf.get("progress_percentage", 0) == 100.0,
                  f"Got {wf.get('progress_percentage')}")
    else:
        check("At least one workflow exists", False, "Workflow list is empty — trigger a run first")

# ============================================================
# CONTRACT 3: Workflow Integrity (Transactional Approval)
# Response: {success, message, data, timestamp}
# ============================================================
print("\n" + "="*60)
print("CONTRACT 3: Workflow Integrity (Transactional Approval)")
print("="*60)
approvals = get("/approvals")
if "_error" in approvals:
    check("Approvals endpoint reachable", False, approvals["_error"])
elif not approvals.get("success"):
    check("Approvals endpoint reachable", False,
          approvals.get("message", "success=false"))
else:
    app_list = approvals.get("data", [])
    check("Approvals endpoint reachable", True)
    check("Approvals endpoint returns list", isinstance(app_list, list),
          f"Got type: {type(app_list).__name__}")
    if app_list:
        for a in app_list:
            valid = a.get("status") in {"pending", "approved", "rejected"}
            check(f"Approval {a.get('id', '')[:12]} has valid status", valid,
                  f"Got: {a.get('status')}")
    else:
        # No approvals yet is valid — no workflow has reached the approval gate
        check("Approvals endpoint operational (0 approvals is valid state)", True)

# ============================================================
# CONTRACT 4: Traceability (Recommendations link to Runs)
# Response: {success, message, data, timestamp}
# ============================================================
print("\n" + "="*60)
print("CONTRACT 4: Traceability (Recommendations link to Runs)")
print("="*60)
recos = get("/recommendations")
if "_error" in recos:
    check("Recommendations endpoint reachable", False, recos["_error"])
elif not recos.get("success"):
    check("Recommendations endpoint reachable", False,
          recos.get("message", "success=false"))
else:
    reco_list = recos.get("data", [])
    check("Recommendations endpoint reachable", True)
    check("Recommendations endpoint returns list", isinstance(reco_list, list),
          f"Got type: {type(reco_list).__name__}")
    if reco_list:
        for r in reco_list[:5]:
            has_run_id = bool(r.get("run_id"))
            check(f"Reco {r.get('id','')[:12]} has run_id", has_run_id,
                  f"run_id={r.get('run_id')}")
            has_evidence = r.get("evidence") is not None
            check(f"Reco {r.get('id','')[:12]} has evidence", has_evidence,
                  f"evidence={r.get('evidence')}")
    else:
        check("At least one recommendation exists", False,
              "Recommendation list is empty — trigger a run first")

# ============================================================
# CONTRACT 5: Persistence
# Response: {success, message, data, timestamp}
# ============================================================
print("\n" + "="*60)
print("CONTRACT 5: Persistence")
print("="*60)
health = get("/health")
if "_error" in health:
    check("Health endpoint reachable", False, health["_error"])
elif health.get("success"):
    hdata = health.get("data", {})
    check("Health endpoint reachable", True)
    check("Health returns cloud_mode", "cloud_mode" in hdata,
          f"Got: {list(hdata.keys())}")
    check("Database shows healthy", hdata.get("database") == "healthy",
          f"Got: {hdata.get('database')}")
else:
    check("Health endpoint reachable", False,
          health.get("message", "success=false"))

# ============================================================
# CONTRACT 6: Explainability
# Response: {success, message, data, timestamp}
# ============================================================
print("\n" + "="*60)
print("CONTRACT 6: Explainability")
print("="*60)
paths = get("/reasoning-paths")
if "_error" in paths:
    check("Reasoning paths endpoint reachable", False, paths["_error"])
elif not paths.get("success"):
    check("Reasoning paths endpoint reachable", False,
          paths.get("message", "success=false"))
else:
    path_list = paths.get("data", [])
    check("Reasoning paths endpoint reachable", True)
    check("Reasoning paths endpoint returns list", isinstance(path_list, list),
          f"Got type: {type(path_list).__name__}")
    if path_list:
        p = path_list[0]
        check("Reasoning path has agent_name", bool(p.get("agent_name")),
              f"Got: {p.get('agent_name')}")
        check("Reasoning path has trigger_event", bool(p.get("trigger_event")),
              f"Got: {p.get('trigger_event')}")
        check("Reasoning path has observations", bool(p.get("observations")),
              f"Got: {p.get('observations')}")
        check("Reasoning path has hypotheses", bool(p.get("hypotheses")),
              f"Got: {p.get('hypotheses')}")
        if p.get("hypotheses"):
            h = p["hypotheses"][0]
            check("Hypothesis has confidence",
                  "confidence_score" in h or "confidence" in h,
                  f"Keys: {list(h.keys())}")
            check("Hypothesis has text",
                  bool(h.get("evidence") or h.get("hypothesis")),
                  f"evidence={h.get('evidence')}, hypothesis={h.get('hypothesis')}")
    else:
        check("At least one reasoning path exists", False,
              "No reasoning paths found — run a full workflow cycle to populate them")

# ============================================================
# CONTRACT 7: No Hardcoded Seed Contamination
# Uses same flat metrics dict from Contract 1
# ============================================================
print("\n" + "="*60)
print("CONTRACT 7: No Hardcoded Seed Contamination")
print("="*60)
if "_error" not in metrics:
    m = metrics  # flat dict
    llm = m.get("llm_requests")
    azure = m.get("azure_api_calls") or m.get("azure_api_calls_today")
    check("LLM requests not exactly 189 (hardcoded seed)", llm != 189,
          f"Got: {llm}")
    check("Azure API calls not exactly 1182 (hardcoded seed)", azure != 1182,
          f"Got: {azure}")
else:
    check("Metrics available for seed check", False, "Metrics endpoint failed")

# ============================================================
# CONTRACT 8: Resources Endpoint
# Response: {success, message, data, timestamp}
# ============================================================
print("\n" + "="*60)
print("CONTRACT 8: Resources Endpoint")
print("="*60)
resources = get("/resources")
if "_error" in resources:
    check("Resources endpoint reachable", False, resources["_error"])
elif not resources.get("success"):
    check("Resources endpoint reachable", False,
          resources.get("message", "success=false"))
else:
    res_list = resources.get("data", [])
    check("Resources endpoint reachable", True)
    check("Resources endpoint returns list", isinstance(res_list, list),
          f"Got type: {type(res_list).__name__}")
    if res_list:
        check("Resource has id", bool(res_list[0].get("id")),
              f"Got: {res_list[0].get('id')}")
        check("Resource has type", bool(res_list[0].get("type")),
              f"Got: {res_list[0].get('type')}")
        check("Resource has status", bool(res_list[0].get("status")),
              f"Got: {res_list[0].get('status')}")
    else:
        check("At least one resource exists", False, "Resources list is empty")

# ============================================================
# SUMMARY
# ============================================================
print("\n" + "="*60)
print("VERIFICATION SUMMARY")
print("="*60)
total = len(PASSES) + len(FAILURES)
print(f"\nTotal Checks: {total}")
print(f"Passed:       {len(PASSES)}")
print(f"Failed:       {len(FAILURES)}")
print()

if FAILURES:
    print("FAILURES:")
    for f in FAILURES:
        print(f"  {f}")
    sys.exit(1)
else:
    print("ALL CHECKS PASSED.")
    sys.exit(0)
