import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const cfToken = process.env.CLOUDFLARE_API_TOKEN;
const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

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

    // 1. Cloudflare Workers AI (Sole Provider)
    if (cfToken && cfAccountId && cfAccountId !== "YOUR_ACCOUNT_ID_HERE") {
      try {
        console.log("Trying Cloudflare Workers AI (Llama 3.2 Vision)...");
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${cfToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "@cf/meta/llama-3.2-11b-vision-instruct",
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
          }
        );

        if (cfResponse.ok) {
          const result = await cfResponse.json();
          extractedText = result.choices[0].message?.content || "";
          if (extractedText) {
            console.log("SUCCESS with Cloudflare Workers AI");
          } else {
            lastError = "Empty response from Cloudflare";
          }
        } else {
          const err = await cfResponse.json();
          lastError = err.error?.message || "Cloudflare API error";
          console.warn("Cloudflare failed:", lastError);
        }
      } catch (e: any) {
        lastError = e.message;
        console.warn("Cloudflare fetch failed:", lastError);
      }
    } else {
      lastError = "Cloudflare configuration missing. Please ensure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are set in .env";
    }

    if (!extractedText) {
      throw new Error(`Cloudflare Scanning Failed: ${lastError}`);
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
