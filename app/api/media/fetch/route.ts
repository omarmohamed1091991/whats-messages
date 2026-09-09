import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { mediaId } = await request.json()

    if (!mediaId) {
      return NextResponse.json({ error: "Media ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: settingsData } = await supabase.from("api_settings").select("access_token").limit(1)
    const accessToken = settingsData?.[0]?.access_token

    if (!accessToken) {
      return NextResponse.json({ error: "Access token not found" }, { status: 500 })
    }

    console.log("[v0] Fetching media URL for ID:", mediaId)

    // جلب معلومات الوسائط من WhatsApp
    const mediaInfoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!mediaInfoResponse.ok) {
      const errorText = await mediaInfoResponse.text()
      console.error("[v0] Failed to fetch media info:", errorText)
      return NextResponse.json({ error: "Failed to fetch media info" }, { status: 500 })
    }

    const mediaInfo = await mediaInfoResponse.json()
    console.log("[v0] Media URL fetched successfully:", mediaInfo.url)

    return NextResponse.json({
      url: mediaInfo.url,
      mimeType: mediaInfo.mime_type,
    })
  } catch (error) {
    console.error("[v0] Error fetching media:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
