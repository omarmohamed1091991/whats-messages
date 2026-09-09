import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWhatsAppApiUrl } from "@/lib/whatsapp-config"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const image = formData.get("image") as File
    const toNumber = formData.get("toNumber") as string
    const caption = formData.get("caption") as string | null

    if (!image || !toNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // جلب إعدادات API
    const { data: settingsData, error: settingsError } = await supabase.from("api_settings").select("*").limit(1)
    const settings = settingsData?.[0]

    if (settingsError || !settings) {
      console.error("[v0] Error fetching API settings:", settingsError)
      return NextResponse.json({ error: "API settings not configured" }, { status: 500 })
    }

    // رفع الصورة إلى WhatsApp
    const uploadFormData = new FormData()
    uploadFormData.append("file", image)
    uploadFormData.append("messaging_product", "whatsapp")
    uploadFormData.append("type", image.type)

    const uploadUrl = `${getWhatsAppApiUrl(settings.phone_number_id).replace("/messages", "")}/media`
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
      body: uploadFormData,
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json()
      console.error("[v0] WhatsApp media upload error:", error)
      return NextResponse.json(
        { error: error.error?.message || "Failed to upload image" },
        { status: uploadResponse.status },
      )
    }

    const uploadData = await uploadResponse.json()
    const mediaId = uploadData.id

    // إرسال الرسالة مع الصورة
    const messageUrl = `${getWhatsAppApiUrl(settings.phone_number_id)}/messages`
    const messageBody: any = {
      messaging_product: "whatsapp",
      to: toNumber,
      type: "image",
      image: {
        id: mediaId,
      },
    }

    if (caption) {
      messageBody.image.caption = caption
    }

    const messageResponse = await fetch(messageUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageBody),
    })

    if (!messageResponse.ok) {
      const error = await messageResponse.json()
      console.error("[v0] WhatsApp message send error:", error)
      return NextResponse.json(
        { error: error.error?.message || "Failed to send message" },
        { status: messageResponse.status },
      )
    }

    const messageData = await messageResponse.json()
    const sentMessageId = messageData.messages?.[0]?.id

    // حفظ الرسالة في قاعدة البيانات
    await supabase.from("message_history").insert({
      message_id: sentMessageId,
      to_number: toNumber,
      message_text: caption || null,
      message_type: "reply",
      media_url: mediaId,
      status: "sent",
    })

    return NextResponse.json({ success: true, messageId: sentMessageId, mediaId })
  } catch (error) {
    console.error("[v0] Error sending image:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
