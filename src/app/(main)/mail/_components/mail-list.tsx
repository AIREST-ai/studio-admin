import { cn } from "cn";
import { differenceInDays } from "date-fns/differenceInDays";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";

import { RowStar } from "@/app/(main)/chat/_components/chat-mail-actions";
import { useMailLook } from "@/app/(main)/chat/_components/chat-mail-nav";
import { personToneClass } from "@/app/(main)/dashboard/contacts/_components/studio-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials } from "@/lib/utils";

import type { Mail } from "./data";
import { useMail } from "./use-mail";

type MailGroup = {
  id: string;
  title: string;
  items: Mail[];
};

interface MailListProps {
  groups: MailGroup[];
  onSelectMail?: (mail: Mail) => void;
}

export function MailList({ groups, onSelectMail }: MailListProps) {
  const [mail, setMail] = useMail();
  // F159: on the Support Email page of /dashboard/chat the group counts are Studio count pills.
  const studio = useMailLook() === "studio";

  return (
    <ScrollArea className="**:data-[slot=scroll-area-viewport]:scroll-fade min-h-0 flex-1">
      <div className="flex flex-col gap-1.5 pt-0">
        {studio && groups.every((group) => group.items.length === 0) && (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">
            There are no active conversations in this group.
          </p>
        )}
        {groups
          .filter((group) => !studio || group.items.length > 0)
          .map((group) => (
            <section key={group.id} className="flex flex-col gap-1.5">
              {studio ? (
                <div className="mx-3 flex items-center gap-1.5 text-muted-foreground text-xs">
                  {group.title}
                  <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] tabular-nums">
                    {group.items.length}
                  </Badge>
                </div>
              ) : (
                <div className="mx-3 text-muted-foreground text-xs">
                  {group.title} ({group.items.length})
                </div>
              )}

              <div className="flex flex-col">
                {group.items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={cn(
                      "group relative w-full border-transparent border-y p-3 text-left transition-colors",
                      "hover:bg-muted/60",
                      mail.selected === item.id &&
                        "border-border bg-muted/70 before:absolute before:-inset-y-px before:left-0 before:w-0.5 before:bg-primary",
                    )}
                    onClick={(event) => {
                      event.currentTarget.blur();

                      setMail({
                        ...mail,
                        selected: item.id,
                      });
                      onSelectMail?.(item);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* F159: round two-letter initials coloured by name, like every other view of these people. */}
                      <Avatar className={cn("size-9 shrink-0 font-medium", personToneClass(item.from.name))}>
                        <AvatarFallback className="text-xs">{getInitials(item.from.name)}</AvatarFallback>
                      </Avatar>

                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div
                              className={cn(
                                "flex items-center gap-2 truncate font-normal text-sm",
                                !item.isRead && "font-medium",
                              )}
                            >
                              {item.from.name} {!item.isRead && <span className="size-2 rounded-full bg-blue-600" />}
                              <RowStar mailId={item.id} />
                            </div>
                            <div
                              className={cn(
                                "truncate font-medium text-foreground text-xs",
                                item.isRead && "font-normal text-muted-foreground",
                              )}
                            >
                              {item.subject}
                            </div>
                          </div>

                          <div
                            className={cn(
                              "shrink-0 text-muted-foreground text-xs",
                              mail.selected === item.id && "text-foreground",
                            )}
                          >
                            {formatMailDate(item.receivedAt)}
                          </div>
                        </div>

                        <p className="mt-2 line-clamp-2 text-muted-foreground text-xs leading-5">{item.body}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
      </div>
    </ScrollArea>
  );
}

function formatMailDate(date: string) {
  const mailDate = new Date(date);

  if (differenceInDays(new Date(), mailDate) <= 3) {
    return formatDistanceToNow(mailDate, { addSuffix: true });
  }

  return format(mailDate, "d MMM yyyy");
}
