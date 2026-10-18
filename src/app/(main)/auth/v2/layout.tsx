import type { ReactNode } from "react";

import { Command } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { APP_CONFIG } from "@/config/app-config";

// F-6A (sim2 problem 17): the side panel spoke for the template ("Design. Build. Launch. Repeat.", "Clone the repo,
// install dependencies…", "open an issue on GitHub"). It now says what this product is and what this preview is.
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <div className="relative order-2 hidden h-full rounded-3xl bg-primary lg:flex">
          <div className="absolute top-10 space-y-1 px-10 text-primary-foreground">
            <Command className="size-10" />
            <h1 className="font-medium text-2xl">{APP_CONFIG.name}</h1>
            <p className="text-sm">Customer conversations, channels and your team in one place.</p>
          </div>

          <div className="absolute bottom-10 flex w-full justify-between px-10">
            <div className="flex-1 space-y-1 text-primary-foreground">
              <h2 className="font-medium">This is a preview</h2>
              <p className="text-sm">
                There are no real accounts yet. Login and registration are simulated, and the workspace holds sample
                data.
              </p>
            </div>
            <Separator orientation="vertical" className="mx-3 h-auto!" />
            <div className="flex-1 space-y-1 text-primary-foreground">
              <h2 className="font-medium">Live demo</h2>
              <p className="text-sm">
                Opens the demo account: Arham Khan, Administrator of the sample workspace Weblabs Studio.
              </p>
            </div>
          </div>
        </div>
        <div className="relative order-1 flex h-full">{children}</div>
      </div>
    </main>
  );
}
