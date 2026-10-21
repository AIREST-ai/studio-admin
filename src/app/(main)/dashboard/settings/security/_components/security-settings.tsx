"use client";
import * as React from "react";

import Link from "next/link";

import { ChevronDown, Copy, Info, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { copyText } from "../../_components/copy-text";
import { loadSettingsPreview, SAVED_IN_PREVIEW, saveSaml } from "../../_components/settings-preview-client";
import { PageHeader } from "../../labels/_shared/settings-shell";

const spInfo = [
  {
    label: "رابط استقبال المصادقة (ACS URL)",
    value: "https://app.airest.ai/omniauth/saml/callback?account_id=1",
    tooltip: "انسخ هذا الرابط وضعه في مزود الهوية (IdP) كوجهة لاستقبال استجابات الدخول الموحد SAML",
  },
  {
    label: "معرّف كيان الخدمة (SP Entity ID)",
    value: "https://app.airest.ai/saml/sp/1",
    tooltip: "المعرّف الفريد لمنصة الشركة كمزود خدمة — ضعه في إعدادات مزود الهوية الخاص بك",
  },
  {
    label: "بصمة الشهادة (Fingerprint)",
    value: "4F:2A:91:C7:0B:6E:D3:58:AA:12:7C:E4:39:B0:65:1D:F8:C2:9E:07",
    tooltip: "بصمة SHA-1 للشهادة للتحقق من صحتها في إعدادات مزود الهوية",
  },
];

function copy(value: string) {
  void copyText(value, "تم النسخ إلى الحافظة");
}

export function SecuritySettings({ paywall = false }: { paywall?: boolean }) {
  const [enabled, setEnabled] = React.useState(true);
  const [ssoUrl, setSsoUrl] = React.useState("https://login.microsoftonline.com/9c1f-airest/saml2");
  const [idpEntityId, setIdpEntityId] = React.useState("https://sts.windows.net/9c1f-airest/");
  const [certificate, setCertificate] = React.useState(
    "-----BEGIN CERTIFICATE-----\nMIIC8DCCAdigAwIBAgIQGq0xV2l4mUeTj7n0bE1d3TANBgkqhkiG9w0BAQsFADA0\n-----END CERTIFICATE-----",
  );
  const [errors, setErrors] = React.useState<{ ssoUrl?: string; idp?: string; cert?: string }>({});
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    loadSettingsPreview()
      .then(({ saml }) => {
        if (!alive || !saml) return;
        if (typeof saml.enabled === "boolean") setEnabled(saml.enabled);
        if (saml.ssoUrl !== undefined) setSsoUrl(saml.ssoUrl.replace(/weblabs\.studio|weblabs/gi, "airest"));
        if (saml.idpEntityId !== undefined) setIdpEntityId(saml.idpEntityId.replace(/weblabs\.studio|weblabs/gi, "airest"));
        if (saml.certificate !== undefined) setCertificate(saml.certificate);
      })
      .catch((error) => toast.error("تعذر قراءة إعدادات الأمان المحفوظة", { description: (error as Error).message }))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    try {
      const parsed = new URL(ssoUrl.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad");
    } catch {
      next.ssoUrl = "يرجى إدخال رابط دخول موحد (SSO URL) صحيح";
    }
    if (!idpEntityId.trim()) next.idp = "معرّف مزود الهوية مطلوب";
    if (!certificate.trim()) next.cert = "شهادة التوقيع مطلوبة";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("يرجى استكمال الحقول المطلوبة للدخول الموحد");
      return;
    }
    setBusy(true);
    try {
      await saveSaml({ ssoUrl: ssoUrl.trim(), idpEntityId: idpEntityId.trim(), certificate: certificate.trim() });
      toast.success("تم حفظ إعدادات الدخول الموحد (SAML SSO) في الخادم", { description: SAVED_IN_PREVIEW });
    } catch (error) {
      toast.error("تعذر حفظ إعدادات الدخول الموحد", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(checked: boolean) {
    setEnabled(checked);
    setBusy(true);
    try {
      await saveSaml({ enabled: checked });
      toast.success(checked ? "تم تفعيل الدخول الموحد (SAML SSO)" : "تم إيقاف الدخول الموحد (SAML SSO)", {
        description: SAVED_IN_PREVIEW,
      });
    } catch (error) {
      setEnabled(!checked);
      toast.error("تعذر تحديث حالة الدخول الموحد", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الأمان والدخول الموحد"
        description="إدارة سياسات حماية الحساب والدخول الموحد للمؤسسة (SAML SSO)."
        learnMore="دليل إعداد الدخول الموحد SAML SSO"
      />

      {paywall ? (
        <Card className="items-center py-10 text-center">
          <CardHeader className="w-full max-w-lg justify-items-center">
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-5" />
            </div>
            <CardTitle>ترقية الباقة لتفعيل الدخول الموحد</CardTitle>
            <CardDescription>
              ميزة الدخول الموحد متاحة في باقات الأعمال المتقدمة لتأمين دخول الموظفين عبر مزود الهوية الموحد.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid justify-items-center gap-2">
            <Button asChild>
              <Link href="/dashboard/settings/billing">ترقية الباقة الآن</Link>
            </Button>
            <span className="text-muted-foreground text-xs">يمكنك تعديل الباقة في أي وقت</span>
          </CardContent>
        </Card>
      ) : null}

      {paywall ? null : (
        <Card>
          <CardHeader>
            <CardTitle>الدخول الموحد للمؤسسات (SAML SSO)</CardTitle>
            <CardDescription className="max-w-2xl">
              اضبط تسجيل الدخول الموحد لحساب شركتك بحيث يصادق الموظفون عبر مزود الهوية المعتمد لديك بدلاً من كلمات المرور المنفصلة.
            </CardDescription>
            <CardAction>
              <Switch
                checked={enabled}
                disabled={busy || !loaded}
                onCheckedChange={(checked) => void toggle(checked)}
                aria-label="تفعيل الدخول الموحد SAML SSO"
              />
            </CardAction>
          </CardHeader>
          {!enabled ? (
            <CardContent>
              <p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-sm">
                الدخول الموحد متوقف حالياً. يمكنك تفعيله من المفتاح أعلاه لضبط ربط مزود الهوية.
              </p>
            </CardContent>
          ) : null}
          {enabled && (
            <CardContent className="grid gap-6">
              <div className="rounded-xl border bg-muted/30">
                <div className="flex items-center gap-1.5 px-4 py-3 font-medium text-sm">
                  <span>معلومات مزود الخدمة (Service Provider)</span>
                  <Tooltip>
                    <TooltipTrigger type="button" className="inline-flex items-center">
                      <Info className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      انسخ هذه القيم وضعها في مزود الهوية الخاص بك لإتمام الربط الآمن
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Separator />
                <div className="grid gap-3 p-4">
                  {spInfo.map((item) => (
                    <div key={item.label} className="grid gap-1.5 md:grid-cols-[220px_1fr] md:items-center">
                      <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                        <span>{item.label}</span>
                        <Tooltip>
                          <TooltipTrigger type="button" className="inline-flex items-center">
                            <Info className="size-3" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{item.tooltip}</TooltipContent>
                        </Tooltip>
                      </span>
                      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5">
                        <code className="flex-1 truncate text-xs" dir="ltr">{item.value}</code>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`نسخ ${item.label}`}
                          onClick={() => copy(item.value)}
                        >
                          <Copy />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Collapsible className="rounded-xl border">
                <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 font-medium text-sm hover:bg-muted/40">
                  <span>إعداد سمات المستخدمين (SAML Attributes)</span>
                  <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-3 text-sm">
                  <p className="mb-2 text-muted-foreground">
                    يجب ربط السمات التالية في مزود الهوية الخاص بك لتمرير بيانات الموظف تلقائياً:
                  </p>
                  <ul className="space-y-1">
                    {["email", "first_name", "last_name"].map((a) => (
                      <li key={a}>
                        <code className="rounded bg-muted px-1 text-xs" dir="ltr">{a}</code>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>

              <form className="grid max-w-2xl gap-5" onSubmit={submit} noValidate>
                <div className="grid gap-1">
                  <h3 className="font-medium text-sm">بيانات مزود الهوية (Identity Provider)</h3>
                  <p className="text-muted-foreground text-xs">
                    أدخل رابط الدخول الموحد ومعرّف المزود وشهادة التوقيع الرقمية الخاصة بمؤسستك.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="saml-sso-url">رابط الدخول الموحد (SSO URL)</Label>
                  <Input
                    id="saml-sso-url"
                    dir="ltr"
                    placeholder="https://sso.example.com/saml/sso"
                    value={ssoUrl}
                    aria-invalid={Boolean(errors.ssoUrl)}
                    onChange={(e) => setSsoUrl(e.target.value)}
                  />
                  <p className={errors.ssoUrl ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                    {errors.ssoUrl ?? "الرابط الذي تُرسل إليه طلبات المصادقة في مزود الهوية"}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="saml-idp">معرّف كيان مزود الهوية (IdP Entity ID)</Label>
                  <Input
                    id="saml-idp"
                    dir="ltr"
                    placeholder="https://sso.example.com/saml"
                    value={idpEntityId}
                    aria-invalid={Boolean(errors.idp)}
                    onChange={(e) => setIdpEntityId(e.target.value)}
                  />
                  <p className={errors.idp ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                    {errors.idp ?? "المعرّف الفريد لمزود الهوية في إعدادات مؤسستك"}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="saml-cert">شهادة التوقيع بصيغة PEM</Label>
                  <Textarea
                    id="saml-cert"
                    dir="ltr"
                    className="min-h-28 font-mono text-xs"
                    placeholder={"-----BEGIN CERTIFICATE-----\nMIIC..."}
                    value={certificate}
                    aria-invalid={Boolean(errors.cert)}
                    onChange={(e) => setCertificate(e.target.value)}
                  />
                  <p className={errors.cert ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                    {errors.cert ?? "الشهادة العامة المعتمدة من مزود الهوية للتحقق من التوقيع الرقمي"}
                  </p>
                </div>
                <Button type="submit" className="w-fit" disabled={busy || !loaded}>
                  حفظ إعدادات الدخول الموحد
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
