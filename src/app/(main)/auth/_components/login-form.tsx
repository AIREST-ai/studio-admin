"use client";
import { useEffect, useState } from "react";

// F-6A (sim2 problem 5, task item 5): Login no longer shows the typed values (the password among them) in a toast.
// The preview has no accounts, so it is an honest simulation: the form is checked, nothing typed is kept or sent,
// the message says no account was checked, and the demo workspace opens (lib/preview-signin).
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { enterPreview } from "@/lib/preview-signin/client";
import { DEMO_ACCOUNT, PREVIEW_LANDING_PATH } from "@/lib/preview-signin/shared";

const formSchema = z.object({
  email: z.email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  remember: z.boolean().optional(),
});

export function LoginForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // Nothing from `data` is shown, stored or sent: there is no account to check it against.
  function onSubmit(_data: z.infer<typeof formSchema>) {
    enterPreview("login", _data.remember === true);
    form.reset({ email: "", password: "", remember: false });
    toast.success("Logged in to the preview", {
      description: `Preview — no account was checked: this preview has no accounts, and the email and password were not kept. You are using the demo workspace as ${DEMO_ACCOUNT.name} (${DEMO_ACCOUNT.role}).`,
    });
    router.push(PREVIEW_LANDING_PATH);
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
    <form noValidate method="post" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <fieldset disabled={!ready} className="flex flex-col gap-4" aria-busy={!ready}>
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
                    Remember this preview entry for 30 days (otherwise one day)
                  </FieldLabel>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </FieldContent>
              </Field>
            )}
          />
        </FieldGroup>
        <Button className="w-full" type="submit">
          Login
        </Button>
      </fieldset>
    </form>
  );
}
