import type { Metadata } from "next";

import { LocalesList } from "../_components/locales-list";

export const metadata: Metadata = {
  title: "Locales · Help Center",
};

export default function Page() {
  return <LocalesList />;
}
