// HTX API Types
export interface HTXTickerData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amount: number;
  vol: number;
  count: number;
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;
}

export interface HTXBalance {
  currency: string;
  type: 'trade' | 'frozen';
  balance: string;
}

export interface HTXAccountBalance {
  id: number;
  type: string;
  subtype: string;
  list: HTXBalance[];
}

// Portfolio Types
export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  totalValue: number;
  holdings: Holding[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Holding {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
}

// Analytics Types
export interface AnalyticsData {
  portfolioPerformance: PortfolioPerformance;
  assetAllocation: AssetAllocation[];
  riskMetrics: RiskMetrics;
  aiInsights: AIInsight[];
}

export interface PortfolioPerformance {
  totalReturn: number;
  totalReturnPercentage: number;
  dailyReturn: number;
  dailyReturnPercentage: number;
  volatility: number;
  sharpeRatio: number;
}

export interface AssetAllocation {
  symbol: string;
  percentage: number;
  value: number;
}

export interface RiskMetrics {
  var95: number; // Value at Risk (95%)
  maxDrawdown: number;
  beta: number;
  correlation: number;
}

export interface AIInsight {
  id: string;
  type: 'recommendation' | 'alert' | 'analysis';
  title: string;
  description: string;
  confidence: number;
  createdAt: Date;
  relatedSymbols: string[];
}

// CSV Upload Types
export interface CSVUploadResult {
  success: boolean;
  recordsProcessed: number;
  errors: string[];
  data: any[];
}

// MCP Types
export interface MCPRequest {
  id: string;
  type: 'csv' | 'docker' | 'ai' | 'cicd';
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}