// يضيف حساب دخول محلياً إلى .studio-data/حسابات-الدخول.json (حارس الدخول، 2026-10-19)، أو يغيّر كلمة مروره إن وُجد.
// كلمة المرور تُقرأ من الإدخال القياسي فلا تظهر في سجل الأوامر، وتُحفظ مشفّرة بـ scrypt بالصيغة التي يقرؤها
// src/lib/جلسة-الدخول.ts. التشغيل من مجلد التطبيق:
//   printf '%s' "$PASS" | node src/scripts/أضف-حساب-دخول.mjs <البريد> <الاسم>
import { randomBytes, scryptSync } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [email, name] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error("الاستعمال: printf '%s' \"$PASS\" | node src/scripts/أضف-حساب-دخول.mjs <البريد> <الاسم>");
  process.exit(1);
}
const password = readFileSync(0, "utf8");
if (password.length < 12) {
  console.error("كلمة المرور أقصر من 12 حرفاً");
  process.exit(1);
}
const file = path.join(process.cwd(), ".studio-data", "حسابات-الدخول.json");
const accounts = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const rest = accounts.filter((a) => a.email.toLowerCase() !== email.toLowerCase());
rest.push({ email, name: name || email, salt, hash, created: new Date().toISOString() });
writeFileSync(file, `${JSON.stringify(rest, null, 2)}\n`, { mode: 0o600 });
chmodSync(file, 0o600);
console.log(`حُفظ الحساب ${email} (${rest.length} حساب في الملف)`);
