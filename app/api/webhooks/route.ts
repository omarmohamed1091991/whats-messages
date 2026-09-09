import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

async function fetchMediaAsDataUrl(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    console.log("[v0] جلب رابط الوسائط للمعرف:", mediaId)

    // الخطوة 1: جلب معلومات الوسائط من WhatsApp
    const mediaInfoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!mediaInfoResponse.ok) {
      console.error("[v0] فشل جلب معلومات الوسائط:", await mediaInfoResponse.text())
      return null
    }

    const mediaInfo = await mediaInfoResponse.json()
    const mediaUrl = mediaInfo.url

    if (!mediaUrl) {
      console.error("[v0] لا يوجد رابط في استجابة معلومات الوسائط")
      return null
    }

    console.log("[v0] تم جلب رابط الوسائط:", mediaUrl)

    // الخطوة 2: تحميل ملف الوسائط
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!mediaResponse.ok) {
      console.error("[v0] فشل تحميل ملف الوسائط:", await mediaResponse.text())
      return null
    }

    // الخطوة 3: تحويل الملف إلى base64
    const mediaBuffer = await mediaResponse.arrayBuffer()
    const base64 = Buffer.from(mediaBuffer).toString("base64")
    const mimeType = mediaResponse.headers.get("content-type") || "application/octet-stream"
    const dataUrl = `data:${mimeType};base64,${base64}`

    console.log("[v0] تم تحويل الوسائط إلى data URL بنجاح - النوع:", mimeType, "الحجم:", mediaBuffer.byteLength, "بايت")
    return dataUrl
  } catch (error) {
    console.error("[v0] خطأ في جلب الوسائط:", error)
    return null
  }
}

// GET request for webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  console.log("[v0] Webhook verification request:", { mode, token, challenge })

  if (!mode || !token || !challenge) {
    console.error("[v0] Missing required parameters:", { mode, token, challenge })
    return NextResponse.json(
      { error: "Missing required parameters: hub.mode, hub.verify_token, or hub.challenge" },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data: settingsData, error: dbError } = await supabase
    .from("api_settings")
    .select("webhook_verify_token")
    .limit(1)

  if (dbError) {
    console.error("[v0] Database error:", dbError)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  const settings = settingsData?.[0]
  const verifyToken = settings?.webhook_verify_token

  if (!verifyToken) {
    console.error("[v0] No webhook_verify_token found in database")
    return NextResponse.json({ error: "Webhook verify token not configured" }, { status: 403 })
  }

  console.log("[v0] Comparing tokens - Received:", token, "Expected:", verifyToken)

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[v0] Webhook verified successfully, returning challenge:", challenge)
    return new NextResponse(challenge, { status: 200 })
  } else {
    console.error("[v0] Webhook verification failed - Mode:", mode, "Token match:", token === verifyToken)
    return NextResponse.json(
      {
        error: "Verification failed",
        details: {
          modeValid: mode === "subscribe",
          tokenMatch: token === verifyToken,
        },
      },
      { status: 403 },
    )
  }
}

// POST request for receiving webhook events
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[v0] Webhook received:", JSON.stringify(body, null, 2))

    const supabase = await createClient()

    const { data: settingsData } = await supabase.from("api_settings").select("access_token").limit(1)
    const accessToken = settingsData?.[0]?.access_token

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === "messages") {
            const value = change.value

            for (const message of value.messages || []) {
              let mediaUrl: string | null = null
              let mediaMimeType: string | null = null // تغيير من const إلى let
              let mediaId: string | null = null

              // استخراج media ID ونوع MIME حسب نوع الرسالة
              if (message.image?.id) {
                mediaId = message.image.id
                mediaMimeType = message.image.mime_type || "image/jpeg"
                // للصور، نحولها إلى data URL
                if (accessToken) {
                  console.log("[v0] Fetching image media...")
                  mediaUrl = await fetchMediaAsDataUrl(mediaId, accessToken)
                }
              } else if (message.video?.id) {
                mediaId = message.video.id
                mediaMimeType = message.video.mime_type || "video/mp4"
              } else if (message.document?.id) {
                mediaId = message.document.id
                mediaMimeType = message.document.mime_type || "application/pdf"
              } else if (message.audio?.id) {
                mediaId = message.audio.id
                mediaMimeType = message.audio.mime_type || "audio/ogg; codecs=opus"
                console.log("[v0] Audio message detected - ID:", mediaId, "MIME:", mediaMimeType)
                // لا نحول الصوت إلى data URL لأنه كبير الحجم
                // سيتم جلب الرابط عند العرض
              } else if (message.sticker?.id) {
                mediaId = message.sticker.id
                mediaMimeType = message.sticker.mime_type || "image/webp"
              }

              let messageText: string | null = null
              const messageType = message.type

              console.log("[v0] Processing message type:", messageType, "Media ID:", mediaId, "MIME:", mediaMimeType)

              // استخراج النص حسب نوع الرسالة
              if (message.type === "text" && message.text?.body) {
                messageText = message.text.body
                console.log("[v0] Text message extracted:", messageText)
              } else if (message.type === "interactive" && message.interactive) {
                if (message.interactive.button_reply) {
                  messageText = message.interactive.button_reply.title
                  console.log("[v0] Interactive button reply:", messageText)
                } else if (message.interactive.list_reply) {
                  messageText = message.interactive.list_reply.title
                  console.log("[v0] Interactive list reply:", messageText)
                } else if (message.interactive.nfm_reply) {
                  try {
                    const nfmData = JSON.parse(message.interactive.nfm_reply.response_json || "{}")
                    messageText = nfmData.flow_token || "رد من نموذج"
                    console.log("[v0] Interactive NFM reply:", messageText)
                  } catch {
                    messageText = "رد من نموذج"
                  }
                }
              } else if (message.type === "reaction" && message.reaction) {
                messageText = `${message.reaction.emoji} تفاعل`
                console.log("[v0] Reaction:", messageText)
              } else if (message.type === "location" && message.location) {
                messageText = message.location.name || message.location.address || "📍 موقع جغرافي"
                console.log("[v0] Location:", messageText)
              } else if (message.type === "contacts" && message.contacts) {
                const contactName = message.contacts[0]?.name?.formatted_name || "جهة اتصال"
                messageText = `👤 ${contactName}`
                console.log("[v0] Contact:", messageText)
              } else if (message.type === "image" && message.image?.caption) {
                messageText = message.image.caption
                console.log("[v0] Image caption:", messageText)
              } else if (message.type === "video" && message.video?.caption) {
                messageText = message.video.caption
                console.log("[v0] Video caption:", messageText)
              } else if (message.type === "document" && message.document) {
                messageText = message.document.filename || message.document.caption || "📄 مستند"
                console.log("[v0] Document:", messageText)
              } else if (message.type === "audio") {
                messageText = "🎤 رسالة صوتية"
                console.log("[v0] Audio message")
              } else if (message.type === "sticker") {
                messageText = "🎨 ملصق"
                console.log("[v0] Sticker")
              }

              // إذا لم نتمكن من استخراج أي نص، حاول البحث في حقول أخرى
              if (!messageText || messageText.trim() === "") {
                console.log("[v0] No text extracted, checking alternative fields...")

                if (message.body) {
                  messageText = message.body
                } else if (message.caption) {
                  messageText = message.caption
                } else if (typeof message === "string") {
                  messageText = message
                }

                // حاول تحليل JSON إذا كان النص يبدو كـ JSON
                if (messageText && messageText.trim().startsWith("{")) {
                  try {
                    const parsed = JSON.parse(messageText)
                    messageText =
                      parsed.message || parsed.text || parsed.body || parsed.content || parsed.reply || messageText
                  } catch {
                    // ليس JSON صالح، احتفظ بالنص كما هو
                  }
                }
              }

              console.log("[v0] Final extracted message text:", messageText)

              const messageData = {
                message_id: message.id,
                from_number: message.from,
                from_name: value.contacts?.[0]?.profile?.name || "Unknown",
                message_type: messageType,
                message_text: messageText,
                message_media_url: mediaUrl || mediaId, // تخزين media ID إذا لم يكن هناك data URL
                message_media_mime_type: mediaMimeType,
                timestamp: Number.parseInt(message.timestamp),
                status: "unread",
                replied: false,
              }

              console.log("[v0] Storing message with media data:", {
                type: messageType,
                hasMediaUrl: !!mediaUrl,
                hasMediaId: !!mediaId,
                mimeType: mediaMimeType,
              })

              const { error } = await supabase.from("webhook_messages").insert(messageData)

              if (error) {
                console.error("[v0] Error inserting message:", error)
              } else {
                console.log("[v0] Message stored successfully:", messageData.message_id)

                const normalizedPhone = normalizePhoneNumber(message.from)
                const contactName = value.contacts?.[0]?.profile?.name || message.from

                let lastMessageText: string

                if (messageText && messageText.trim()) {
                  lastMessageText = messageText
                } else if (mediaUrl) {
                  if (messageType === "image") lastMessageText = "📷 صورة"
                  else if (messageType === "video") lastMessageText = "🎥 فيديو"
                  else if (messageType === "audio") lastMessageText = "🎤 رسالة صوتية"
                  else if (messageType === "document") lastMessageText = "📄 مستند"
                  else if (messageType === "sticker") lastMessageText = "🎨 ملصق"
                  else lastMessageText = "📎 وسائط"
                } else {
                  lastMessageText = `رسالة ${messageType}`
                }

                console.log("[v0] Last message text for conversation:", lastMessageText)

                const { data: existingConv } = await supabase
                  .from("conversations")
                  .select("*")
                  .eq("phone_number", normalizedPhone)
                  .single()

                if (existingConv) {
                  await supabase
                    .from("conversations")
                    .update({
                      contact_name: contactName,
                      last_message_text: lastMessageText,
                      last_message_time: new Date(Number.parseInt(message.timestamp) * 1000).toISOString(),
                      last_message_is_outgoing: false,
                      unread_count: (existingConv.unread_count || 0) + 1,
                      has_incoming_messages: true,
                    })
                    .eq("phone_number", normalizedPhone)
                } else {
                  await supabase.from("conversations").insert({
                    phone_number: normalizedPhone,
                    contact_name: contactName,
                    last_message_text: lastMessageText,
                    last_message_time: new Date(Number.parseInt(message.timestamp) * 1000).toISOString(),
                    last_message_is_outgoing: false,
                    unread_count: 1,
                    has_incoming_messages: true,
                    has_replies: false,
                  })
                }
              }
            }

            for (const status of value.statuses || []) {
              console.log("[v0] Message status update:", {
                id: status.id,
                status: status.status,
                timestamp: status.timestamp,
              })

              await supabase
                .from("message_history")
                .update({
                  status: status.status,
                })
                .eq("message_id", status.id)
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[v0] Error processing webhook:", error)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 200 })
  }
}
