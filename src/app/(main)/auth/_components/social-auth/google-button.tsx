"use client";
// F-6A (sim2 problem 5: "Continue with Google" had no action): there is no Google sign-in in this preview (no request
// leaves it), and the button says so instead of doing nothing.
import { cn } from "cn";
import { siGoogle } from "simple-icons";
import { toast } from "sonner";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";

export function GoogleButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={cn(className)}
      onClick={() =>
        toast.info("Google sign-in is not available in this preview", {
          description:
            "The preview has no accounts and sends no request to Google. Use the live demo, or the form below: neither creates an account.",
        })
      }
      {...props}
    >
      <SimpleIcon icon={siGoogle} className="size-4" />
      Continue with Google
    </Button>
  );
}
