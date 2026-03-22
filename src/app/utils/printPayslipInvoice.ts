import type { EmployeePayslipData } from "../api/types";
import { openBlobInNewTab } from "./openInNewTab";

const money = (value: number) => `$${Math.round(value).toLocaleString()}`;

export const printPayslipInvoice = (data: EmployeePayslipData | null | undefined) => {
  if (!data) {
    return;
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Payslip - ${data.employee.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          .actions { margin-bottom: 18px; display: flex; gap: 10px; }
          .actions button { border: 1px solid #d1d5db; background: #fff; color: #111827; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
          .actions button:hover { background: #f3f4f6; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: 700; }
          .muted { color: #6b7280; font-size: 13px; }
          .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-top: 12px; }
          .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
          .total { border-top: 1px solid #e5e7eb; margin-top: 12px; padding-top: 12px; font-weight: 700; font-size: 16px; }
          .positive { color: #059669; }
          .negative { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="actions">
          <button onclick="window.print()">Print / Save as PDF</button>
        </div>

        <div class="header">
          <div>
            <div class="title">Payslip Invoice</div>
            <div class="muted">Month: ${data.payslip.month ?? "-"}</div>
          </div>
          <div class="muted">Status: ${data.payslip.status}</div>
        </div>

        <div class="card">
          <div class="row"><span>Employee</span><span>${data.employee.name}</span></div>
          <div class="row"><span>Employee ID</span><span>${data.employee.employee_id}</span></div>
          <div class="row"><span>Department</span><span>${data.employee.department}</span></div>
          <div class="row"><span>Job Title</span><span>${data.employee.job_title}</span></div>
        </div>

        <div class="card">
          <div class="row"><span>Base Salary</span><span>${money(data.payslip.base_salary)}</span></div>
          <div class="row"><span>Allowances</span><span class="positive">+${money(data.payslip.allowances)}</span></div>
          <div class="row"><span>Deductions</span><span class="negative">-${money(data.payslip.deductions)}</span></div>
          <div class="row total"><span>Net Salary</span><span>${money(data.payslip.net_salary)}</span></div>
        </div>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  openBlobInNewTab(blob);
};
