import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: settings, error: settingsError } = await supabase
      .from("api_settings")
      .select("access_token, phone_number_id")
      .limit(1)
      .single()

    if (settingsError || !settings) {
      console.error("[v0] Failed to fetch settings:", settingsError)
      return NextResponse.json(
        {
          error: "Settings not configured",
          isActive: false,
          accountMode: "UNKNOWN",
          qualityRating: "UNKNOWN",
        },
        { status: 200 },
      )
    }

    const { access_token: accessToken, phone_number_id: phoneNumberId } = settings

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        {
          error: "Missing credentials in settings",
          isActive: false,
          accountMode: "UNKNOWN",
          qualityRating: "UNKNOWN",
        },
        { status: 200 },
      )
    }

    // جلب معلومات رقم الهاتف للتحقق من حالة الحساب
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=account_mode,quality_rating`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

    if (!response.ok) {
      console.error("[v0] Failed to fetch account status:", await response.text())
      return NextResponse.json(
        {
          error: "Failed to fetch account status",
          isActive: false,
          accountMode: "UNKNOWN",
          qualityRating: "UNKNOWN",
        },
        { status: 200 },
      )
    }

    const data = await response.json()

    // تحديد حالة الحساب بناءً على البيانات المستلمة
    // account_mode: "LIVE" يعني الحساب نشط
    // quality_rating: "GREEN", "YELLOW", "RED" تشير إلى جودة الحساب
    const isActive = data.account_mode === "LIVE" || data.account_mode === "live"
    const qualityRating = data.quality_rating || "UNKNOWN"

    // إذا كان التقييم أحمر أو الحساب غير نشط، نعتبر أن هناك مشكلة
    const hasIssues = qualityRating === "RED" || !isActive

    return NextResponse.json({
      isActive: !hasIssues,
      accountMode: data.account_mode,
      qualityRating: qualityRating,
    })
  } catch (error) {
    console.error("[v0] Error fetching account status:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        isActive: false,
        accountMode: "UNKNOWN",
        qualityRating: "UNKNOWN",
      },
      { status: 200 },
    )
  }
}
