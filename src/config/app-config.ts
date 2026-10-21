import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

// F-6A (task item 6): the browser tab shows the product's name, the one its own sidebar shows (Fahad calls it by that
// name, item 22: «لوحة الإدارة»), not the template's marketing title "Studio Admin: Open Source Admin Dashboard with
// shadcn/ui". Renaming the product itself is Fahad's decision and is not done here.

/**
 * F-16 (Fahad 15 Oct 15:20, relayed by the monitor): the product's name, in this one place. Every page shows this
 * name or a functional one (Tasks, Invoices, Calendar, Audit log), never the ready-made systems behind the pages or the
 * template's name. Fahad has not chosen the final name yet; AIREST is his real product (airest.ai) for now.
 */
export const PRODUCT_NAME = "منصة فهد";

export const APP_CONFIG = {
  name: PRODUCT_NAME,
  version: packageJson.version,
  copyright: `© ${currentYear}, ${PRODUCT_NAME}.`,
  meta: {
    title: PRODUCT_NAME,
    description: "Customer conversations, channels and team settings for منصة الشركة (preview with sample data).",
  },
};
