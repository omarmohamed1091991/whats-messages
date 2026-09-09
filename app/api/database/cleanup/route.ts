import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { retentionDays = 90 } = await request.json()

    // Calculate the cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    const cutoffTimestamp = cutoffDate.toISOString()

    console.log(`[v0] Starting database cleanup. Retention: ${retentionDays} days, Cutoff: ${cutoffTimestamp}`)

    const results = {
      webhookMessages: 0,
      messageHistory: 0,
      scheduledMessages: 0,
      uploadedMedia: 0,
      errors: [] as string[],
    }

    // 1. Delete old webhook messages
    try {
      const { data: oldWebhookMessages, error: webhookError } = await supabase
        .from("webhook_messages")
        .delete()
        .lt("created_at", cutoffTimestamp)
        .select("id")

      if (webhookError) throw webhookError
      results.webhookMessages = oldWebhookMessages?.length || 0
      console.log(`[v0] Deleted ${results.webhookMessages} old webhook messages`)
    } catch (error: any) {
      results.errors.push(`Webhook messages: ${error.message}`)
    }

    // 2. Delete old message history
    try {
      const { data: oldMessageHistory, error: historyError } = await supabase
        .from("message_history")
        .delete()
        .lt("created_at", cutoffTimestamp)
        .select("id")

      if (historyError) throw historyError
      results.messageHistory = oldMessageHistory?.length || 0
      console.log(`[v0] Deleted ${results.messageHistory} old message history records`)
    } catch (error: any) {
      results.errors.push(`Message history: ${error.message}`)
    }

    // 3. Delete old completed/failed scheduled messages
    try {
      const { data: oldScheduledMessages, error: scheduledError } = await supabase
        .from("scheduled_messages")
        .delete()
        .lt("created_at", cutoffTimestamp)
        .in("status", ["completed", "failed"])
        .select("id")

      if (scheduledError) throw scheduledError
      results.scheduledMessages = oldScheduledMessages?.length || 0
      console.log(`[v0] Deleted ${results.scheduledMessages} old scheduled messages`)
    } catch (error: any) {
      results.errors.push(`Scheduled messages: ${error.message}`)
    }

    // 4. Delete old uploaded media
    try {
      const { data: oldMedia, error: mediaError } = await supabase
        .from("uploaded_media")
        .delete()
        .lt("created_at", cutoffTimestamp)
        .select("id")

      if (mediaError) throw mediaError
      results.uploadedMedia = oldMedia?.length || 0
      console.log(`[v0] Deleted ${results.uploadedMedia} old uploaded media records`)
    } catch (error: any) {
      results.errors.push(`Uploaded media: ${error.message}`)
    }

    const totalDeleted =
      results.webhookMessages + results.messageHistory + results.scheduledMessages + results.uploadedMedia

    console.log(`[v0] Cleanup complete. Total records deleted: ${totalDeleted}`)

    return NextResponse.json({
      success: true,
      message: `تم حذف ${totalDeleted} سجل قديم بنجاح`,
      results,
      retentionDays,
      cutoffDate: cutoffTimestamp,
    })
  } catch (error: any) {
    console.error("[v0] Database cleanup error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "فشل تنظيف قاعدة البيانات",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
