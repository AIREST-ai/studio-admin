"use client";

import type { ReactNode } from "react";

import { Globe, Mail, MessageSquare, Phone, Smartphone } from "lucide-react";
import { siInstagram, siMessenger, siWhatsapp } from "simple-icons";

export const orbitChannels = [
  { id: "whatsapp", name: "واتساب", brand: siWhatsapp, color: "text-green-500", x: 24, y: 8 },
  { id: "facebook", name: "فيسبوك ماسنجر", brand: siMessenger, color: "text-blue-500", x: 76, y: 8 },
  { id: "instagram", name: "إنستغرام", brand: siInstagram, color: "text-pink-500", x: 93, y: 34 },
  { id: "email", name: "البريد الإلكتروني", icon: Mail, color: "text-red-500", x: 93, y: 66 },
  { id: "chat", name: "محادثات الموقع", icon: Globe, color: "text-sky-500", x: 76, y: 92 },
  { id: "phone", name: "الهاتف", icon: Phone, color: "text-orange-500", x: 24, y: 92 },
  { id: "sms", name: "الرسائل النصية", icon: MessageSquare, color: "text-teal-500", x: 7, y: 66 },
  { id: "api", name: "قناة API", icon: Smartphone, color: "text-violet-500", x: 7, y: 34 },
];

function labelAlignment(channelX: number) {
  if (channelX > 75) return "right-0";
  if (channelX < 25) return "left-0";
  return "left-1/2 -translate-x-1/2";
}

export function ChannelOrbit({
  children,
  selected,
  onSelect,
}: {
  children: ReactNode;
  selected: string | null;
  onSelect: (channelId: string) => void;
}) {
  return (
    <div
      data-emma-channels
      className="relative flex h-[min(64svh,520px)] w-[min(100%,570px)] items-center justify-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[7%] inset-y-[7%] rounded-full border border-border"
      />
      <div className="relative z-10 flex items-center justify-center">{children}</div>
      <ul aria-label="القنوات المدعومة حول إيما" className="m-0 list-none p-0">
        {orbitChannels.map((channel, index) => {
          const Icon = channel.icon;
          return (
            <li
              key={channel.id}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300"
              style={{
                left: `${channel.x}%`,
                top: `${channel.y}%`,
                opacity: selected && selected !== channel.id ? 0.35 : 1,
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(channel.id)}
                aria-label={`اختيار ${channel.name}`}
                aria-pressed={selected === channel.id}
                title={channel.name}
                className={`emma-channel-motion flex size-11 cursor-pointer items-center justify-center rounded-2xl border border-border bg-background/95 shadow-sm focus-visible:outline-2 focus-visible:outline-ring sm:size-12 ${channel.color}`}
                style={{ animationDelay: `${index * -0.85}s` }}
              >
                {channel.brand && (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
                    <path d={channel.brand.path} />
                  </svg>
                )}
                {Icon && <Icon aria-hidden="true" className="size-5" strokeWidth={1.7} />}
              </button>
              {selected === channel.id && (
                <span
                  data-emma-channel-label
                  className={`absolute top-full mt-1.5 whitespace-nowrap rounded-full bg-background/95 px-2.5 py-0.5 text-sm shadow-sm ${labelAlignment(channel.x)}`}
                >
                  {channel.name}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <style>{`
        [data-emma-channels] .emma-channel-motion { animation: emma-channel-gentle-pulse 9s ease-in-out infinite; }
        @keyframes emma-channel-gentle-pulse {
          0%,100% { transform: translateY(1px) scale(.985); }
          50% { transform: translateY(-3px) scale(1.035); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-emma-channels] .emma-channel-motion { animation: none; }
        }
      `}</style>
    </div>
  );
}
