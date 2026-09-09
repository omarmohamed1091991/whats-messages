"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, RefreshCw } from "lucide-react"

interface Template {
  id: string
  name: string
  language: string
  status: string
  components: Array<{
    type: string
    format?: string
    text?: string
    parameters?: Array<{ type: string; text: string }>
  }>
}

interface TemplateSelectorProps {
  templates: Template[]
  selectedTemplate: string
  onTemplateChange: (templateId: string) => void
  onFetchTemplates: () => void
  isFetchingTemplates: boolean
  label?: string
}

export function TemplateSelector({
  templates,
  selectedTemplate,
  onTemplateChange,
  onFetchTemplates,
  isFetchingTemplates,
  label = "قالب الرسالة",
}: TemplateSelectorProps) {
  const [templatesFetched, setTemplatesFetched] = useState(false)

  const handleFetchTemplates = () => {
    onFetchTemplates()
    setTemplatesFetched(true)
  }

  console.log("[v0] TemplateSelector - Templates count:", templates.length)
  console.log("[v0] TemplateSelector - Selected template:", selectedTemplate)
  console.log("[v0] TemplateSelector - Templates fetched:", templatesFetched)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Label>{label}</Label>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleFetchTemplates} disabled={isFetchingTemplates}>
          {isFetchingTemplates ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="ml-2 h-4 w-4" />
          )}
          جلب القوالب
        </Button>
      </div>

      <Select value={selectedTemplate} onValueChange={onTemplateChange} disabled={templates.length === 0}>
        <SelectTrigger
          className={
            selectedTemplate || templatesFetched
              ? "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-secondary"
              : ""
          }
        >
          <SelectValue placeholder="اختر قالب" />
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          {templates.map((template) => {
            const hasImageHeader = template.components.some((c) => c.type === "HEADER" && c.format === "IMAGE")
            return (
              <SelectItem key={template.id} value={template.id}>
                {template.name} ({template.language}) {hasImageHeader && "🖼️"}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">اضغط على "جلب القوالب" لتحميل القوالب المعتمدة</p>
      )}

      {templates.length > 0 && <p className="text-xs text-muted-foreground">{templates.length} قالب متاح</p>}
    </div>
  )
}
