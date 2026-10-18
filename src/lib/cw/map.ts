/**
 * V-20: Chatwoot's internal channel class name (`Channel::Instagram`) must never appear in
 * Studio tables or lists. Strip the technical prefix wherever a channel label is shown.
 */

export function channelName(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^(?:Channel::)+/, "");
}

export function withCleanChannelName<T extends { channelType: string; identifier: string }>(inbox: T): T {
  return {
    ...inbox,
    channelType: channelName(inbox.channelType) || inbox.channelType,
    identifier: channelName(inbox.identifier) || inbox.identifier,
  };
}
