import type { ErpReportSnapshot } from "../../../types/domain.js";

function formatDisplayDate(value: string | Date): string {
  const rawValue = value == null ? "" : String(value);
  if (!rawValue) return "";

  const date =
    value instanceof Date
      ? value
      : rawValue.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
        ? new Date(`${rawValue}T00:00:00Z`)
        : new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Nairobi",
    timeZoneName: "long",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const timeZoneName =
    parts.find((part) => part.type === "timeZoneName")?.value ??
    "East Africa Time";

  return `${weekday} ${month} ${day} ${year} (${timeZoneName})`;
}

export function formatReportEmail(snapshot: ErpReportSnapshot): {
  subject: string;
  html: string;
} {
  const { data, periodType, periodStart, periodEnd } = snapshot;
  const label = periodType === "DAILY" ? "Daily" : "Weekly";
  const formattedPeriodStart = formatDisplayDate(periodStart as string | Date);
  const formattedPeriodEnd = formatDisplayDate(periodEnd as string | Date);

  const money = (value: number) =>
    `KES ${value.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const stockStatus =
    data.lowStockCount > 0
      ? {
          icon: "⚠️",
          title: "Stock attention required",
          message: `${data.lowStockCount} item${
            data.lowStockCount === 1 ? "" : "s"
          } ${data.lowStockCount === 1 ? "is" : "are"} running low on stock.`,
        }
      : {
          icon: "✓",
          title: "Inventory looks good",
          message: "No products are currently flagged as low stock.",
        };

  return {
    subject: `${label} Business Report | ${formattedPeriodStart} – ${formattedPeriodEnd}`,

    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${label} Business Report</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f6f8;
  font-family:Arial,Helvetica,sans-serif;
  color:#17202a;
">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8;">
  <tr>
    <td align="center" style="padding:32px 15px;">

      <!-- Main container -->
      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="
          max-width:680px;
          background:#ffffff;
          border-radius:14px;
          overflow:hidden;
          box-shadow:0 4px 18px rgba(0,0,0,0.06);
        "
      >

        <!-- Header -->
        <tr>
          <td style="
            padding:32px 36px;
            background:#111827;
            color:#ffffff;
          ">

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="
                    font-size:14px;
                    font-weight:bold;
                    letter-spacing:1.5px;
                    color:#9ca3af;
                    margin-bottom:10px;
                  ">
                    ERPKE
                  </div>

                  <div style="
                    font-size:28px;
                    line-height:34px;
                    font-weight:bold;
                    margin-bottom:8px;
                  ">
                    ${label} Business Report
                  </div>

                  <div style="
                    font-size:14px;
                    color:#d1d5db;
                  ">
                    ${formattedPeriodStart} &nbsp;→&nbsp; ${formattedPeriodEnd}
                  </div>
                </td>

                <td align="right" valign="top">
                  <div style="
                    display:inline-block;
                    padding:7px 12px;
                    border-radius:20px;
                    background:#1f2937;
                    color:#d1d5db;
                    font-size:12px;
                    font-weight:bold;
                  ">
                    ${label.toUpperCase()}
                  </div>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:30px 36px 15px;">
            <div style="
              font-size:15px;
              color:#6b7280;
              line-height:23px;
            ">
              Here's your business performance snapshot for the selected
              reporting period.
            </div>
          </td>
        </tr>

        <!-- KPI cards -->
        <tr>
          <td style="padding:15px 36px;">

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>

                <!-- Sales -->
                <td width="50%" valign="top" style="padding:7px;">
                  <div style="
                    background:#f8fafc;
                    border:1px solid #e5e7eb;
                    border-radius:10px;
                    padding:20px;
                  ">
                    <div style="font-size:24px; margin-bottom:10px;">💰</div>

                    <div style="
                      font-size:12px;
                      color:#6b7280;
                      font-weight:bold;
                      text-transform:uppercase;
                      letter-spacing:.6px;
                    ">
                      Sales Value
                    </div>

                    <div style="
                      margin-top:7px;
                      font-size:21px;
                      font-weight:bold;
                      color:#111827;
                    ">
                      ${money(data.salesValue)}
                    </div>
                  </div>
                </td>

                <!-- Orders -->
                <td width="50%" valign="top" style="padding:7px;">
                  <div style="
                    background:#f8fafc;
                    border:1px solid #e5e7eb;
                    border-radius:10px;
                    padding:20px;
                  ">
                    <div style="font-size:24px; margin-bottom:10px;">🛒</div>

                    <div style="
                      font-size:12px;
                      color:#6b7280;
                      font-weight:bold;
                      text-transform:uppercase;
                      letter-spacing:.6px;
                    ">
                      Orders
                    </div>

                    <div style="
                      margin-top:7px;
                      font-size:21px;
                      font-weight:bold;
                      color:#111827;
                    ">
                      ${data.ordersCount.toLocaleString("en-KE")}
                    </div>
                  </div>
                </td>

              </tr>

              <tr>

                <!-- Outstanding -->
                <td width="50%" valign="top" style="padding:7px;">
                  <div style="
                    background:#fffaf0;
                    border:1px solid #f3dfb3;
                    border-radius:10px;
                    padding:20px;
                  ">
                    <div style="font-size:24px; margin-bottom:10px;">🧾</div>

                    <div style="
                      font-size:12px;
                      color:#8a6d3b;
                      font-weight:bold;
                      text-transform:uppercase;
                      letter-spacing:.6px;
                    ">
                      Outstanding Invoices
                    </div>

                    <div style="
                      margin-top:7px;
                      font-size:21px;
                      font-weight:bold;
                      color:#7c5410;
                    ">
                      ${money(data.outstandingInvoices)}
                    </div>
                  </div>
                </td>

                <!-- Stock -->
                <td width="50%" valign="top" style="padding:7px;">
                  <div style="
                    background:#f7f9ff;
                    border:1px solid #dfe6ff;
                    border-radius:10px;
                    padding:20px;
                  ">
                    <div style="font-size:24px; margin-bottom:10px;">📦</div>

                    <div style="
                      font-size:12px;
                      color:#65708a;
                      font-weight:bold;
                      text-transform:uppercase;
                      letter-spacing:.6px;
                    ">
                      Stock Value
                    </div>

                    <div style="
                      margin-top:7px;
                      font-size:21px;
                      font-weight:bold;
                      color:#25345c;
                    ">
                      ${money(data.stockValue)}
                    </div>
                  </div>
                </td>

              </tr>
            </table>

          </td>
        </tr>

        <!-- Detailed metrics -->
        <tr>
          <td style="padding:20px 36px 10px;">

            <div style="
              font-size:17px;
              font-weight:bold;
              color:#111827;
              margin-bottom:15px;
            ">
              📋 Business Overview
            </div>

            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"
            >

              <tr style="background:#f9fafb;">
                <td style="
                  padding:13px 15px;
                  font-size:12px;
                  font-weight:bold;
                  color:#6b7280;
                  text-transform:uppercase;
                ">
                  Metric
                </td>

                <td align="right" style="
                  padding:13px 15px;
                  font-size:12px;
                  font-weight:bold;
                  color:#6b7280;
                  text-transform:uppercase;
                ">
                  Value
                </td>
              </tr>

              <tr>
                <td style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                ">
                  💰 Sales Value
                </td>

                <td align="right" style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                  font-weight:bold;
                ">
                  ${money(data.salesValue)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                ">
                  🛒 Orders
                </td>

                <td align="right" style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                  font-weight:bold;
                ">
                  ${data.ordersCount.toLocaleString("en-KE")}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                ">
                  🧾 Outstanding Invoices
                </td>

                <td align="right" style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                  font-weight:bold;
                ">
                  ${money(data.outstandingInvoices)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                ">
                  📦 Inventory Value
                </td>

                <td align="right" style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                  font-weight:bold;
                ">
                  ${money(data.stockValue)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                ">
                  📉 Low Stock Items
                </td>

                <td align="right" style="
                  padding:14px 15px;
                  border-top:1px solid #e5e7eb;
                  font-size:14px;
                  font-weight:bold;
                ">
                  ${data.lowStockCount}
                </td>
              </tr>

            </table>

          </td>
        </tr>

        <!-- Status -->
        <tr>
          <td style="padding:25px 36px 30px;">

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="
                  background:#f8fafc;
                  border:1px solid #e5e7eb;
                  border-radius:10px;
                  padding:18px 20px;
                ">

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="45" valign="top">
                        <div style="
                          font-size:22px;
                          width:34px;
                          height:34px;
                          line-height:34px;
                          text-align:center;
                        ">
                          ${stockStatus.icon}
                        </div>
                      </td>

                      <td>
                        <div style="
                          font-size:14px;
                          font-weight:bold;
                          color:#111827;
                          margin-bottom:4px;
                        ">
                          ${stockStatus.title}
                        </div>

                        <div style="
                          font-size:13px;
                          color:#6b7280;
                          line-height:20px;
                        ">
                          ${stockStatus.message}
                        </div>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="
            padding:22px 36px;
            background:#f9fafb;
            border-top:1px solid #e5e7eb;
            text-align:center;
          ">

            <div style="
              font-size:13px;
              font-weight:bold;
              color:#374151;
              margin-bottom:5px;
            ">
              ERPKE
            </div>

            <div style="
              font-size:11px;
              color:#9ca3af;
              line-height:18px;
            ">
              Business management made simple.
              <br>
              This report was generated automatically by ERPKE.
            </div>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
    `.trim(),
  };
}
