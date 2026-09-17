"use client"

import { Button } from "@/components/ui/button"
import { TrashIcon } from "lucide-react"
import type { Holding } from "./portfolio-analyzer"

interface HoldingsTableProps {
  holdings: Holding[]
  onRemove: (id: string) => void
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  stocks: "Stocks",
  bonds: "Bonds",
  cash: "Cash",
  crypto: "Crypto",
  other: "Other",
}

export default function HoldingsTable({ holdings, onRemove }: HoldingsTableProps) {
  return (
    <div className="space-y-2">
      {holdings.map((holding) => (
        <div key={holding.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-semibold text-foreground">{holding.ticker}</span>
              <span className="text-xs text-muted-foreground">{ASSET_CLASS_LABELS[holding.assetClass]}</span>
            </div>
            <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
              <span>{holding.quantity} shares</span>
              <span className="font-mono font-medium text-foreground">
                ${holding.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(holding.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}
