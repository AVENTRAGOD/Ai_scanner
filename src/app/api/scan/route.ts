import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const geminiKey = process.env.GEMINI_API_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;

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

    let lastError = "";
    let extractedText = "";

    // 1. Try Free OpenRouter Models (Requested by user)
    if (openRouterKey) {
      const freeModels = [
        "qwen/qwen2.5-vl-72b-instruct:free",
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.2-11b-vision-instruct:free"
      ];

      for (const modelName of freeModels) {
        try {
          console.log(`Trying OpenRouter Free Model: ${modelName}...`);
          const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openRouterKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://github.com/AVENTRAGOD/Ai_scanner",
              "X-Title": "AI Scanner",
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: systemPrompt },
                    { 
                      type: "image_url", 
                      image_url: { url: `data:image/jpeg;base64,${base64Data}` } 
                    }
                  ]
                }
              ]
            })
          });

          if (orResponse.ok) {
            const result = await orResponse.json();
            extractedText = result.choices[0].message?.content || "";
            if (extractedText) {
              console.log(`SUCCESS with OpenRouter Model: ${modelName}`);
              break; // Stop if we got a result
            } else {
              console.warn(`Model ${modelName} returned empty content`);
              lastError = `Empty response from ${modelName}`;
            }
          } else {
            const err = await orResponse.json();
            lastError = err.error?.message || `OpenRouter API error with ${modelName}`;
            console.warn(`Model ${modelName} failed:`, lastError);
          }
        } catch (e: any) {
          lastError = e.message;
          console.warn(`Fetch failed for ${modelName}:`, lastError);
        }
      }
    } else {
      lastError = "OPENROUTER_API_KEY is missing in environment variables.";
    }

    if (!extractedText) {
      throw new Error(`All free scanning models failed. Last error: ${lastError}. Please ensure your OpenRouter key is valid.`);
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
