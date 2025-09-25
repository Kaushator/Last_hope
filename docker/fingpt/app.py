from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FinGPT Analytics API",
    description="AI-powered financial analysis service for HTX Analytics",
    version="1.0.0"
)

class PortfolioData(BaseModel):
    holdings: List[dict]
    total_value: float
    performance_metrics: Optional[dict] = None

class AnalysisRequest(BaseModel):
    portfolio_data: PortfolioData
    analysis_type: str = "comprehensive"  # comprehensive, risk, recommendation
    timeframe: str = "30d"

class AnalysisResponse(BaseModel):
    insights: List[dict]
    recommendations: List[dict]
    risk_assessment: dict
    confidence_scores: dict
    generated_at: datetime

@app.get("/")
async def root():
    return {"message": "FinGPT Analytics API", "status": "running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_portfolio(request: AnalysisRequest):
    """
    Analyze portfolio data and generate AI insights
    """
    try:
        logger.info(f"Received analysis request for portfolio with {len(request.portfolio_data.holdings)} holdings")
        
        # Mock FinGPT analysis - In production, this would call the actual FinGPT model
        insights = generate_mock_insights(request.portfolio_data, request.analysis_type)
        recommendations = generate_mock_recommendations(request.portfolio_data)
        risk_assessment = generate_mock_risk_assessment(request.portfolio_data)
        confidence_scores = {
            "overall": 0.85,
            "risk_assessment": 0.92,
            "recommendations": 0.78
        }
        
        return AnalysisResponse(
            insights=insights,
            recommendations=recommendations,
            risk_assessment=risk_assessment,
            confidence_scores=confidence_scores,
            generated_at=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/market-sentiment")
async def analyze_market_sentiment(symbols: List[str]):
    """
    Analyze market sentiment for given symbols
    """
    try:
        sentiment_data = {}
        for symbol in symbols:
            # Mock sentiment analysis
            sentiment_data[symbol] = {
                "sentiment_score": 0.65,  # Range: -1 to 1
                "sentiment_label": "bullish",
                "confidence": 0.82,
                "key_factors": [
                    "Positive technical indicators",
                    "Strong volume patterns",
                    "Market momentum"
                ]
            }
        
        return {
            "sentiment_analysis": sentiment_data,
            "market_overview": {
                "overall_sentiment": "neutral_bullish",
                "volatility_level": "moderate",
                "risk_level": "medium"
            },
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")

def generate_mock_insights(portfolio_data: PortfolioData, analysis_type: str) -> List[dict]:
    """Generate mock AI insights"""
    base_insights = [
        {
            "id": "insight_1",
            "type": "portfolio_balance",
            "title": "Portfolio Concentration Risk",
            "description": "Your portfolio shows high concentration in Bitcoin (53.8%). Consider diversifying to reduce single-asset risk.",
            "severity": "medium",
            "confidence": 0.89
        },
        {
            "id": "insight_2", 
            "type": "market_timing",
            "title": "Market Entry Opportunity",
            "description": "Technical indicators suggest a potential accumulation zone for ETH. Consider dollar-cost averaging.",
            "severity": "low",
            "confidence": 0.76
        }
    ]
    
    if analysis_type == "risk":
        base_insights.append({
            "id": "insight_3",
            "type": "risk_management",
            "title": "Volatility Alert",
            "description": "Portfolio volatility has increased 15% over the past week. Consider position sizing adjustments.",
            "severity": "high",
            "confidence": 0.92
        })
    
    return base_insights

def generate_mock_recommendations(portfolio_data: PortfolioData) -> List[dict]:
    """Generate mock recommendations"""
    return [
        {
            "id": "rec_1",
            "type": "rebalancing",
            "action": "reduce_position",
            "symbol": "BTC",
            "current_allocation": 53.8,
            "recommended_allocation": 45.0,
            "reason": "Reduce concentration risk and improve portfolio diversification",
            "priority": "medium",
            "confidence": 0.84
        },
        {
            "id": "rec_2",
            "type": "diversification",
            "action": "add_position",
            "symbol": "SOL",
            "recommended_allocation": 8.0,
            "reason": "Add exposure to high-growth alternative Layer-1 blockchain",
            "priority": "low",
            "confidence": 0.71
        }
    ]

def generate_mock_risk_assessment(portfolio_data: PortfolioData) -> dict:
    """Generate mock risk assessment"""
    return {
        "overall_risk_score": 6.2,  # 1-10 scale
        "risk_level": "moderate",
        "var_95": -8.5,  # Value at Risk (95% confidence)
        "expected_shortfall": -12.3,
        "maximum_drawdown": -15.7,
        "correlation_risk": {
            "btc_correlation": 0.85,
            "market_correlation": 0.78,
            "risk_level": "high"
        },
        "diversification_score": 0.45,  # 0-1 scale
        "liquidity_risk": "low"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)