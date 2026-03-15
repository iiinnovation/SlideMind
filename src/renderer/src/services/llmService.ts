import {
  LLM_CONFIGS,
  type LLMProvider,
  type ChatMessage,
  type StreamCallbacks,
  type StreamChatOptions
} from '@/types/llm'

export async function streamChat(
  provider: LLMProvider,
  apiKey: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  model?: string,
  options: StreamChatOptions = {}
): Promise<void> {
  const config = LLM_CONFIGS[provider]

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || config.defaultModel,
      messages,
      stream: true,
      ...(options.responseFormat && { response_format: options.responseFormat })
    }),
    signal: options.signal
  })

  if (!response.ok) {
    callbacks.onError(new Error(`API 请求失败: ${response.status} ${response.statusText}`))
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError(new Error('无法读取响应流'))
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  function processEvent(eventText: string) {
    const data = eventText
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6))
      .join('\n')

    if (!data) return
    if (data === '[DONE]') {
      callbacks.onDone()
      return 'done'
    }

    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (content) {
        callbacks.onChunk(content)
      }
    } catch {
      // Ignore partial or malformed events.
    }

    return 'continue'
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')

      let boundaryIndex = buffer.indexOf('\n\n')
      while (boundaryIndex >= 0) {
        const eventText = buffer.slice(0, boundaryIndex).trim()
        buffer = buffer.slice(boundaryIndex + 2)

        if (eventText) {
          const result = processEvent(eventText)
          if (result === 'done') {
            return
          }
        }

        boundaryIndex = buffer.indexOf('\n\n')
      }

      if (done) {
        const trailingEvent = buffer.trim()
        if (trailingEvent) {
          const result = processEvent(trailingEvent)
          if (result === 'done') {
            return
          }
        }
        break
      }
    }
    callbacks.onDone()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      callbacks.onError(new Error('请求已取消'))
      return
    }
    callbacks.onError(error instanceof Error ? error : new Error(String(error)))
  }
}
