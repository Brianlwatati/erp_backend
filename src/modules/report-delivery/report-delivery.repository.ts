import { query, queryOne } from "../../config/db.js";
import type {
  ErpReportSendLog,
  ErpReportSnapshot,
  ErpReportSnapshotData,
  ErpReportSubscription,
} from "../../types/domain.js";

export const reportDeliveryRepository = {
  // ---- subscriptions (managed by the frontend) ----

  list: (companyId: number) =>
    query<ErpReportSubscription>(
      `SELECT id, ias_company_id AS "iasCompanyId", channel, frequency,
              day_of_week AS "dayOfWeek", time_of_day AS "timeOfDay",
              recipient, enabled, created_by AS "createdBy",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM erp_report_subscriptions
       WHERE ias_company_id = $1
       ORDER BY created_at DESC`,
      [companyId],
    ),

  create: (
    companyId: number,
    createdBy: number,
    input: {
      channel: "EMAIL" | "WHATSAPP";
      frequency: "DAILY" | "WEEKLY";
      dayOfWeek?: number | null;
      timeOfDay: string;
      recipient: string;
    },
  ) =>
    queryOne<ErpReportSubscription>(
      `INSERT INTO erp_report_subscriptions
         (ias_company_id, channel, frequency, day_of_week, time_of_day, recipient, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, ias_company_id AS "iasCompanyId", channel, frequency,
                 day_of_week AS "dayOfWeek", time_of_day AS "timeOfDay",
                 recipient, enabled, created_by AS "createdBy",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        companyId,
        input.channel,
        input.frequency,
        input.dayOfWeek ?? null,
        input.timeOfDay,
        input.recipient,
        createdBy,
      ],
    ),

  update: (
    id: number,
    companyId: number,
    patch: Partial<{
      frequency: "DAILY" | "WEEKLY";
      dayOfWeek: number | null;
      timeOfDay: string;
      recipient: string;
      enabled: boolean;
    }>,
  ) =>
    queryOne<ErpReportSubscription>(
      `UPDATE erp_report_subscriptions SET
         frequency = COALESCE($3, frequency),
         day_of_week = CASE WHEN $4::boolean THEN $5::smallint ELSE day_of_week END,
         time_of_day = COALESCE($6, time_of_day),
         recipient = COALESCE($7, recipient),
         enabled = COALESCE($8, enabled),
         updated_at = NOW()
       WHERE id = $1 AND ias_company_id = $2
       RETURNING id, ias_company_id AS "iasCompanyId", channel, frequency,
                 day_of_week AS "dayOfWeek", time_of_day AS "timeOfDay",
                 recipient, enabled, created_by AS "createdBy",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        companyId,
        patch.frequency ?? null,
        "dayOfWeek" in patch,
        patch.dayOfWeek ?? null,
        patch.timeOfDay ?? null,
        patch.recipient ?? null,
        patch.enabled ?? null,
      ],
    ),

  remove: (id: number, companyId: number) =>
    query(
      `DELETE FROM erp_report_subscriptions WHERE id = $1 AND ias_company_id = $2`,
      [id, companyId],
    ),

  sendLogsForSubscription: (subscriptionId: number, companyId: number) =>
    query<ErpReportSendLog>(
      `SELECT l.id, l.subscription_id AS "subscriptionId", l.snapshot_id AS "snapshotId",
              l.status, l.error_message AS "errorMessage", l.sent_at AS "sentAt"
       FROM erp_report_send_logs l
       JOIN erp_report_subscriptions s ON s.id = l.subscription_id
       WHERE l.subscription_id = $1 AND s.ias_company_id = $2
       ORDER BY l.sent_at DESC
       LIMIT 50`,
      [subscriptionId, companyId],
    ),

  // ---- subscriptions due right now (used by the dispatch job, not exposed via API) ----

  dueNow: (
    frequency: "DAILY" | "WEEKLY",
    dayOfWeek: number,
    timeOfDay: string,
    ignoreSchedule = false,
  ) =>
    query<ErpReportSubscription>(
      `SELECT id, ias_company_id AS "iasCompanyId", channel, frequency,
              day_of_week AS "dayOfWeek", time_of_day AS "timeOfDay",
              recipient, enabled, created_by AS "createdBy",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM erp_report_subscriptions
       WHERE enabled = TRUE
         AND frequency = $1
         AND ($4::boolean OR $1 <> 'WEEKLY' OR day_of_week = $2)
         AND ($4::boolean OR time_of_day = $3)`,
      [frequency, dayOfWeek, timeOfDay, ignoreSchedule],
    ),

  // ---- snapshots (written by the snapshot job, read by dispatch) ----

  upsertSnapshot: (
    companyId: number,
    periodType: "DAILY" | "WEEKLY",
    periodStart: string,
    periodEnd: string,
    data: ErpReportSnapshotData,
  ) =>
    queryOne<ErpReportSnapshot>(
      `INSERT INTO erp_report_snapshots
         (ias_company_id, period_type, period_start, period_end, data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ias_company_id, period_type, period_start)
       DO UPDATE SET period_end = EXCLUDED.period_end, data = EXCLUDED.data,
                     generated_at = NOW()
       RETURNING id, ias_company_id AS "iasCompanyId", period_type AS "periodType",
                 period_start AS "periodStart", period_end AS "periodEnd",
                 data, generated_at AS "generatedAt"`,
      [companyId, periodType, periodStart, periodEnd, JSON.stringify(data)],
    ),

  latestSnapshot: (companyId: number, periodType: "DAILY" | "WEEKLY") =>
    queryOne<ErpReportSnapshot>(
      `SELECT id, ias_company_id AS "iasCompanyId", period_type AS "periodType",
              period_start AS "periodStart", period_end AS "periodEnd",
              data, generated_at AS "generatedAt"
       FROM erp_report_snapshots
       WHERE ias_company_id = $1 AND period_type = $2
       ORDER BY period_end DESC
       LIMIT 1`,
      [companyId, periodType],
    ),

  latestSnapshotByQuery: (companyId: number, periodType?: "DAILY" | "WEEKLY") =>
    queryOne<ErpReportSnapshot>(
      `SELECT id, ias_company_id AS "iasCompanyId", period_type AS "periodType",
              period_start AS "periodStart", period_end AS "periodEnd",
              data, generated_at AS "generatedAt"
       FROM erp_report_snapshots
       WHERE ias_company_id = $1
         AND ($2::text IS NULL OR period_type = $2)
       ORDER BY period_end DESC, generated_at DESC
       LIMIT 1`,
      [companyId, periodType ?? null],
    ),

  // Every company currently active, for the snapshot job to iterate over.
  companiesWithActiveSubscriptions: () =>
    query<{ iasCompanyId: number }>(
      `SELECT DISTINCT ias_company_id AS "iasCompanyId"
       FROM erp_report_subscriptions
       WHERE enabled = TRUE`,
    ),

  logSend: (
    subscriptionId: number,
    snapshotId: number | null,
    status: "SUCCESS" | "FAILED",
    errorMessage?: string,
  ) =>
    query(
      `INSERT INTO erp_report_send_logs (subscription_id, snapshot_id, status, error_message)
       VALUES ($1, $2, $3, $4)`,
      [subscriptionId, snapshotId, status, errorMessage ?? null],
    ),
};
