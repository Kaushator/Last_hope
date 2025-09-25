import { NextRequest, NextResponse } from 'next/server';
import { createHTXClient } from '@/lib/api/htx';

export async function GET(request: NextRequest) {
  try {
    const htxClient = createHTXClient();
    const balanceData = await htxClient.getAccountBalance();

    return NextResponse.json({
      success: true,
      data: balanceData
    });
  } catch (error) {
    console.error('HTX Balance API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unable to fetch account balance' 
      },
      { status: 500 }
    );
  }
}