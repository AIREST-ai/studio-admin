import { NextResponse } from "next/server";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const PSQL_BIN = "/usr/bin/psql";
const HINDSIGHT_BASE = process.env.HINDSIGHT_URL || "http://127.0.0.1:8888";

function sqlEscape(val: unknown): string {
  return String(val ?? "").replace(/'/g, "''");
}

async function runPsqlJson(sql: string): Promise<any> {
  const { stdout } = await execFileAsync(
    PSQL_BIN,
    ["-h", "127.0.0.1", "-p", "54329", "-U", "paperclip", "-d", "paperclip", "-t", "-A", "-c", sql],
    { env: { ...process.env, PGPASSWORD: "paperclip" }, timeout: 10000 },
  );
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("{") || l.startsWith("["));
  const raw = lines[lines.length - 1] || "{}";
  return JSON.parse(raw);
}

async function retainHindsight(companyId: string, content: string, context: string) {
  try {
    await fetch(`${HINDSIGHT_BASE}/v1/default/banks/${encodeURIComponent(companyId)}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ content, context, timestamp: new Date().toISOString() }],
      }),
    });
  } catch {
    // non-blocking memory sync
  }
}

async function fetchSnapshot(companyId: string) {
  const cid = sqlEscape(companyId || "tenant_demo_cars");
  const query = `
    SELECT regexp_replace(json_build_object(
      'tasks', COALESCE((SELECT json_agg(t) FROM (SELECT id, company_id AS "companyId", title, assignee, status, priority, due_date AS "dueDate" FROM studio_workspace_tasks WHERE company_id = '${cid}' ORDER BY created_at DESC) t), '[]'::json),
      'events', COALESCE((SELECT json_agg(e) FROM (SELECT id, company_id AS "companyId", title, event_date AS "eventDate", event_time AS "eventTime", participant, kind FROM studio_workspace_events WHERE company_id = '${cid}' ORDER BY event_date ASC, created_at DESC) e), '[]'::json),
      'contacts', COALESCE((SELECT json_agg(c) FROM (SELECT id, company_id AS "companyId", name, phone, channel, segment, last_note AS "lastNote" FROM studio_workspace_contacts WHERE company_id = '${cid}' ORDER BY created_at DESC) c), '[]'::json),
      'invoices', COALESCE((SELECT json_agg(i) FROM (SELECT id, company_id AS "companyId", invoice_number AS "invoiceNumber", customer_name AS "customerName", amount_sar::float AS "amountSar", status, issued_date AS "issuedDate" FROM studio_workspace_invoices WHERE company_id = '${cid}' ORDER BY created_at DESC) i), '[]'::json),
      'roles', COALESCE((SELECT json_agg(r) FROM (SELECT role_id AS "roleId", title, subtitle, view_conversations AS "viewConversations", edit_emma AS "editEmma", view_reports AS "viewReports", top_up_balance AS "topUpBalance", manage_invoices AS "manageInvoices" FROM studio_role_matrix WHERE company_id = '${cid}' ORDER BY CASE role_id WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 WHEN 'supervisor' THEN 3 WHEN 'agent' THEN 4 WHEN 'accountant' THEN 5 ELSE 6 END) r), '[]'::json),
      'automationRules', COALESCE((SELECT json_agg(a) FROM (SELECT id, company_id AS "companyId", name, trigger_label AS "triggerLabel", action_label AS "actionLabel", channel, active, executions_count AS "executionsCount" FROM studio_automation_rules WHERE company_id = '${cid}' ORDER BY updated_at DESC) a), '[]'::json)
    )::text, E'[\n\r]+', ' ', 'g');
  `;
  return runPsqlJson(query);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") || "tenant_demo_cars";
    const data = await fetchSnapshot(companyId);
    return NextResponse.json({
      ok: true,
      companyId,
      database: "postgresql://127.0.0.1:54329/paperclip",
      ...data,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const companyId = String(body.companyId || "tenant_demo_cars");
    const cid = sqlEscape(companyId);
    const action = String(body.action || "");

    if (action === "task.create") {
      const id = `tsk-${Date.now()}`;
      const title = sqlEscape(body.title || "مهمة متابعة جديدة");
      const assignee = sqlEscape(body.assignee || "إيمه (الموظف الذكي)");
      const priority = sqlEscape(body.priority || "high");
      const dueDate = sqlEscape(body.dueDate || new Date().toISOString().slice(0, 10));
      await runPsqlJson(
        `INSERT INTO studio_workspace_tasks (id, company_id, title, assignee, status, priority, due_date) VALUES ('${id}', '${cid}', '${title}', '${assignee}', 'todo', '${priority}', '${dueDate}'); SELECT '{"saved":true}';`,
      );
      await retainHindsight(
        companyId,
        `إضافة مهمة جديدة في مركز الأعمال: ${body.title} (${body.assignee})`,
        "workspace-tasks",
      );
    } else if (action === "task.toggle") {
      const id = sqlEscape(body.id);
      await runPsqlJson(
        `UPDATE studio_workspace_tasks SET status = CASE WHEN status = 'done' THEN 'in_progress' ELSE 'done' END WHERE id = '${id}'; SELECT '{"saved":true}';`,
      );
    } else if (action === "event.create") {
      const id = `evt-${Date.now()}`;
      const title = sqlEscape(body.title || "موعد متابعة عميل");
      const eventDate = sqlEscape(body.eventDate || new Date().toISOString().slice(0, 10));
      const eventTime = sqlEscape(body.eventTime || "04:00 م");
      const participant = sqlEscape(body.participant || "عميل المعرض");
      const kind = sqlEscape(body.kind || "meeting");
      await runPsqlJson(
        `INSERT INTO studio_workspace_events (id, company_id, title, event_date, event_time, participant, kind) VALUES ('${id}', '${cid}', '${title}', '${eventDate}', '${eventTime}', '${participant}', '${kind}'); SELECT '{"saved":true}';`,
      );
      await retainHindsight(
        companyId,
        `جدولة موعد في التقويم الموحد: ${body.title} مع ${body.participant}`,
        "workspace-calendar",
      );
    } else if (action === "contact.create") {
      const id = `cnt-${Date.now()}`;
      const name = sqlEscape(body.name || "عميل جديد");
      const phone = sqlEscape(body.phone || "+966 50 000 0000");
      const channel = sqlEscape(body.channel || "واتساب");
      const segment = sqlEscape(body.segment || "عميل نشط");
      const lastNote = sqlEscape(body.lastNote || "أضيف من مركز الأعمال الموحد");
      await runPsqlJson(
        `INSERT INTO studio_workspace_contacts (id, company_id, name, phone, channel, segment, last_note) VALUES ('${id}', '${cid}', '${name}', '${phone}', '${channel}', '${segment}', '${lastNote}'); SELECT '{"saved":true}';`,
      );
      await retainHindsight(companyId, `إضافة جهة اتصال جديدة: ${body.name} (${body.phone})`, "workspace-contacts");
    } else if (action === "invoice.create") {
      const id = `inv-${Date.now()}`;
      const invoiceNumber = sqlEscape(body.invoiceNumber || `INV-2026-${Math.floor(111 + Math.random() * 800)}`);
      const customerName = sqlEscape(body.customerName || "عميل المعرض");
      const amountSar = Number(body.amountSar) || 1500;
      const status = sqlEscape(body.status || "pending");
      const issuedDate = sqlEscape(body.issuedDate || new Date().toISOString().slice(0, 10));
      await runPsqlJson(
        `INSERT INTO studio_workspace_invoices (id, company_id, invoice_number, customer_name, amount_sar, status, issued_date) VALUES ('${id}', '${cid}', '${invoiceNumber}', '${customerName}', ${amountSar}, '${status}', '${issuedDate}'); SELECT '{"saved":true}';`,
      );
      await retainHindsight(
        companyId,
        `إصدار فاتورة جديدة رقم ${invoiceNumber} للعميل ${body.customerName} بمبلغ ${amountSar} ر.س`,
        "workspace-invoices",
      );
    } else if (action === "invoice.toggle") {
      const id = sqlEscape(body.id);
      await runPsqlJson(
        `UPDATE studio_workspace_invoices SET status = CASE WHEN status = 'paid' THEN 'pending' ELSE 'paid' END WHERE id = '${id}'; SELECT '{"saved":true}';`,
      );
    } else if (action === "role.toggle") {
      const roleId = sqlEscape(body.roleId);
      const colMap: Record<string, string> = {
        viewConversations: "view_conversations",
        editEmma: "edit_emma",
        viewReports: "view_reports",
        topUpBalance: "top_up_balance",
        manageInvoices: "manage_invoices",
      };
      const col = colMap[String(body.field)] || "view_conversations";
      if (roleId !== "owner") {
        await runPsqlJson(
          `UPDATE studio_role_matrix SET ${col} = NOT ${col}, updated_at = NOW() WHERE company_id = '${cid}' AND role_id = '${roleId}'; SELECT '{"saved":true}';`,
        );
        await retainHindsight(
          companyId,
          `تحديث صلاحية (${col}) للدور (${roleId}) في مصفوفة الصلاحيات العالمية`,
          "roles-permissions",
        );
      }
    } else if (action === "automation.toggle") {
      const id = sqlEscape(body.id);
      await runPsqlJson(
        `UPDATE studio_automation_rules SET active = NOT active, updated_at = NOW() WHERE id = '${id}'; SELECT '{"saved":true}';`,
      );
      await retainHindsight(companyId, `تبديل حالة قاعدة الأتمتة (${id}) في لوحة الأتمتة الفخمة`, "automation-studio");
    } else if (action === "automation.create") {
      const id = `auto-${Date.now()}`;
      const name = sqlEscape(body.name || "قاعدة أتمتة ذكية جديدة");
      const triggerLabel = sqlEscape(body.triggerLabel || "عند وصول رسالة عميل جديدة");
      const actionLabel = sqlEscape(body.actionLabel || "تحليل النبرة وتنفيذ الرد أو التصعيد تلقائياً");
      const channel = sqlEscape(body.channel || "جميع القنوات");
      await runPsqlJson(
        `INSERT INTO studio_automation_rules (id, company_id, name, trigger_label, action_label, channel, active, executions_count) VALUES ('${id}', '${cid}', '${name}', '${triggerLabel}', '${actionLabel}', '${channel}', TRUE, 1); SELECT '{"saved":true}';`,
      );
      await retainHindsight(companyId, `إنشاء قاعدة أتمتة جديدة: ${body.name}`, "automation-studio");
    }

    const data = await fetchSnapshot(companyId);
    return NextResponse.json({
      ok: true,
      action,
      companyId,
      database: "postgresql://127.0.0.1:54329/paperclip",
      ...data,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
