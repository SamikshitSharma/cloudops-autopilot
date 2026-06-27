from typing import Dict, Any

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "idle_vm": {
        "scenario_name": "idle_vm",
        "description": "Simulates an idle VM which can be stopped directly.",
        "telemetry_data": {
            "resource_group": "production-rg",
            "metrics": [
                {"resource_id": "vm-idle-01", "type": "VirtualMachine", "cpu_utilization": 2.5, "memory_utilization": 15.0, "status": "running"}
            ]
        }
    },
    "overprovisioned_vm": {
        "scenario_name": "overprovisioned_vm",
        "description": "Simulates an overprovisioned VM where CPU is low but it's actively used.",
        "telemetry_data": {
            "resource_group": "production-rg",
            "metrics": [
                {"resource_id": "vm-over-01", "type": "VirtualMachine", "cpu_utilization": 8.0, "memory_utilization": 40.0, "status": "running"}
            ]
        }
    },
    "unused_disk": {
        "scenario_name": "unused_disk",
        "description": "Simulates an unattached disk candidate for deletion, requiring policy approval.",
        "telemetry_data": {
            "resource_group": "storage-rg",
            "metrics": [
                {"resource_id": "disk-unused-01", "type": "Disk", "status": "unattached"}
            ]
        }
    },
    "scaling_recommendation": {
        "scenario_name": "scaling_recommendation",
        "description": "Simulates fluctuating metrics recommending auto-scaling policy configurations.",
        "telemetry_data": {
            "resource_group": "scale-rg",
            "metrics": [
                {"resource_id": "vm-scale-01", "type": "VirtualMachine", "cpu_utilization": 45.0, "memory_utilization": 60.0, "status": "running", "fluctuating": True}
            ]
        }
    },
    "high_cpu_vm": {
        "scenario_name": "high_cpu_vm",
        "description": "Simulates high-utilization VM that is fully compliant and doesn't need scaling or stopping.",
        "telemetry_data": {
            "resource_group": "heavy-rg",
            "metrics": [
                {"resource_id": "vm-busy-01", "type": "VirtualMachine", "cpu_utilization": 95.0, "memory_utilization": 90.0, "status": "running"}
            ]
        }
    },
    "policy_rejection": {
        "scenario_name": "policy_rejection",
        "description": "Simulates a VM remediation action violating policy checks, resulting in rejection.",
        "telemetry_data": {
            "resource_group": "strict-rg",
            "metrics": [
                {"resource_id": "vm-strict-01", "type": "VirtualMachine", "cpu_utilization": 3.0, "memory_utilization": 10.0, "status": "running"}
            ]
        }
    },
    "missing_telemetry": {
        "scenario_name": "missing_telemetry",
        "description": "Simulates complete lack of telemetry metrics, raising exception.",
        "telemetry_data": {}
    },
    "low_confidence": {
        "scenario_name": "low_confidence",
        "description": "Simulates noisy telemetry causing a cascade of low confidence scores.",
        "telemetry_data": {
            "resource_group": "noisy-rg",
            "metrics": [
                {"resource_id": "vm-noisy-01", "type": "VirtualMachine", "cpu_utilization": 9.5, "memory_utilization": 50.0, "status": "running"}
            ]
        }
    },
    "verification_failure": {
        "scenario_name": "verification_failure",
        "description": "Simulates a VM stop action executing but verification finding it still running.",
        "telemetry_data": {
            "resource_group": "failure-rg",
            "metrics": [
                {"resource_id": "vm-fail-01", "type": "VirtualMachine", "cpu_utilization": 2.0, "memory_utilization": 10.0, "status": "running"}
            ]
        }
    },
    "timeout": {
        "scenario_name": "timeout",
        "description": "Simulates a latency delay resulting in workflow timeout.",
        "telemetry_data": {
            "resource_group": "timeout-rg",
            "metrics": [
                {"resource_id": "vm-timeout-01", "type": "VirtualMachine", "cpu_utilization": 3.0, "memory_utilization": 10.0, "status": "running"}
            ]
        }
    },
    "conflicting_recommendations": {
        "scenario_name": "conflicting_recommendations",
        "description": "Telemetry recommends stopping (mostly idle), FinOps recommends resizing for long-term cost optimization, Policy requires approval.",
        "telemetry_data": {
            "resource_group": "conflict-rg",
            "metrics": [
                {"resource_id": "vm-conflict-01", "type": "VirtualMachine", "cpu_utilization": 4.0, "memory_utilization": 30.0, "status": "running", "is_production": True}
            ]
        }
    },
    "partial_failure": {
        "scenario_name": "partial_failure",
        "description": "Simulates a workflow where multiple resources are optimized; one fails and triggers rollback, while the other succeeds.",
        "telemetry_data": {
            "resource_group": "remediation-rg",
            "metrics": [
                {"resource_id": "vm-fail-01", "type": "VirtualMachine", "cpu_utilization": 2.0, "memory_utilization": 10.0, "status": "running"},
                {"resource_id": "vm-success-01", "type": "VirtualMachine", "cpu_utilization": 3.0, "memory_utilization": 15.0, "status": "running"}
            ]
        }
    }
}
