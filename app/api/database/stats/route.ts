import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = createClient()

    console.log("[v0] Fetching database storage statistics")

    // Get counts for each table
    const [webhookCount, historyCount, scheduledCount, mediaCount] = await Promise.all([
      supabase.from("webhook_messages").select("id", { count: "exact", head: true }),
      supabase.from("message_history").select("id", { count: "exact", head: true }),
      supabase.from("scheduled_messages").select("id", { count: "exact", head: true }),
      supabase.from("uploaded_media").select("id", { count: "exact", head: true }),
    ])

    const stats = {
      webhookMessages: webhookCount.count || 0,
      messageHistory: historyCount.count || 0,
      scheduledMessages: scheduledCount.count || 0,
      uploadedMedia: mediaCount.count || 0,
      total:
        (webhookCount.count || 0) + (historyCount.count || 0) + (scheduledCount.count || 0) + (mediaCount.count || 0),
    }

    console.log("[v0] Database stats:", stats)

    return NextResponse.json({ success: true, stats })
  } catch (error: any) {
    console.error("[v0] Database stats error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "فشل جلب إحصائيات قاعدة البيانات",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
