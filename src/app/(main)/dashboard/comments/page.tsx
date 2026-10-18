import type { Metadata } from "next";

import { CommentsWorkspace } from "./_components/comments-workspace";

export const metadata: Metadata = {
  title: "Comments",
  description: "Manage Facebook Page and Instagram post and reel comments with public and private replies.",
};

export default function Page() {
  return <CommentsWorkspace />;
}
