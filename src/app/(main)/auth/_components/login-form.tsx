"use client";
// حارس الدخول (2026-10-19، تثبيت app.airest.ai): الدخول صار حقيقياً. يرسل النموذج البريد وكلمة المرور إلى
// /api/studio-auth/login، فإن قبلهما وُضعت الجلسة وفُتح المسار المطلوب (next) أو لوحة التحكم، وإلا ظهر سبب الرفض.
// لا يُعرض شيء مما كُتب ولا يُحفظ في المتصفح.
import { Suspense } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  email: z.email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  remember: z.boolean().optional(),
});

// useSearchParams يحتاج حدّ Suspense حتى لا يفشل البناء في الصفحات الثابتة.
export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  async function onSubmit(data: z.infer<typeof formSchema>) {
    const res = await fetch("/api/studio-auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.email, password: data.password }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { message?: string; name?: string } | null;
    if (!res?.ok) {
      form.setValue("password", "");
      toast.error("Login failed", { description: body?.message || "The server did not answer." });
      return;
    }
    form.reset({ email: "", password: "", remember: false });
    const next = params.get("next");
    // مسار داخلي فقط: يبدأ بـ / ولا يتبعه / أو \ (وإلا صار تحويلاً إلى موقع آخر).
    router.push(next && /^\/(?![/\\])/.test(next) ? next : "/dashboard/default");
    router.refresh();
  }
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-email">Email Address</FieldLabel>
              <Input
                {...field}
                id="login-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <Input
                {...field}
                id="login-password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="remember"
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <Checkbox
                id="login-remember"
                name={field.name}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                aria-invalid={fieldState.invalid}
              />
              <FieldContent>
                <FieldLabel htmlFor="login-remember" className="font-normal">
                  Remember me for 30 days
                </FieldLabel>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldContent>
            </Field>
          )}
        />
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        Login
      </Button>
    </form>
  );
}
