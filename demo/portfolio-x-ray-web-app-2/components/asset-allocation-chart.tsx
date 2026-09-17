"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

interface AssetAllocationChartProps {
  allocation: Record<string, number>
  totalValue: number
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  stocks: "oklch(0.45 0.18 180)",
  bonds: "oklch(0.55 0.2 145)",
  cash: "oklch(0.65 0.18 85)",
  crypto: "oklch(0.5 0.15 240)",
  other: "oklch(0.6 0.2 320)",
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  stocks: "Stocks",
  bonds: "Bonds",
  cash: "Cash",
  crypto: "Crypto",
  other: "Other",
}

export default function AssetAllocationChart({ allocation, totalValue }: AssetAllocationChartProps) {
  const chartData = Object.entries(allocation).map(([assetClass, value]) => ({
    name: ASSET_CLASS_LABELS[assetClass] || assetClass,
    value,
    percentage: ((value / totalValue) * 100).toFixed(1),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-pretty">Asset Allocation Breakdown</CardTitle>
        <CardDescription>Your portfolio distribution across asset classes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name} ${percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ASSET_CLASS_COLORS[Object.keys(allocation)[index]]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) =>
                  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 space-y-3">
          {chartData.map((item, index) => {
            const assetClass = Object.keys(allocation)[index]
            return (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: ASSET_CLASS_COLORS[assetClass] }} />
                  <span className="font-medium text-card-foreground">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold text-foreground">
                    ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
