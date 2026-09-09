"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatPhoneNumber, isValidWhatsAppNumber } from "@/lib/phone-formatter"
import { COUNTRY_CODES } from "@/lib/country-codes"
import { Send, Loader2, ImageIcon, VideoIcon, FileIcon, AlertTriangle, Upload } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { TokenExpiredAlert } from "@/components/token-expired-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RateLimitDisplay } from "@/components/rate-limit-display"
import { MediaGallery } from "@/components/media-gallery"
import { TemplateSelector } from "@/components/template-selector"

interface Template {
  id: string
  name: string
  language: string
  status: string
  category: string
  components: Array<{
    type: string
    format?: string
    text?: string
    example?: {
      header_handle?: string[]
      body_text?: string[][]
    }
  }>
}

interface TemplateParameters {
  mediaType?: "IMAGE" | "VIDEO" | "DOCUMENT"
  mediaInputType: "url" | "id"
  mediaValue: string
  bodyVariables: string[]
}

export function SingleMessageForm() {
  const [countryCode, setCountryCode] = useState("SA")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [formattedPhone, setFormattedPhone] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [templates, setTemplates] = useState<Template[]>([])
  const [messagePreview, setMessagePreview] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false)
  const { toast } = useToast()

  const [templateParams, setTemplateParams] = useState<TemplateParameters>({
    mediaInputType: "url",
    mediaValue: "",
    bodyVariables: [],
  })

  const [isTokenExpired, setIsTokenExpired] = useState(false)
  const [dailyLimitInfo, setDailyLimitInfo] = useState<{
    limit: number
    used: number
    remaining: number
    shouldWarn: boolean
  } | null>(null)

  const [hasInvalidMediaUrl, setHasInvalidMediaUrl] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)

  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null)

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value)
    if (value.trim()) {
      const formatted = formatPhoneNumber(value, countryCode)
      setFormattedPhone(formatted)
    } else {
      setFormattedPhone("")
    }
  }

  const handleCountryChange = (code: string) => {
    setCountryCode(code)
    if (phoneNumber.trim()) {
      const formatted = formatPhoneNumber(phoneNumber, code)
      setFormattedPhone(formatted)
    }
  }

  const fetchTemplates = async () => {
    setIsFetchingTemplates(true)
    setIsTokenExpired(false)
    try {
      const response = await fetch("/api/templates")

      if (response.status === 401) {
        const data = await response.json()
        if (data.errorType === "TOKEN_EXPIRED") {
          setIsTokenExpired(true)
          toast({
            title: "انتهت صلاحية رمز الوصول",
            description: "يرجى تحديث رمز الوصول (Access Token) في إعدادات المشروع",
            variant: "destructive",
          })
          return
        }
      }

      if (!response.ok) throw new Error("فشل في جلب القوالب")

      const data = await response.json()
      setTemplates(data.templates || [])
      toast({
        title: "تم جلب القوالب بنجاح",
        description: `تم العثور على ${data.templates?.length || 0} قالب`,
      })
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في جلب القوالب",
        variant: "destructive",
      })
    } finally {
      setIsFetchingTemplates(false)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      const bodyComponent = template.components.find((c) => c.type === "BODY")
      const bodyText = bodyComponent?.text || ""
      setMessagePreview(bodyText)

      const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g)
      const variableCount = variableMatches ? variableMatches.length : 0

      const headerComponent = template.components.find((c) => c.type === "HEADER")
      const mediaFormat = headerComponent?.format

      const validMediaType =
        mediaFormat === "IMAGE" || mediaFormat === "VIDEO" || mediaFormat === "DOCUMENT"
          ? (mediaFormat as "IMAGE" | "VIDEO" | "DOCUMENT")
          : undefined

      setTemplateParams({
        mediaType: validMediaType,
        mediaInputType: "url",
        mediaValue: "",
        bodyVariables: Array(variableCount).fill(""),
      })
      setHasInvalidMediaUrl(false)
      setSelectedImagePreview(null)
    }
  }

  const handleBodyVariableChange = (index: number, value: string) => {
    const newVariables = [...templateParams.bodyVariables]
    newVariables[index] = value
    setTemplateParams({ ...templateParams, bodyVariables: newVariables })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formattedPhone || !isValidWhatsAppNumber(formattedPhone)) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال رقم هاتف صحيح",
        variant: "destructive",
      })
      return
    }

    if (!selectedTemplate) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار قالب الرسالة",
        variant: "destructive",
      })
      return
    }

    if (templateParams.mediaType && !templateParams.mediaValue.trim()) {
      toast({
        title: "خطأ",
        description: `هذا القالب يحتاج إلى ${templateParams.mediaType === "IMAGE" ? "صورة" : templateParams.mediaType === "VIDEO" ? "فيديو" : "ملف"}`,
        variant: "destructive",
      })
      return
    }

    if (templateParams.mediaType && templateParams.mediaInputType === "url") {
      const url = templateParams.mediaValue.trim().toLowerCase()
      const validExtensions =
        templateParams.mediaType === "IMAGE"
          ? [".jpg", ".jpeg", ".png", ".gif", ".webp"]
          : templateParams.mediaType === "VIDEO"
            ? [".mp4", ".3gp", ".mov"]
            : [".pdf", ".doc", ".docx", ".xls", ".xlsx"]

      const hasValidExtension = validExtensions.some((ext) => url.endsWith(ext))

      if (!hasValidExtension) {
        toast({
          title: "خطأ في رابط الوسائط",
          description: `يجب أن يكون الرابط مباشراً للملف وينتهي بـ ${validExtensions.join(" أو ")}. الرابط الحالي يبدو أنه صفحة ويب وليس رابط مباشر للملف.`,
          variant: "destructive",
        })
        return
      }
    }

    if (templateParams.bodyVariables.some((v) => !v.trim())) {
      toast({
        title: "خطأ",
        description: "الرجاء ملء جميع المتغيرات المطلوبة",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setIsTokenExpired(false)
    try {
      const response = await fetch("/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          templateId: selectedTemplate,
          templateParams:
            templateParams.mediaType || templateParams.bodyVariables.length > 0 ? templateParams : undefined,
        }),
      })

      if (response.status === 429) {
        const data = await response.json()
        toast({
          title: "⚠️ تجاوز الحد اليومي",
          description: data.error,
          variant: "destructive",
          duration: 10000,
        })
        return
      }

      if (response.status === 401) {
        const data = await response.json()
        if (data.errorType === "TOKEN_EXPIRED") {
          setIsTokenExpired(true)
          toast({
            title: "انتهت صلاحية رمز الوصول",
            description: "يرجى تحديث رمز الوصول (Access Token) في إعدادات المشروع",
            variant: "destructive",
          })
          return
        }
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "فشل في إرسال الرسالة")
      }

      const data = await response.json()

      if (data.dailyLimit) {
        setDailyLimitInfo(data.dailyLimit)
      }

      toast({
        title: "تم إرسال الرسالة بنجاح ✅",
        description: (
          <div className="space-y-2">
            <p>تم إرسال الرسالة إلى {formattedPhone}</p>
            <p className="text-xs opacity-80 bg-blue-950/30 p-2 rounded">
              📌 <strong>ملاحظة:</strong> "تم الإرسال" يعني أن WhatsApp قبل الرسالة (accepted)، لكن التوصيل الفعلي يعتمد
              على:
              <br />• عدم تجاوز الحد اليومي
              <br />• الرقم مسجل في WhatsApp
              <br />• الرقم في قائمة الاختبار (إذا كان الحساب في وضع التطوير)
            </p>
            {data.dailyLimit?.shouldWarn && (
              <p className="text-yellow-400 font-medium">⚠️ تبقى {data.dailyLimit.remaining} رسالة من الحد اليومي</p>
            )}
          </div>
        ),
        duration: Number.POSITIVE_INFINITY,
      })

      setPhoneNumber("")
      setFormattedPhone("")
      setSelectedTemplate("")
      setMessagePreview("")
      setTemplateParams({
        mediaInputType: "url",
        mediaValue: "",
        bodyVariables: [],
      })
      setSelectedImagePreview(null)
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في إرسال الرسالة",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !templateParams.mediaType) return

    const validTypes: Record<string, string[]> = {
      IMAGE: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      VIDEO: ["video/mp4", "video/3gpp", "video/quicktime"],
      DOCUMENT: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    }

    const allowedTypes = validTypes[templateParams.mediaType] || []
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "خطأ في نوع الملف",
        description: `نوع الملف غير مدعوم. الأنواع المدعومة: ${allowedTypes.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setIsUploadingMedia(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mediaType", templateParams.mediaType)

      const response = await fetch("/api/upload-media", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "فشل في رفع الملف")
      }

      const data = await response.json()

      setTemplateParams({
        ...templateParams,
        mediaInputType: "id",
        mediaValue: data.mediaId,
      })

      toast({
        title: "تم رفع الملف بنجاح ✅",
        description: `Media ID: ${data.mediaId}`,
      })
    } catch (error) {
      toast({
        title: "خطأ في رفع الملف",
        description: error instanceof Error ? error.message : "فشل في رفع الملف",
        variant: "destructive",
      })
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const handleSelectMediaFromGallery = (mediaId: string, filename: string, previewUrl?: string) => {
    setTemplateParams({
      ...templateParams,
      mediaInputType: "id",
      mediaValue: mediaId,
    })
    setHasInvalidMediaUrl(false)
    setSelectedImagePreview(previewUrl || null)
  }

  const getMediaIcon = () => {
    switch (templateParams.mediaType) {
      case "IMAGE":
        return <ImageIcon className="h-4 w-4" />
      case "VIDEO":
        return <VideoIcon className="h-4 w-4" />
      case "DOCUMENT":
        return <FileIcon className="h-4 w-4" />
      default:
        return null
    }
  }

  const getMediaLabel = () => {
    switch (templateParams.mediaType) {
      case "IMAGE":
        return "الصورة"
      case "VIDEO":
        return "الفيديو"
      case "DOCUMENT":
        return "الملف"
      default:
        return "الوسائط"
    }
  }

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode)

  const validateMediaUrl = (url: string, mediaType: "IMAGE" | "VIDEO" | "DOCUMENT"): boolean => {
    const trimmedUrl = url.trim().toLowerCase()
    if (!trimmedUrl) return true

    const validExtensions =
      mediaType === "IMAGE"
        ? [".jpg", ".jpeg", ".png", ".gif", ".webp"]
        : mediaType === "VIDEO"
          ? [".mp4", ".3gp", ".mov"]
          : [".pdf", ".doc", ".docx", ".xls", ".xlsx"]

    const hasValidExtension = validExtensions.some((ext) => trimmedUrl.endsWith(ext))

    if (!hasValidExtension) {
      return false
    }

    const problematicPatterns = [
      "imageshack.com/i/",
      "imageshack.com/a/",
      "imagizer.imageshack.com",
      "imgur.com/a/",
      "imgur.com/gallery/",
      "flickr.com/photos/",
      "photobucket.com/albums/",
      "tinypic.com/view",
    ]

    if (problematicPatterns.some((pattern) => trimmedUrl.includes(pattern))) {
      return false
    }

    return true
  }

  const handleMediaValueChange = (value: string) => {
    setTemplateParams({ ...templateParams, mediaValue: value })

    if (value !== templateParams.mediaValue) {
      setSelectedImagePreview(null)
    }

    if (templateParams.mediaType && templateParams.mediaInputType === "url" && value.trim()) {
      const isValid = validateMediaUrl(value, templateParams.mediaType)
      setHasInvalidMediaUrl(!isValid)
    } else {
      setHasInvalidMediaUrl(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isTokenExpired && <TokenExpiredAlert />}

      <RateLimitDisplay />

      {dailyLimitInfo && dailyLimitInfo.shouldWarn && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>تحذير: اقتراب من الحد اليومي</AlertTitle>
          <AlertDescription>
            لقد استخدمت {dailyLimitInfo.used} من {dailyLimitInfo.limit} رسالة اليوم. تبقى {dailyLimitInfo.remaining}{" "}
            رسالة فقط.
          </AlertDescription>
        </Alert>
      )}

      {/* CHANGE: Replaced Select with TemplateSelector component */}
      <TemplateSelector
        templates={templates}
        selectedTemplate={selectedTemplate}
        onTemplateChange={handleTemplateChange}
        onFetchTemplates={fetchTemplates}
        isFetchingTemplates={isFetchingTemplates}
      />

      {templateParams.mediaType && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {getMediaIcon()}
              {getMediaLabel()} (مطلوب)
            </Label>
            <RadioGroup
              value={templateParams.mediaInputType}
              onValueChange={(value: "url" | "id") => {
                setTemplateParams({ ...templateParams, mediaInputType: value, mediaValue: "" })
                setHasInvalidMediaUrl(false)
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="url" id="url" />
                <Label htmlFor="url" className="font-normal cursor-pointer">
                  رابط URL
                </Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="id" id="id" />
                <Label htmlFor="id" className="font-normal cursor-pointer">
                  Media ID (مرفوع على Meta)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {templateParams.mediaInputType === "id" && (
            <div className="space-y-3">
              <MediaGallery onSelectMedia={handleSelectMediaFromGallery} selectedMediaId={templateParams.mediaValue} />
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  id="media-upload"
                  className="hidden"
                  accept={
                    templateParams.mediaType === "IMAGE"
                      ? "image/jpeg,image/png,image/gif,image/webp"
                      : templateParams.mediaType === "VIDEO"
                        ? "video/mp4,video/3gpp,video/quicktime"
                        : "application/pdf,.doc,.docx,.xls,.xlsx"
                  }
                  onChange={handleMediaUpload}
                  disabled={isUploadingMedia}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => document.getElementById("media-upload")?.click()}
                  disabled={isUploadingMedia}
                >
                  {isUploadingMedia ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الرفع...
                    </>
                  ) : (
                    <>
                      <Upload className="ml-2 h-4 w-4" />
                      رفع {getMediaLabel()} إلى WhatsApp
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">أو أدخل Media ID يدوياً:</p>
            </div>
          )}

          <Input
            type="text"
            placeholder={
              templateParams.mediaInputType === "url"
                ? templateParams.mediaType === "IMAGE"
                  ? "https://example.com/image.jpg"
                  : templateParams.mediaType === "VIDEO"
                    ? "https://example.com/video.mp4"
                    : "https://example.com/document.pdf"
                : "معرف الوسائط من Meta (Media ID)"
            }
            value={templateParams.mediaValue}
            onChange={(e) => handleMediaValueChange(e.target.value)}
            dir="ltr"
            required
          />

          {hasInvalidMediaUrl && templateParams.mediaInputType === "url" && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">⚠️ تحذير: رابط قد لا يعمل</AlertTitle>
              <AlertDescription className="space-y-2 text-sm">
                <p>
                  هذا الرابط من خدمة قد لا تعمل بشكل موثوق مع WhatsApp. الروابط من imageshack وخدمات مشابهة غالباً ما
                  تفشل حتى لو كانت تنتهي بامتداد صحيح.
                </p>
                <p className="font-medium text-yellow-600">💡 للحصول على أفضل النتائج:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>استخدم خدمات موثوقة مثل Imgur (Direct Link)</li>
                  <li>أو ارفع الصورة مباشرة إلى WhatsApp باستخدام خيار "Media ID"</li>
                </ul>
                <p className="text-xs opacity-80 mt-2">يمكنك المتابعة بالإرسال، لكن قد لا تصل الصورة للعميل.</p>
              </AlertDescription>
            </Alert>
          )}

          {!hasInvalidMediaUrl && templateParams.mediaInputType === "url" && (
            <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <p>
                {templateParams.mediaType === "IMAGE" && "الصيغ المدعومة: JPG, PNG, GIF, WebP"}
                {templateParams.mediaType === "VIDEO" && "الصيغ المدعومة: MP4, 3GP, MOV"}
                {templateParams.mediaType === "DOCUMENT" && "الصيغ المدعومة: PDF, DOC, DOCX, XLS, XLSX"}
              </p>
            </div>
          )}

          {templateParams.mediaInputType === "id" && (
            <p className="text-sm text-muted-foreground">أدخل معرف {getMediaLabel()} الذي تم رفعه مسبقاً على Meta</p>
          )}

          {selectedImagePreview && templateParams.mediaInputType === "id" && templateParams.mediaValue && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
              <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-background">
                <img
                  src={selectedImagePreview || "/placeholder.svg"}
                  alt="معاينة الصورة المختارة"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">الصورة المختارة</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  ID: {templateParams.mediaValue.substring(0, 20)}...
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {templateParams.bodyVariables.length > 0 && (
        <div className="space-y-4">
          <Label>متغيرات الرسالة</Label>
          {templateParams.bodyVariables.map((variable, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`var-${index}`} className="text-sm">
                المتغير {index + 1} (&#123;&#123;{index + 1}&#125;&#125;)
              </Label>
              <Input
                id={`var-${index}`}
                type="text"
                placeholder={`قيمة المتغير ${index + 1}`}
                value={variable}
                onChange={(e) => handleBodyVariableChange(index, e.target.value)}
                required
              />
            </div>
          ))}
        </div>
      )}

      {messagePreview && (
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <Label className="mb-2 block">معاينة الرسالة</Label>
            <p className="text-sm whitespace-pre-wrap">{messagePreview}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone">رقم الهاتف</Label>
        <div className="grid grid-cols-[140px_1fr] gap-2">
          <Select value={countryCode} onValueChange={handleCountryChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {COUNTRY_CODES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  <span className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span>{country.dialCode}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="phone"
            type="text"
            placeholder={selectedCountry?.placeholder || "xxxxxxxx"}
            value={phoneNumber}
            onChange={(e) => handlePhoneChange(e.target.value)}
            dir="ltr"
          />
        </div>
        {formattedPhone && (
          <p className="text-sm text-muted-foreground">
            الرقم المنسق: <span className="font-mono">{formattedPhone}</span>
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            جاري الإرسال...
          </>
        ) : (
          <>
            <Send className="ml-2 h-4 w-4" />
            إرسال الرسالة
          </>
        )}
      </Button>
    </form>
  )
}
