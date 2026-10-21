"use client";
import { useEffect, useState } from "react";

// F-6A (sim2 problem 5, task item 5): Register no longer shows the typed values (the password among them) in a toast.
// The preview has no accounts: the form is checked, nothing typed is kept or sent, the message says plainly that no
// account was created, and the demo workspace opens (lib/preview-signin).
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { enterPreview } from "@/lib/preview-signin/client";
import { DEMO_ACCOUNT, NO_REAL_ACCOUNT, PREVIEW_LANDING_PATH } from "@/lib/preview-signin/shared";

const formSchema = z
  .object({
    email: z.email({ message: "Please enter a valid email address." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
    confirmPassword: z.string().min(6, { message: "Confirm Password must be at least 6 characters." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function RegisterForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // Nothing from `data` is shown, stored or sent: no account is created in this preview.
  function onSubmit(_data: z.infer<typeof formSchema>) {
    enterPreview("register");
    form.reset({ email: "", password: "", confirmPassword: "" });
    toast.success(NO_REAL_ACCOUNT, {
      description: `Nothing was saved: the email and password were not sent or kept. You are entering the demo workspace as ${DEMO_ACCOUNT.name} (${DEMO_ACCOUNT.role}).`,
    });
    router.push(`${PREVIEW_LANDING_PATH}?first=1`);
  }
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
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
                <FieldLabel htmlFor="register-email">Email Address</FieldLabel>
                <Input
                  {...field}
                  id="register-email"
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
                <FieldLabel htmlFor="register-password">Password</FieldLabel>
                <Input
                  {...field}
                  id="register-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="register-confirm-password">Confirm Password</FieldLabel>
                <Input
                  {...field}
                  id="register-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
        <Button className="w-full" type="submit">
          Continue in preview (no account is created)
        </Button>
      </fieldset>
    </form>
  );
}
