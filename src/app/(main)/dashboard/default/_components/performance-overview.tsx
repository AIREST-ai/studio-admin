"use client";

import { addHours, endOfToday, format, parseISO, subHours } from "date-fns";
import { Area, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// One point per day: dodges detected and dodges solved (sample data).
const chartValues = [
  { dodges: 17, solved: 13 },
  { dodges: 18, solved: 14 },
  { dodges: 18, solved: 14 },
  { dodges: 20, solved: 15 },
  { dodges: 18, solved: 15 },
  { dodges: 23, solved: 20 },
  { dodges: 20, solved: 16 },
  { dodges: 21, solved: 17 },
  { dodges: 22, solved: 18 },
  { dodges: 23, solved: 19 },
  { dodges: 22, solved: 18 },
  { dodges: 18, solved: 15 },
  { dodges: 21, solved: 17 },
  { dodges: 20, solved: 17 },
  { dodges: 21, solved: 16 },
  { dodges: 20, solved: 17 },
  { dodges: 17, solved: 14 },
  { dodges: 22, solved: 18 },
  { dodges: 15, solved: 12 },
  { dodges: 18, solved: 15 },
  { dodges: 18, solved: 15 },
  { dodges: 16, solved: 13 },
  { dodges: 20, solved: 17 },
  { dodges: 20, solved: 16 },
  { dodges: 19, solved: 17 },
  { dodges: 16, solved: 13 },
  { dodges: 16, solved: 13 },
  { dodges: 14, solved: 12 },
  { dodges: 16, solved: 13 },
  { dodges: 12, solved: 10 },
  { dodges: 17, solved: 14 },
  { dodges: 14, solved: 12 },
  { dodges: 15, solved: 12 },
  { dodges: 18, solved: 15 },
  { dodges: 16, solved: 14 },
  { dodges: 16, solved: 13 },
  { dodges: 16, solved: 14 },
  { dodges: 18, solved: 16 },
  { dodges: 16, solved: 14 },
  { dodges: 15, solved: 13 },
  { dodges: 19, solved: 16 },
  { dodges: 18, solved: 15 },
  { dodges: 18, solved: 16 },
  { dodges: 18, solved: 15 },
  { dodges: 16, solved: 14 },
  { dodges: 17, solved: 14 },
  { dodges: 17, solved: 15 },
  { dodges: 19, solved: 16 },
  { dodges: 15, solved: 13 },
  { dodges: 15, solved: 13 },
  { dodges: 21, solved: 19 },
  { dodges: 15, solved: 14 },
  { dodges: 17, solved: 15 },
  { dodges: 19, solved: 16 },
  { dodges: 16, solved: 14 },
  { dodges: 17, solved: 15 },
  { dodges: 11, solved: 9 },
  { dodges: 15, solved: 13 },
  { dodges: 13, solved: 11 },
  { dodges: 16, solved: 14 },
  { dodges: 14, solved: 12 },
  { dodges: 12, solved: 11 },
  { dodges: 17, solved: 14 },
  { dodges: 13, solved: 12 },
  { dodges: 15, solved: 13 },
  { dodges: 11, solved: 10 },
  { dodges: 14, solved: 12 },
  { dodges: 9, solved: 8 },
  { dodges: 11, solved: 10 },
  { dodges: 8, solved: 7 },
  { dodges: 15, solved: 14 },
  { dodges: 8, solved: 7 },
  { dodges: 13, solved: 11 },
  { dodges: 13, solved: 12 },
  { dodges: 13, solved: 11 },
  { dodges: 13, solved: 12 },
  { dodges: 14, solved: 13 },
  { dodges: 13, solved: 11 },
  { dodges: 14, solved: 13 },
  { dodges: 11, solved: 10 },
  { dodges: 15, solved: 14 },
  { dodges: 15, solved: 14 },
  { dodges: 8, solved: 7 },
  { dodges: 14, solved: 12 },
  { dodges: 18, solved: 17 },
  { dodges: 14, solved: 13 },
  { dodges: 15, solved: 14 },
  { dodges: 13, solved: 4 },
  { dodges: 15, solved: 7 },
  { dodges: 11, solved: 6 },
  { dodges: 11, solved: 8 },
];

const endDate = endOfToday();
const startDate = subHours(endDate, (chartValues.length - 1) * 24);

const chartData = chartValues.map((point, index) => ({
  date: format(addHours(startDate, index * 24), "yyyy-MM-dd"),
  ...point,
}));

const chartConfig = {
  dodges: {
    label: "Dodges detected",
    color: "var(--chart-1)",
  },
  solved: {
    label: "Solved",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function PerformanceOverview() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">Dodges over time</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">Dodges detected and solved, last 3 months</span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select defaultValue="quarter">
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder="3 months" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Period</SelectLabel>
                <SelectItem value="quarter">3 months</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Channels</SelectLabel>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="messenger">Messenger</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            View report
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
          <ComposedChart data={chartData} margin={{ top: 0 }}>
            <defs>
              <linearGradient id="fillDodges" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-dodges)" stopOpacity={0.36} />
                <stop offset="95%" stopColor="var(--color-dodges)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={48}
              tickFormatter={(value) =>
                parseISO(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="w-50"
                  indicator="line"
                  labelFormatter={(value) => format(parseISO(value), "d MMMM yyyy")}
                />
              }
            />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent className="mb-5 justify-end" />} />

            <Area
              dataKey="dodges"
              type="natural"
              fill="url(#fillDodges)"
              stroke="var(--color-dodges)"
              strokeWidth={1.25}
              dot={false}
              fillOpacity={1}
            />
            <Line dataKey="solved" type="natural" stroke="var(--color-solved)" strokeWidth={1.4} dot={false} />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
