import z from "zod";

// F159: one row per agent reply flagged as a dodge, on a real inbox conversation (id = conversation id, the same
// person, channel and agent as /dashboard/chat). "ago" is the reply's age as the thread shows it.
const recentDodgesSchema = z.object({
  id: z.string(),
  name: z.string(),
  channel: z.string(),
  agent: z.string(),
  dodge: z.string(),
  status: z.string(),
  detected: z.string(),
  ago: z.string(),
});

export type RecentCustomerRow = z.infer<typeof recentDodgesSchema>;
