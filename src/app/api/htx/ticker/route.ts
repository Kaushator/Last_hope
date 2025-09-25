import { NextRequest, NextResponse } from 'next/server';
import { createHTXClient } from '@/lib/api/htx';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter required' }, { status: 400 });
    }

    const htxClient = createHTXClient();
    const tickerData = await htxClient.getTicker(symbol);

    return NextResponse.json({
      success: true,
      data: tickerData
    });
  } catch (error) {
    console.error('HTX API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}