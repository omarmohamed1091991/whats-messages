"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Trash2, Database, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function DatabaseCleanupDialog() {
  const [open, setOpen] = useState(false)
  const [retentionDays, setRetentionDays] = useState(90)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [result, setResult] = useState<any>(null)

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/database/stats")
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  const handleCleanup = async () => {
    if (!confirm(`هل أنت متأكد من حذف البيانات الأقدم من ${retentionDays} يوم؟`)) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/database/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        // Refresh stats after cleanup
        await fetchStats()
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: "فشل تنظيف قاعدة البيانات",
        details: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (isOpen) {
          fetchStats()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Database className="h-4 w-4" />
          تنظيف قاعدة البيانات
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>تنظيف قاعدة البيانات</DialogTitle>
          <DialogDescription>احذف البيانات القديمة لتقليل استهلاك التخزين وتحسين الأداء</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {stats && (
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-medium text-sm">إحصائيات قاعدة البيانات</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>رسائل واردة:</div>
                <div className="font-mono">{stats.webhookMessages.toLocaleString()}</div>
                <div>سجل الرسائل:</div>
                <div className="font-mono">{stats.messageHistory.toLocaleString()}</div>
                <div>رسائل مجدولة:</div>
                <div className="font-mono">{stats.scheduledMessages.toLocaleString()}</div>
                <div>ملفات الوسائط:</div>
                <div className="font-mono">{stats.uploadedMedia.toLocaleString()}</div>
                <div className="font-semibold">المجموع:</div>
                <div className="font-mono font-semibold">{stats.total.toLocaleString()}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="retention">الاحتفاظ بالبيانات (بالأيام)</Label>
            <Input
              id="retention"
              type="number"
              min="1"
              max="365"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number.parseInt(e.target.value) || 90)}
              placeholder="90"
            />
            <p className="text-sm text-muted-foreground">سيتم حذف جميع البيانات الأقدم من {retentionDays} يوم</p>
          </div>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <AlertDescription>
                {result.success ? (
                  <div className="space-y-1">
                    <p className="font-medium">{result.message}</p>
                    <ul className="text-sm space-y-1 mt-2">
                      <li>• رسائل واردة: {result.results.webhookMessages}</li>
                      <li>• سجل الرسائل: {result.results.messageHistory}</li>
                      <li>• رسائل مجدولة: {result.results.scheduledMessages}</li>
                      <li>• ملفات الوسائط: {result.results.uploadedMedia}</li>
                    </ul>
                    {result.results.errors.length > 0 && (
                      <div className="mt-2 text-sm text-yellow-600">
                        <p>تحذيرات:</p>
                        <ul>
                          {result.results.errors.map((err: string, i: number) => (
                            <li key={i}>• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">{result.error}</p>
                    {result.details && <p className="text-sm mt-1">{result.details}</p>}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button onClick={handleCleanup} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التنظيف...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                تنظيف الآن
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
