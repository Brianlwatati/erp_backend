import { query, queryOne, withTransaction } from "../../config/db.js";
import { Employee } from "./hr.types.js";

function toTimestamp(date: string, time?: string | null) {
  if (!time) return null;

  return `${date}T${time}:00+03:00`;
}

export const hrRepository = {
  departments: (c: number) =>
    query(
      `SELECT * FROM erp_departments WHERE ias_company_id=$1 ORDER BY name`,
      [c],
    ),

  createDepartment: (c: number, x: any) =>
    queryOne(
      `INSERT INTO erp_departments(ias_company_id,name,code,description) VALUES($1,$2,$3,$4) RETURNING *`,
      [c, x.name, x.code, x.description ?? null],
    ),

  jobTitles: (c: number) =>
    query(
      `SELECT * FROM erp_job_titles WHERE ias_company_id=$1 ORDER BY name`,
      [c],
    ),

  createJobTitle: (c: number, x: any) =>
    queryOne(
      `INSERT INTO erp_job_titles(ias_company_id,name,code,description) VALUES($1,$2,$3,$4) RETURNING *`,
      [c, x.name, x.code, x.description ?? null],
    ),

  employees: (c: number) =>
    query(
      `SELECT * FROM erp_employees WHERE ias_company_id=$1 ORDER BY last_name,first_name`,
      [c],
    ),
  employee: (id: number, c: number) =>
    queryOne(`SELECT * FROM erp_employees WHERE id=$1 AND ias_company_id=$2`, [
      id,
      c,
    ]),
  createEmployee: (c: number, x: Employee) =>
    queryOne(
      `INSERT INTO erp_employees
      (ias_company_id,employee_number, first_name,last_name,email,phone,
      department_id,department_name,job_title_id,job_title_name,hire_date,salary)
       VALUES($1,$2,$3,$4,$5,$6,$7,(SELECT name FROM erp_departments WHERE id=$7 AND ias_company_id=$1),$8,(SELECT name FROM erp_job_titles WHERE id=$8 AND ias_company_id=$1),$9,$10)
       RETURNING *`,
      [
        c,
        x.employeeNumber,
        x.firstName,
        x.lastName,
        x.email ?? null,
        x.phone ?? null,
        x.departmentId ?? null,
        x.jobTitleId ?? null,
        x.hireDate ?? null,
        x.salary ?? 0,
      ],
    ),
  attendance: (c: number, id?: number) =>
    query(
      `SELECT a.*,e.employee_number AS "employeeNumber",e.first_name AS "firstName",e.last_name AS "lastName" FROM erp_attendance a JOIN erp_employees e ON e.id=a.employee_id WHERE a.ias_company_id=$1 AND ($2::bigint IS NULL OR a.employee_id=$2) ORDER BY attendance_date DESC`,
      [c, id ?? null],
    ),
  clock: (c: number, id: number, x: any) => {
    const date = x.date || new Date().toISOString().slice(0, 10);

    const clockIn = toTimestamp(date, x.clockIn);
    const clockOut = toTimestamp(date, x.clockOut);

    return queryOne(
      `INSERT INTO erp_attendance(
      ias_company_id,
      employee_id,
      attendance_date,
      clock_in,
      clock_out,
      notes
    )
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(ias_company_id,employee_id,attendance_date)
    DO UPDATE SET
      clock_in = COALESCE(EXCLUDED.clock_in, erp_attendance.clock_in),
      clock_out = COALESCE(EXCLUDED.clock_out, erp_attendance.clock_out),
      notes = COALESCE(EXCLUDED.notes, erp_attendance.notes)
    RETURNING *`,
      [c, id, date, clockIn, clockOut, x.notes ?? null],
    );
  },
  leave: (c: number) =>
    query(
      `SELECT l.*,e.employee_number AS "employeeNumber",e.first_name AS "firstName",e.last_name AS "lastName" FROM erp_leave_requests l JOIN erp_employees e ON e.id=l.employee_id WHERE l.ias_company_id=$1 ORDER BY l.created_at DESC`,
      [c],
    ),
  requestLeave: (c: number, id: number, x: any) =>
    queryOne(
      `INSERT INTO erp_leave_requests(ias_company_id,employee_id,leave_type,starts_on,ends_on,reason) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [c, id, x.leaveType, x.startsOn, x.endsOn, x.reason ?? null],
    ),
  approveLeave: (id: number, c: number, u: number) =>
    queryOne(
      `UPDATE erp_leave_requests SET status='APPROVED',approved_by=$3 WHERE id=$1 AND ias_company_id=$2 AND status='PENDING' RETURNING *`,
      [id, c, u],
    ),
  payroll: async (c: number, u: number, x: any) =>
    withTransaction(async (client) => {
      const emps = await client.query(
        `SELECT id,salary FROM erp_employees WHERE ias_company_id=$1 AND status='ACTIVE'`,
        [c],
      );
      const run = (
        await client.query(
          `INSERT INTO erp_payroll_runs(ias_company_id,period_start,period_end,status,created_by) VALUES($1,$2,$3,'DRAFT',$4) RETURNING *`,
          [c, x.periodStart, x.periodEnd, u],
        )
      ).rows[0];
      let gross = 0,
        ded = 0;
      for (const e of emps.rows) {
        const g = Number(e.salary),
          d = (g * (x.deductionRate || 0)) / 100;
        gross += g;
        ded += d;
        await client.query(
          `INSERT INTO erp_payroll_items(payroll_run_id,employee_id,gross,deductions,net) VALUES($1,$2,$3,$4,$5)`,
          [run.id, e.id, g, d, g - d],
        );
      }
      return (
        await client.query(
          `UPDATE erp_payroll_runs SET total_gross=$2,total_deductions=$3,total_net=$4,status='CALCULATED' WHERE id=$1 RETURNING *`,
          [run.id, gross, ded, gross - ded],
        )
      ).rows[0];
    }),
};
