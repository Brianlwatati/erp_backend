import {query,queryOne} from "../../config/db.js";
export const workflowRepository={
 notifications:(c:number,u:number)=>query(`SELECT * FROM erp_notifications WHERE ias_company_id=$1 AND (ias_user_id IS NULL OR ias_user_id=$2) ORDER BY created_at DESC LIMIT 100`,[c,u]),
 read:(id:number,c:number,u:number)=>queryOne(`UPDATE erp_notifications SET is_read=true WHERE id=$1 AND ias_company_id=$2 AND (ias_user_id IS NULL OR ias_user_id=$3) RETURNING *`,[id,c,u]),
 rules:(c:number)=>query(`SELECT * FROM erp_workflow_rules WHERE ias_company_id=$1 ORDER BY id DESC`,[c]),
 createRule:(c:number,u:number,x:any)=>queryOne(`INSERT INTO erp_workflow_rules(ias_company_id,name,event_type,threshold_amount,action_type,target_user_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[c,x.name,x.eventType,x.thresholdAmount??null,x.actionType||"NOTIFY",x.targetUserId??null,u]),
 notify:(c:number,u:number,x:any)=>queryOne(`INSERT INTO erp_notifications(ias_company_id,ias_user_id,type,title,message,entity_type,entity_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[c,u??null,x.type,x.title,x.message,x.entityType??null,x.entityId??null]),
 approvals:(c:number)=>query(`SELECT * FROM erp_approval_requests WHERE ias_company_id=$1 ORDER BY created_at DESC`,[c]),
 request:(c:number,u:number,x:any)=>queryOne(`INSERT INTO erp_approval_requests(ias_company_id,module,entity_type,entity_id,requested_by,assigned_to,amount) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[c,x.module,x.entityType,x.entityId,u,x.assignedTo??null,x.amount??null]),
 decide:(id:number,c:number,u:number,status:string)=>queryOne(`UPDATE erp_approval_requests SET status=$3,decided_by=$4,decided_at=now() WHERE id=$1 AND ias_company_id=$2 AND status='PENDING' RETURNING *`,[id,c,status,u])
};
