"use client"
import { useState, useEffect } from "react"
import type { Conversation } from "@/types/conversation"

export const dynamic = "force-dynamic"

const WhatsAppInbox = () => {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showChat, setShowChat] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const [viewedConversations, setViewedConversations] = useState<Set<string>>(new Set())

  useEffect(() => {
    const viewedConversations = localStorage.getItem("viewedConversations")
    if (viewedConversations) {
      setViewedConversations(new Set(JSON.parse(viewedConversations)))
    }
  }, [])

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setShowSearchSuggestions(false)
    setSearchQuery("")
    setShowChat(true)
    setFailedImages(new Set())
    if (typeof window !== "undefined") {
      const updatedViewedConversations = new Set(viewedConversations)
      updatedViewedConversations.add(conversation.phone_number)
      localStorage.setItem("viewedConversations", JSON.stringify([...updatedViewedConversations]))
      setViewedConversations(updatedViewedConversations)

      if (conversation.unread_count > 0) {
        fetch("/api/conversations/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: conversation.phone_number }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              console.log("[v0] ✅ تم وضع علامة مقروء على المحادثة")
            }
          })
          .catch((error) => {
            console.error("[v0] خطأ في وضع علامة مقروء:", error)
          })
      }
    }
  }

  return <div>{/* Inbox UI code here */}</div>
}

export default WhatsAppInbox
