function extractJsonPayload(content: string): string {
  const cleaned = content.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  return fenceMatch ? fenceMatch[1].trim() : cleaned
}

function summarizeAssistantContent(content: string): string | null {
  try {
    const parsed = JSON.parse(extractJsonPayload(content))
    if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
      const slideCount = parsed.slides.length
      const title = typeof parsed.slides[0]?.title === 'string' ? parsed.slides[0].title.trim() : ''
      return title ? `已生成 ${slideCount} 页课件：${title}` : `已生成 ${slideCount} 页课件`
    }

    if (typeof parsed?.title === 'string' && parsed.title.trim()) {
      return parsed.title.trim()
    }
  } catch {
    const slideCount = (content.match(/^---$/gm) || []).length + 1
    if (slideCount > 1) {
      return `已生成 ${slideCount} 页课件`
    }
  }

  return null
}

export function formatMessagePreview(content: string, maxLength = 100): string {
  const assistantSummary = summarizeAssistantContent(content)
  if (assistantSummary) {
    return assistantSummary
  }

  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}
