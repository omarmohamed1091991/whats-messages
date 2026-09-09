import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "30")

    const supabase = await createClient()

    // Get last N days of statistics
    const { data: history, error } = await supabase
      .from("daily_statistics")
      .select("*")
      .order("date", { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return NextResponse.json({
      history: history || [],
      count: history?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Error fetching stats history:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
