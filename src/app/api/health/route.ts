import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    configured: {
      supadata: !!process.env.SUPADATA_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
    },
  });
}
