'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { BarChart, LineChart, PieChart, TrendingUp, Upload, Settings, RefreshCw } from 'lucide-react'

export default function Dashboard() {
  const [portfolioValue, setPortfolioValue] = useState(125430.50)
  const [dailyChange, setDailyChange] = useState(2.34)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">HTX Analytics</h1>
              <span className="text-sm text-muted-foreground">Personal Trading Analytics</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync HTX
              </Button>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Portfolio Overview */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${portfolioValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {dailyChange > 0 ? '+' : ''}{dailyChange}% from yesterday
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">24h Change</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+$2,940</div>
              <p className="text-xs text-muted-foreground">+2.4% increase</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Return</CardTitle>
              <LineChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+15.2%</div>
              <p className="text-xs text-muted-foreground">Since inception</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">6.2</div>
              <p className="text-xs text-muted-foreground">Moderate risk</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="portfolio" className="space-y-4">
          <TabsList>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
            <TabsTrigger value="data-upload">Data Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Current Holdings</CardTitle>
                  <CardDescription>Your current cryptocurrency positions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Bitcoin (BTC)</p>
                        <p className="text-sm text-muted-foreground">2.5 BTC</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">$67,500</p>
                        <p className="text-sm text-green-600">+5.2%</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Ethereum (ETH)</p>
                        <p className="text-sm text-muted-foreground">15.8 ETH</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">$42,300</p>
                        <p className="text-sm text-red-600">-2.1%</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Binance Coin (BNB)</p>
                        <p className="text-sm text-muted-foreground">45.2 BNB</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">$15,630</p>
                        <p className="text-sm text-green-600">+3.8%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Asset Allocation</CardTitle>
                  <CardDescription>Portfolio distribution by asset</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Bitcoin (BTC)</span>
                        <span className="text-sm font-medium">53.8%</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '53.8%' }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Ethereum (ETH)</span>
                        <span className="text-sm font-medium">33.7%</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '33.7%' }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Binance Coin (BNB)</span>
                        <span className="text-sm font-medium">12.5%</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full">
                        <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '12.5%' }}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
                <CardDescription>Detailed portfolio performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Sharpe Ratio</h4>
                    <p className="text-2xl font-bold">1.42</p>
                    <p className="text-xs text-muted-foreground">Risk-adjusted return</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Max Drawdown</h4>
                    <p className="text-2xl font-bold text-red-600">-8.3%</p>
                    <p className="text-xs text-muted-foreground">Largest peak-to-trough decline</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Volatility</h4>
                    <p className="text-2xl font-bold">24.7%</p>
                    <p className="text-xs text-muted-foreground">30-day volatility</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Insights</CardTitle>
                <CardDescription>FinGPT analysis and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-blue-700">Market Opportunity</h4>
                    <p className="text-sm text-muted-foreground">
                      Based on current market conditions, consider rebalancing your BTC position. 
                      Technical indicators suggest a potential consolidation phase.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Confidence: 78%</p>
                  </div>
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-semibold text-yellow-700">Risk Alert</h4>
                    <p className="text-sm text-muted-foreground">
                      Your portfolio correlation with BTC is high (0.85). Consider diversifying 
                      into uncorrelated assets to reduce systemic risk.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Confidence: 92%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data-upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Upload & Management</CardTitle>
                <CardDescription>Upload CSV files and manage your trading data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload Trading Data</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag and drop your CSV files here, or click to browse
                    </p>
                    <Button>
                      Select Files
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Supported formats: CSV files from HTX, Binance, or custom formats</p>
                    <p>Maximum file size: 50MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}