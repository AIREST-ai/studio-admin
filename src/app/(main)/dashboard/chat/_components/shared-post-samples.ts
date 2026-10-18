// T-264: synthetic shared posts for the sample threads. Not real Meta data and not a real Meta request: the media
// URLs stand in for Meta's signed CDN URLs, and one stands in for an expired URL with a URL that answers 404. The post
// links point at the public page of a file of the same kind, or at Meta's documentation of the payload when the case
// has no file (a link is only followed when someone clicks it).
// F-1 (Fahad 129.2, no request to an outside server): the image, the reel and the expired one were Wikimedia Commons
// and MDN URLs, which made the page call those servers. They are now files kept with the preview
// (media/preview-samples, answered by /api/preview-sim/sample) and a path of the same route that has no file and so
// answers 404.
import type { SharedPost } from "./shared-post-card";

const SAMPLE = "/api/preview-sim/sample?name=";
const IMAGE = `${SAMPLE}shared-post-example.jpg`;
const IMAGE_PAGE = "https://commons.wikimedia.org/wiki/File:Example.jpg";
const VIDEO = `${SAMPLE}shared-post-reel.webm`;
const VIDEO_PAGE = "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video";
const EXPIRED = `${SAMPLE}expired-sample-post-image.jpg`;
const MESSENGER_DOC =
  "https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks/webhook-events/messages";

export const sharedPostsByMessage: Record<number, SharedPost[]> = {
  // Instagram #3: an ig_post whose image URL works, and one whose URL no longer loads (text and link stay).
  301: [
    {
      channel: "instagram",
      sourceType: "ig_post",
      renderKind: "image",
      title: "Example.jpg (sample post)",
      text: "This is the dashboard screen I mean, from the post on our page.",
      postUrl: IMAGE_PAGE,
      mediaUrl: IMAGE,
    },
  ],
  303: [
    {
      channel: "instagram",
      sourceType: "ig_post",
      renderKind: "image",
      title: "Sample post with an expired image URL",
      text: "And this one from last week.",
      postUrl: IMAGE_PAGE,
      mediaUrl: EXPIRED,
    },
  ],
  // Instagram #21: a reel with its own poster image, and one without (no frame is taken from the video).
  2101: [
    {
      channel: "instagram",
      sourceType: "ig_reel",
      renderKind: "video",
      title: "flower.webm (sample reel with poster)",
      postUrl: VIDEO_PAGE,
      mediaUrl: VIDEO,
      posterUrl: IMAGE,
    },
  ],
  2103: [
    {
      channel: "instagram",
      sourceType: "ig_reel",
      renderKind: "video",
      title: "flower.webm (sample reel, no poster)",
      postUrl: VIDEO_PAGE,
      mediaUrl: VIDEO,
    },
    // A share Meta sent with no payload (unsupported).
    { channel: "instagram", sourceType: "unsupported", renderKind: "unknown" },
  ],
  // Facebook #5: Messenger "post" carries a URL and a title, no image, so none is shown.
  501: [
    {
      channel: "facebook",
      sourceType: "post",
      renderKind: "link",
      title: "Sample Facebook post (link and title only)",
      postUrl: MESSENGER_DOC,
    },
  ],
};
