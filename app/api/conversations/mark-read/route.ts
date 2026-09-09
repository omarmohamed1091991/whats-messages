import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/\D/g, "")

    console.log("[v0] وضع علامة مقروء على المحادثة:", normalizedPhone)

    // Mark all unread messages from this number as replied
    const { error: msgError } = await supabase
      .from("webhook_messages")
      .update({ replied: true })
      .eq("from_number", normalizedPhone)
      .eq("replied", false)

    if (msgError) {
      console.error("[v0] خطأ في تحديث الرسائل:", msgError)
      return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 })
    }

    console.log("[v0] ✅ تم وضع علامة مقروء بنجاح")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] خطأ في وضع علامة مقروء على المحادثة:", error)
    return NextResponse.json({ error: "Failed to mark conversation as read" }, { status: 500 })
  }
}
