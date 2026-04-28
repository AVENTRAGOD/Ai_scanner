import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is missing from environment variables!");
}
const genAI = new GoogleGenerativeAI(apiKey || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    // Prepare image for Gemini (remove prefix)
    const base64Data = image.split(",")[1];

    // 1. Call Gemini Vision API with Fallback and Logging
    let result;
    try {
      console.log("Attempting Gemini 1.5 Flash...");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      result = await model.generateContent([{ inlineData: { mimeType: "image/jpeg", data: base64Data } }, { text: systemPrompt }]);
      console.log("Gemini 1.5 Flash Success!");
    } catch (err: any) {
      console.error("Gemini 1.5 Flash Failed:", err.message || err);
      try {
        console.log("Attempting Gemini 1.5 Pro...");
        const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        result = await proModel.generateContent([{ inlineData: { mimeType: "image/jpeg", data: base64Data } }, { text: systemPrompt }]);
        console.log("Gemini 1.5 Pro Success!");
      } catch (proErr: any) {
        console.error("Gemini 1.5 Pro Failed:", proErr.message || proErr);
        try {
          console.log("Attempting Legacy Pro Vision...");
          const legacyModel = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
          result = await legacyModel.generateContent([{ inlineData: { mimeType: "image/jpeg", data: base64Data } }, { text: systemPrompt }]);
          console.log("Legacy Pro Vision Success!");
        } catch (finalErr: any) {
          console.error("ALL MODELS FAILED. Last Error:", finalErr.message || finalErr);
          throw new Error(`Gemini API Error: ${finalErr.message || "Unknown"}. Check Vercel logs.`);
        }
      }
    }

    const response = await result.response;
    let text = response.text();

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
