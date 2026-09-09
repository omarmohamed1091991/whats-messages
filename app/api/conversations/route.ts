import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

function extractMessageText(message: any): string {
  let messageText = message.message_text || ""

  // إذا كان النص فارغاً، حاول استخراجه من حقول أخرى
  if (!messageText || messageText.trim() === "") {
    // تحقق من وجود نص في حقول أخرى
    if (message.text) {
      messageText = message.text
    } else if (message.body) {
      messageText = message.body
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
        messageText
    } catch {
      // إذا لم يكن JSON صالح، استخدم النص كما هو
    }
  }

  console.log("[v0] Extracted message text:", {
    original: message.message_text,
    extracted: messageText,
    messageType: message.message_type,
  })

  return messageText
}

export async function GET() {
  const supabase = await createClient()
  return await buildConversationsDynamically(supabase)
}

async function buildConversationsDynamically(supabase: any) {
  try {
    // Fetch incoming messages
    const { data: incomingMessages, error: incomingError } = await supabase
      .from("webhook_messages")
      .select("*")
      .order("timestamp", { ascending: false })

    if (incomingError) {
      console.error("[v0] Error fetching incoming messages:", incomingError)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    // Fetch sent messages
    const { data: sentMessages, error: sentError } = await supabase
      .from("message_history")
      .select("*")
      .order("created_at", { ascending: false })

    if (sentError) {
      console.error("[v0] Error fetching sent messages:", sentError.message)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    const conversationsMap = new Map()

    if (incomingMessages) {
      for (const message of incomingMessages) {
        const normalizedPhone = normalizePhoneNumber(message.from_number)
        const messageTime = message.timestamp
          ? new Date(
              typeof message.timestamp === "number" ? message.timestamp * 1000 : Number.parseInt(message.timestamp),
            )
          : new Date(message.created_at)

        const messageText = extractMessageText(message)

        if (!conversationsMap.has(normalizedPhone)) {
          conversationsMap.set(normalizedPhone, {
            phone_number: message.from_number,
            contact_name: message.from_name || message.from_number,
            last_message_text: messageText,
            last_message_type: message.message_type || "text",
            last_message_media_url: message.message_media_url || null,
            last_message_time: messageTime.toISOString(),
            last_message_is_outgoing: false,
            unread_count: message.replied ? 0 : 1,
            has_incoming_messages: true,
            has_replies: false,
            is_read: message.replied || false,
            updated_at: messageTime.toISOString(),
          })
        } else {
          const conv = conversationsMap.get(normalizedPhone)
          conv.has_incoming_messages = true
          if (!message.replied) {
            conv.unread_count = (conv.unread_count || 0) + 1
          }
          if (messageTime > new Date(conv.last_message_time)) {
            conv.last_message_text = messageText
            conv.last_message_type = message.message_type || "text"
            conv.last_message_media_url = message.message_media_url || null
            conv.last_message_time = messageTime.toISOString()
            conv.last_message_is_outgoing = false
            conv.updated_at = messageTime.toISOString()
          }
        }
      }
    }

    if (sentMessages) {
      for (const message of sentMessages) {
        const normalizedPhone = normalizePhoneNumber(message.to_number)
        const messageTime = new Date(message.created_at)

        if (!conversationsMap.has(normalizedPhone)) {
          conversationsMap.set(normalizedPhone, {
            phone_number: message.to_number,
            contact_name: message.to_number,
            last_message_text: message.message_text || "",
            last_message_type: message.media_id || message.image_url ? "image" : "text",
            last_message_media_url: message.image_url || null,
            last_message_time: messageTime.toISOString(),
            last_message_is_outgoing: true,
            unread_count: 0,
            has_incoming_messages: false,
            has_replies: true,
            is_read: true,
            updated_at: messageTime.toISOString(),
          })
        } else {
          const conv = conversationsMap.get(normalizedPhone)
          conv.has_replies = true
          if (messageTime > new Date(conv.last_message_time)) {
            conv.last_message_text = message.message_text || ""
            conv.last_message_type = message.media_id || message.image_url ? "image" : "text"
            conv.last_message_media_url = message.image_url || null
            conv.last_message_time = messageTime.toISOString()
            conv.last_message_is_outgoing = true
            conv.updated_at = messageTime.toISOString()
          }
        }
      }
    }

    // Convert map to array and sort by updated_at
    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )

    return NextResponse.json({ conversations }, { status: 200 })
  } catch (error) {
    console.error("[v0] Unexpected error building conversations dynamically:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
