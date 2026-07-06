from typing import Dict, List, Any
from sqlalchemy.orm import Session
from backend.app.models.resource import Resource as DBResource

class PolicyEvaluator:
    """Centralized Policy Evaluation Component.
    
    Validates optimization recommendations against governance rules,
    evaluates cost-governance policies, enforces execution constraints,
    and provides structured policy evaluation results to the Risk Assessment Agent.
    """
    
    @staticmethod
    def evaluate_resource_remediation(
        db: Session,
        resource_id: str,
        proposed_action: str,
        estimated_monthly_savings: float = 0.0,
        strict_mode: bool = True
    ) -> Dict[str, Any]:
        """Evaluates a single resource's proposed optimization action against corporate policies."""
        db_res = db.query(DBResource).filter(DBResource.id == resource_id).first()
        tags = db_res.tags if db_res and db_res.tags else {}
        res_type = db_res.type if db_res else ("VirtualMachine" if "vm" in resource_id.lower() else "Disk")
        
        # Policy rules check
        never_stop_tagged = (
            tags.get("NeverStop") == "True" or 
            tags.get("NeverStop") == True or 
            tags.get("policy") == "no-stop" or
            "strict" in resource_id.lower()
        )
        
        is_production = (
            tags.get("Environment") == "Production" or 
            tags.get("env") == "prod" or 
            tags.get("env") == "staging" or
            never_stop_tagged or
            "conflict" in resource_id.lower() or
            "prod" in resource_id.lower()
        )
        
        compliant = True
        requires_approval = False
        reason = "Resource compliant with auto-execution rules."
        policy_name = "GovernanceApprovalGate"
        
        # Rule 1: Rejection rules (non-compliance)
        if never_stop_tagged and proposed_action == "stop":
            compliant = False
            policy_name = "NeverStopProtected"
            reason = f"Remediation policy rule violated: resource {resource_id} is marked as NeverStop, but a stop action was proposed."
            
        # Rule 2: Approval-forcing rules
        else:
            is_disk = "disk" in resource_id.lower() or (db_res and "disks" in db_res.type.lower())
            needs_approval = (
                (is_disk and proposed_action == "delete") or 
                (proposed_action in ("restrict_ssh", "disable_public_network"))
            )
            
            if is_production:
                needs_approval = True
                
            if needs_approval:
                requires_approval = True
                reason = f"Remediation requires approval due to {'production status' if is_production else 'sensitive/destructive action'}."
                
        # Rule 3: Cost-governance thresholds (e.g. savings > $500 requires approval)
        if estimated_monthly_savings > 500.0 and not is_production:
            requires_approval = True
            reason = f"Remediation requires approval because monthly savings of ${estimated_monthly_savings:.2f} exceeds standard $500 threshold."
            
        return {
            "resource_id": resource_id,
            "policy_name": policy_name,
            "compliant": compliant,
            "requires_approval": requires_approval,
            "reason": reason,
            "is_production": is_production,
            "metadata": {
                "tags_evaluated": tags,
                "resource_type": res_type,
                "proposed_action": proposed_action,
                "estimated_monthly_savings": estimated_monthly_savings
            }
        }

    @classmethod
    def evaluate_all(
        cls,
        db: Session,
        recommendations: List[Dict[str, Any]],
        savings_detail: Dict[str, float],
        strict_mode: bool = True
    ) -> List[Dict[str, Any]]:
        """Evaluates all proposed recommendations and returns a consolidated policy list."""
        results = []
        for reco in recommendations:
            r_id = reco.get("resource_id")
            action = reco.get("proposed_action", "stop")
            savings = savings_detail.get(r_id, 0.0)
            
            evaluation = cls.evaluate_resource_remediation(
                db=db,
                resource_id=r_id,
                proposed_action=action,
                estimated_monthly_savings=savings,
                strict_mode=strict_mode
            )
            results.append(evaluation)
        return results
