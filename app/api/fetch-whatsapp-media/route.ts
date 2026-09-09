import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mediaId = searchParams.get("mediaId")

    if (!mediaId) {
      return NextResponse.json({ error: "Media ID is required" }, { status: 400 })
    }

    console.log("[v0] Fetching media for ID:", mediaId)

    const supabase = await createClient()
    const { data: settings, error: settingsError } = await supabase.from("api_settings").select("*").single()

    if (settingsError) {
      console.error("[v0] Error fetching settings:", settingsError)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    if (!settings?.access_token || !settings?.phone_number_id) {
      console.error("[v0] WhatsApp not configured")
      return NextResponse.json({ error: "WhatsApp not configured" }, { status: 500 })
    }

    console.log("[v0] Fetching media info from WhatsApp API")
    const mediaInfoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!mediaInfoResponse.ok) {
      const errorText = await mediaInfoResponse.text()
      console.error("[v0] Failed to fetch media info:", errorText)
      return NextResponse.json({ error: "Failed to fetch media info" }, { status: 500 })
    }

    const mediaInfo = await mediaInfoResponse.json()
    console.log("[v0] Media info:", mediaInfo)
    const mediaUrl = mediaInfo.url

    if (!mediaUrl) {
      console.error("[v0] Media URL not found in response")
      return NextResponse.json({ error: "Media URL not found" }, { status: 404 })
    }

    console.log("[v0] Downloading image from:", mediaUrl)
    const imageResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${settings.access_token}`,
      },
    })

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text()
      console.error("[v0] Failed to download image:", errorText)
      return NextResponse.json({ error: "Failed to download image" }, { status: 500 })
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString("base64")
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg"
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    console.log("[v0] Successfully fetched and converted image")
    return NextResponse.json({ dataUrl, mimeType })
  } catch (error) {
    console.error("[v0] Error fetching WhatsApp media:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch media" },
      { status: 500 },
    )
  }
}
