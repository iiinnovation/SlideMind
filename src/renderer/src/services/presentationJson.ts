import type { Slide, SlidePresentation } from '../../../shared/types/slide'

/**
 * Incrementally extract completed Slide objects from a partial JSON string
 * being streamed from the LLM.
 *
 * Strategy: find the "slides" array opening bracket, then use brace-depth
 * tracking to isolate each complete {...} object inside the array.
 */
export function extractCompletedSlides(partialJson: string): Slide[] {
  // Find the start of the slides array
  const slidesKeyIndex = partialJson.indexOf('"slides"')
  if (slidesKeyIndex < 0) return []

  // Find the opening bracket of the array
  const arrayStart = partialJson.indexOf('[', slidesKeyIndex)
  if (arrayStart < 0) return []

  const slides: Slide[] = []
  let i = arrayStart + 1
  const len = partialJson.length

  while (i < len) {
    // Skip whitespace and commas
    while (i < len && (partialJson[i] === ' ' || partialJson[i] === '\n' || partialJson[i] === '\r' || partialJson[i] === '\t' || partialJson[i] === ',')) {
      i++
    }

    if (i >= len || partialJson[i] === ']') break
    if (partialJson[i] !== '{') break

    // Track brace depth to find the matching closing brace
    const objectStart = i
    let depth = 0
    let inString = false
    let escaped = false

    while (i < len) {
      const ch = partialJson[i]

      if (escaped) {
        escaped = false
        i++
        continue
      }

      if (ch === '\\' && inString) {
        escaped = true
        i++
        continue
      }

      if (ch === '"') {
        inString = !inString
      } else if (!inString) {
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) {
            // Found a complete object
            const objectStr = partialJson.slice(objectStart, i + 1)
            try {
              const parsed = JSON.parse(objectStr)
              if (isValidSlide(parsed)) {
                slides.push(parsed as Slide)
              }
            } catch {
              // Malformed JSON, skip
            }
            i++
            break
          }
        }
      }

      i++
    }

    // If we exited the inner loop without finding the closing brace,
    // the object is incomplete — stop here
    if (depth > 0) break
  }

  return slides
}

function isValidSlide(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false
  const slide = obj as Record<string, unknown>
  if (!['title', 'content', 'summary'].includes(slide.layout as string)) return false
  if (!Array.isArray(slide.elements)) return false
  return true
}

/**
 * Parse the complete JSON output into a SlidePresentation.
 * Falls back to an empty presentation on parse failure.
 */
export function finalizePresentation(rawJson: string, theme: string): SlidePresentation {
  try {
    // Try to strip code fences if present
    let cleaned = rawJson.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim()
    }

    const parsed = JSON.parse(cleaned)

    if (parsed && Array.isArray(parsed.slides)) {
      const validSlides = parsed.slides.filter(isValidSlide) as Slide[]
      return {
        theme: typeof parsed.theme === 'string' ? parsed.theme : theme,
        slides: validSlides
      }
    }
  } catch {
    // Full parse failed, try extracting whatever slides we can
    const slides = extractCompletedSlides(rawJson)
    if (slides.length > 0) {
      return { theme, slides }
    }
  }

  return { theme, slides: [] }
}
