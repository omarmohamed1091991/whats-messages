"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { MessageSquare, Send, Settings, Inbox, Clock, Menu, ImageIcon, MessageSquarePlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { MediaLibraryDialog } from "@/components/media-library-dialog"

const navItems = [
  {
    title: "لوحة التحكم",
    href: "/",
    icon: MessageSquare,
  },
  {
    title: "رسائل حرة",
    href: "/free-messages",
    icon: MessageSquarePlus,
  },
  {
    title: "رسالة واحدة",
    href: "/single-message",
    icon: Send,
  },
  {
    title: "رسائل جماعية",
    href: "/bulk-messages",
    icon: Send,
  },
  {
    title: "الرسائل المجدولة",
    href: "/scheduled-messages",
    icon: Clock,
  },
  {
    title: "صندوق الوارد",
    href: "/inbox",
    icon: Inbox,
  },
  {
    title: "الإعدادات",
    href: "/settings",
    icon: Settings,
  },
]

export function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [accountStatus, setAccountStatus] = useState<{ isActive: boolean; qualityRating: string } | null>(null)

  useEffect(() => {
    const fetchAccountStatus = async () => {
      try {
        const response = await fetch("/api/account-status")
        if (response.ok) {
          const data = await response.json()
          setAccountStatus(data)
        }
      } catch (error) {
        console.error("[v0] Error fetching account status:", error)
      }
    }

    fetchAccountStatus()
    const interval = setInterval(fetchAccountStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Image
                src="/logo.png"
                alt="Rose Smile Makkah"
                width={40}
                height={40}
                className="h-8 w-8 sm:h-10 sm:w-10"
              />
              <span className="text-lg sm:text-xl font-bold text-primary">Rose Smile</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                const isDashboard = item.href === "/"

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 xl:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden xl:inline">{item.title}</span>
                    {isDashboard && accountStatus && (
                      <span
                        className={cn("h-2 w-2 rounded-full", accountStatus.isActive ? "bg-green-500" : "bg-red-500")}
                        title={accountStatus.isActive ? "الحساب نشط" : "الحساب معطل - يرجى التحقق من حالة الدفع"}
                      />
                    )}
                  </Link>
                )
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMediaLibraryOpen(true)}
                className="flex items-center gap-2 rounded-lg px-3 xl:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="hidden xl:inline">مكتبة الصور</span>
              </Button>
            </div>

            {/* Mobile Menu */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">فتح القائمة</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="text-right">القائمة</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-6">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    const isDashboard = item.href === "/"

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
                          isActive
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.title}
                        {isDashboard && accountStatus && (
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full mr-auto",
                              accountStatus.isActive ? "bg-green-500" : "bg-red-500",
                            )}
                            title={accountStatus.isActive ? "الحساب نشط" : "الحساب معطل - يرجى التحقق من حالة الدفع"}
                          />
                        )}
                      </Link>
                    )
                  })}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setOpen(false)
                      setMediaLibraryOpen(true)
                    }}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground justify-start"
                  >
                    <ImageIcon className="h-5 w-5" />
                    مكتبة الصور
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Media Library Dialog */}
      <MediaLibraryDialog open={mediaLibraryOpen} onOpenChange={setMediaLibraryOpen} />
    </>
  )
}
