import { createWorker } from 'tesseract.js';
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { image } = await req.json(); // base64 image with data:image prefix

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Prepare image for Tesseract (remove prefix)
    const base64Data = image.split(",")[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // 1. Run OCR using Tesseract.js
    console.log("Starting Tesseract OCR...");
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    console.log("OCR completed. Raw text extracted.");

    // 2. Parse the raw text into structured data (Basic Parser)
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Default columns for the table
    const columns = ["Description", "Quantity", "Price", "Total"];
    const rows: string[][] = [];

    // Simple heuristic parser for receipt line items
    // Looks for lines that contain numbers (likely prices)
    for (const line of lines) {
      // Regex to find a price-like number (e.g. 10.99, 1,000.00)
      const priceMatch = line.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/);
      
      if (priceMatch) {
        const price = priceMatch[0];
        const description = line.replace(price, '').trim() || "Item";
        // If it looks like a total or tax, we could filter it, but for now we'll include it
        rows.push([description, "1", price, price]);
      }
    }

    // If no items were found, add the raw text as a single row for user to edit
    if (rows.length === 0 && lines.length > 0) {
      rows.push(["Scanned Document Text", "1", "0.00", "0.00"]);
      lines.forEach(l => rows.push([l, "", "", ""]));
    }

    // 3. Upload image to Supabase Storage
    const fileName = `scan_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('scans')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('scans')
      .getPublicUrl(fileName);

    // 4. Save to Supabase Table
    const { data: dbData, error: dbError } = await supabase
      .from('scan_results')
      .insert([
        {
          columns: columns,
          rows: rows,
          image_url: publicUrl,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error("Supabase DB error:", dbError);
    }

    return NextResponse.json({
      id: dbData?.id,
      columns: columns,
      rows: rows,
      image_url: publicUrl
    });

  } catch (error: any) {
    console.error("Tesseract API Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
