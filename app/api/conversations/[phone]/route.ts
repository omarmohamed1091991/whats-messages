import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  // إزالة جميع الأحرف غير الرقمية (المسافات، الشرطات، الأقواس، +)
  const cleaned = phone.replace(/\D/g, "")
  return cleaned
}

function extractMessageText(message: any): string {
  let messageText = message.message_text || ""

  // إذا كان النص فارغاً، حاول استخراجه من حقول أخرى
  if (!messageText || messageText.trim() === "") {
    if (message.text) {
      messageText = message.text
    } else if (message.body) {
      messageText = message.body
    } else if (message.caption) {
      messageText = message.caption
    }
  }

  // إذا كان النص يحتوي على JSON، حاول استخراج المحتوى
  if (messageText && messageText.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(messageText)
      messageText =
        parsed.message ||
        parsed.text ||
        parsed.body ||
        parsed.content ||
        parsed.reply ||
        parsed.button_reply?.title ||
        parsed.list_reply?.title ||
        parsed.interactive?.button_reply?.title ||
        parsed.interactive?.list_reply?.title ||
        messageText
    } catch {
      // إذا لم يكن JSON صالح، استخدم النص كما هو
    }
  }

  // إذا لم يكن هناك نص، استخدم وصف حسب نوع الرسالة
  if (!messageText || messageText.trim() === "") {
    const messageType = message.message_type
    if (messageType === "image") messageText = "📷 صورة"
    else if (messageType === "video") messageText = "🎥 فيديو"
    else if (messageType === "audio" || messageType === "voice") messageText = "🎤 رسالة صوتية"
    else if (messageType === "document") messageText = "📄 مستند"
    else if (messageType === "sticker") messageText = "🎨 ملصق"
    else if (messageType === "location") messageText = "📍 موقع"
    else if (messageType === "contact") messageText = "👤 جهة اتصال"
    else if (message.message_media_url) messageText = "📎 وسائط"
  }

  return messageText
}

export async function GET(request: Request, { params }: { params: { phone: string } }) {
  try {
    const { phone } = params
    const supabase = await createClient()

    const normalizedPhone = normalizePhoneNumber(phone)

    console.log("[v0] Fetching messages for phone:", normalizedPhone)

    const { data: incomingMessages, error: incomingError } = await supabase
      .from("webhook_messages")
      .select("*")
      .eq("from_number", normalizedPhone)
      .order("created_at", { ascending: true })

    if (incomingError) {
      console.error("[v0] Error fetching incoming messages:", incomingError)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    console.log("[v0] Found incoming messages:", incomingMessages?.length || 0)

    const { data: sentReplies, error: sentError } = await supabase
      .from("message_history")
      .select("*")
      .eq("to_number", normalizedPhone)
      .order("created_at", { ascending: true })

    if (sentError) {
      console.error("[v0] Error fetching sent replies:", sentError)
      return NextResponse.json({ error: "Failed to fetch sent replies" }, { status: 500 })
    }

    console.log("[v0] Found sent messages:", sentReplies?.length || 0)

    const allMessages = [
      ...(incomingMessages || []).map((msg) => ({
        id: msg.id,
        type: "incoming" as const,
        timestamp: msg.created_at,
        message_text: extractMessageText(msg),
        message_type: msg.message_type,
        from_number: msg.from_number,
        contact_name: msg.contact_name,
        status: msg.status,
        replied: msg.replied,
        message_media_url: msg.message_media_url,
        message_media_mime_type: msg.message_media_mime_type,
      })),
      ...(sentReplies || []).map((msg) => ({
        id: msg.id,
        type: "outgoing" as const,
        timestamp: msg.created_at,
        message_text: msg.message_text || msg.template_body || "",
        message_type: msg.message_type || (msg.media_id || msg.image_url ? "image" : "text"),
        to_number: msg.to_number,
        status: msg.status,
        template_name: msg.template_name,
        message_media_url: msg.media_url || msg.image_url,
        message_media_mime_type: msg.media_mime_type,
      })),
    ].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeA - timeB
    })

    console.log("[v0] Total messages in conversation:", allMessages.length)

    return NextResponse.json({ messages: allMessages })
  } catch (error) {
    console.error("[v0] Error in conversation GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { phone: string } }) {
  try {
    const { phone } = params
    const supabase = await createClient()

    const normalizedPhone = normalizePhoneNumber(phone)

    const { data: unreadMessages, error: fetchError } = await supabase
      .from("webhook_messages")
      .select("*")
      .eq("status", "unread")

    if (fetchError) {
      console.error("[v0] Error fetching unread messages:", fetchError)
      return NextResponse.json({ error: "Failed to fetch unread messages" }, { status: 500 })
    }

    const messagesToUpdate = unreadMessages?.filter((msg) => normalizePhoneNumber(msg.from_number) === normalizedPhone)

    if (messagesToUpdate && messagesToUpdate.length > 0) {
      const messageIds = messagesToUpdate.map((msg) => msg.id)

      const { error } = await supabase.from("webhook_messages").update({ status: "read" }).in("id", messageIds)

      if (error) {
        console.error("[v0] Error marking messages as read:", error)
        return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in conversation PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
