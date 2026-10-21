// Live inboxes of the same service have slugs such as whatsapp-14. Keep their identity
// consistent while retaining the full slug for filtering and selecting an individual inbox.
export function channelIdentity(channel: string): string {
  return channel.replace(
    /^(whatsapp|instagram|facebook|messenger|email|telegram|tiktok|line|sms|phone|api|chat)-\d+$/,
    "$1",
  );
}
