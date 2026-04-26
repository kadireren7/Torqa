"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { RiskTrendPoint } from "@/data/types";

const defaultChartConfig = {
  safe: { label: "Safe", color: "hsl(var(--chart-4))" },
  needsReview: { label: "Needs review", color: "hsl(var(--chart-3))" },
  blocked: { label: "Blocked", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

export type RiskTrendSeriesLabels = {
  safe?: string;
  needsReview?: string;
  blocked?: string;
};

type RiskTrendChartProps = {
  data: RiskTrendPoint[];
  /** Override legend / tooltip labels (e.g. Pass / Needs review / Fail for workflow scans). */
  seriesLabels?: RiskTrendSeriesLabels;
};

export function RiskTrendChart({ data, seriesLabels }: RiskTrendChartProps) {
  const chartConfig = {
    safe: {
      label: seriesLabels?.safe ?? defaultChartConfig.safe.label,
      color: defaultChartConfig.safe.color,
    },
    needsReview: {
      label: seriesLabels?.needsReview ?? defaultChartConfig.needsReview.label,
      color: defaultChartConfig.needsReview.color,
    },
    blocked: {
      label: seriesLabels?.blocked ?? defaultChartConfig.blocked.label,
      color: defaultChartConfig.blocked.color,
    },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={chartConfig} className="aspect-[21/9] min-h-[220px] w-full sm:aspect-[2/1]">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillSafe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-safe)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-safe)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillReview" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-needsReview)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-needsReview)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillBlocked" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-blocked)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--color-blocked)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
        />
        <YAxis tickLine={false} axisLine={false} width={36} tickMargin={4} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="safe"
          stackId="1"
          stroke="var(--color-safe)"
          fill="url(#fillSafe)"
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="needsReview"
          stackId="1"
          stroke="var(--color-needsReview)"
          fill="url(#fillReview)"
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="blocked"
          stackId="1"
          stroke="var(--color-blocked)"
          fill="url(#fillBlocked)"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ChartContainer>
  );
}
