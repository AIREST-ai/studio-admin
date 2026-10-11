import z from "zod";

const recentDodgesSchema = z.object({
  id: z.string(),
  name: z.string(),
  channel: z.string(),
  agent: z.string(),
  dodge: z.string(),
  status: z.string(),
  detected: z.string(),
});

export type RecentCustomerRow = z.infer<typeof recentDodgesSchema>;
