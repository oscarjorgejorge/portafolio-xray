"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusIcon } from "lucide-react"
import AssetAllocationChart from "@/components/asset-allocation-chart"
import HoldingsTable from "@/components/holdings-table"

export interface Holding {
  id: string
  ticker: string
  quantity: number
  value: number
  assetClass: "stocks" | "bonds" | "cash" | "crypto" | "other"
}

export default function PortfolioAnalyzer() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [newHolding, setNewHolding] = useState({
    ticker: "",
    quantity: "",
    value: "",
    assetClass: "stocks" as Holding["assetClass"],
  })

  const addHolding = () => {
    if (!newHolding.ticker || !newHolding.quantity || !newHolding.value) return

    const holding: Holding = {
      id: Date.now().toString(),
      ticker: newHolding.ticker.toUpperCase(),
      quantity: Number.parseFloat(newHolding.quantity),
      value: Number.parseFloat(newHolding.value),
      assetClass: newHolding.assetClass,
    }

    setHoldings([...holdings, holding])
    setNewHolding({ ticker: "", quantity: "", value: "", assetClass: "stocks" })
  }

  const removeHolding = (id: string) => {
    setHoldings(holdings.filter((h) => h.id !== id))
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)

  const assetAllocation = holdings.reduce(
    (acc, holding) => {
      acc[holding.assetClass] = (acc[holding.assetClass] || 0) + holding.value
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-pretty">Add Your Holdings</CardTitle>
            <CardDescription>
              Enter your investment holdings to generate an instant portfolio X-Ray analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker Symbol</Label>
              <Input
                id="ticker"
                placeholder="AAPL, TSLA, BTC..."
                value={newHolding.ticker}
                onChange={(e) => setNewHolding({ ...newHolding, ticker: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addHolding()}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="10"
                  value={newHolding.quantity}
                  onChange={(e) => setNewHolding({ ...newHolding, quantity: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addHolding()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="value">Total Value ($)</Label>
                <Input
                  id="value"
                  type="number"
                  placeholder="1500"
                  value={newHolding.value}
                  onChange={(e) => setNewHolding({ ...newHolding, value: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addHolding()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assetClass">Asset Class</Label>
              <select
                id="assetClass"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={newHolding.assetClass}
                onChange={(e) => setNewHolding({ ...newHolding, assetClass: e.target.value as Holding["assetClass"] })}
              >
                <option value="stocks">Stocks</option>
                <option value="bonds">Bonds</option>
                <option value="cash">Cash</option>
                <option value="crypto">Crypto</option>
                <option value="other">Other</option>
              </select>
            </div>

            <Button onClick={addHolding} className="w-full" size="lg">
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Holding
            </Button>
          </CardContent>
        </Card>

        {holdings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Holdings</CardTitle>
              <CardDescription>
                Total Portfolio Value:{" "}
                <span className="font-mono font-semibold text-foreground">
                  ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HoldingsTable holdings={holdings} onRemove={removeHolding} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Analysis Results */}
      <div className="space-y-6">
        {holdings.length === 0 ? (
          <Card className="flex min-h-[400px] items-center justify-center">
            <CardContent className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">No holdings yet</h3>
              <p className="text-sm text-muted-foreground text-balance">
                Add your first holding to see instant portfolio analysis with asset allocation breakdown
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <AssetAllocationChart allocation={assetAllocation} totalValue={totalValue} />
          </>
        )}
      </div>
    </div>
  )
}
