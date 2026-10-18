import type { ReactNode } from "react";

import { HeightPreview } from "./_components/height-preview";

// T-229: the private 32px button sample (Fahad 77.8). Not linked from the sidebar; opened by its address only.
export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <HeightPreview>{children}</HeightPreview>;
}
