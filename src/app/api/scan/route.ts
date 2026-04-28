import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const apiKey = process.env.GEMINI_API_KEY;

const systemPrompt = `You are an expert invoice and receipt data extractor. 
Analyze the document image and extract ALL data fields you can find. 
Return ONLY a valid JSON object with two keys:
1. 'columns': an array of column header strings you detected
2. 'rows': an array of arrays, where each inner array contains the 
   values for that row matching the columns order.
Be thorough - extract headers, line items, totals, dates, invoice numbers, 
vendor info, and any other visible fields. 
If a cell value is missing put an empty string.
Return ONLY raw JSON, no markdown, no backticks, no explanation.`;

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const base64Data = image.split(",")[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // 1. Call Gemini Vision API with Fallback
    const modelNames = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro-vision"];
    let lastError = "";
    let extractedText = "";

    for (const modelName of modelNames) {
      try {
        console.log(`Trying model: ${modelName}`);
        const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
        
        const geminiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: systemPrompt },
                { inline_data: { mime_type: "image/jpeg", data: base64Data } }
              ]
            }]
          })
        });

        if (geminiResponse.ok) {
          const result = await geminiResponse.json();
          extractedText = result.candidates[0].content.parts[0].text;
          console.log(`SUCCESS with model: ${modelName}`);
          break;
        } else {
          const err = await geminiResponse.json();
          lastError = err.error?.message || "Unknown error";
          console.warn(`Model ${modelName} failed:`, lastError);
        }
      } catch (e: any) {
        lastError = e.message;
        console.warn(`Fetch failed for ${modelName}:`, lastError);
      }
    }

    if (!extractedText) {
      throw new Error(`All Gemini models failed. Last error: ${lastError}. This account may have regional restrictions.`);
    }

    let text = extractedText;
    text = text.replace(/```json|```/g, "").trim();
    
    const extractedData = JSON.parse(text);

    // 2. Upload image to Supabase Storage
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

    // 3. Save to Supabase Table
    const { data: dbData, error: dbError } = await supabase
      .from('scan_results')
      .insert([
        {
          columns: extractedData.columns,
          rows: extractedData.rows,
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
      columns: extractedData.columns,
      rows: extractedData.rows,
      image_url: publicUrl
    });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
