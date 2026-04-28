import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is missing from environment variables!");
}
const genAI = new GoogleGenerativeAI(apiKey || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

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
    const { image } = await req.json(); // base64 image with data:image prefix

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // --- API HEALTH CHECK ---
    try {
      console.log("Running API Health Check...");
      const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      await textModel.generateContent("Hi");
      console.log("API Health Check: SUCCESS!");
    } catch (healthErr: any) {
      console.error("API Health Check: FAILED!", healthErr.message);
    }
    // ------------------------

    // Prepare image for Gemini (remove prefix)
    const base64Data = image.split(",")[1];

    // 1. Call Gemini Vision API via Direct REST (Universal Fix)
    console.log("Attempting direct REST call to Gemini 1.5 Flash...");
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }]
      })
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error("Direct API Error:", errorData);
      throw new Error(`Gemini API Error: ${errorData.error?.message || "Request failed"}`);
    }

    const result = await geminiResponse.json();
    const text = result.candidates[0].content.parts[0].text;

    // Clean Gemini response (strip markdown backticks)
    text = text.replace(/```json|```/g, "").trim();

    let extractedData;
    try {
      extractedData = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", text);
      return NextResponse.json({ error: "Failed to parse extracted data" }, { status: 500 });
    }

    // 2. Upload image to Supabase Storage
    const fileName = `scan_${Date.now()}.jpg`;
    const buffer = Buffer.from(base64Data, 'base64');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('scans')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      // Continue anyway, but image_url will be empty or handle error
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
