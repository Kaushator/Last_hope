import { NextRequest, NextResponse } from 'next/server';
import { processCSVFile } from '@/lib/csv-processor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 });
    }
    
    const result = await processCSVFile(file);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('CSV Upload Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process file'
      },
      { status: 500 }
    );
  }
}