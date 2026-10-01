import OpenAI from 'openai'
import { config } from './config.ts'
import { Semaphore } from './semaphore.ts'

// 单例客户端：内部基于 keep-alive 连接池，多请求共享是安全的
const client = new OpenAI({
  baseURL: config.llm.baseURL,
  apiKey: config.llm.apiKey || 'missing',
  timeout: config.llm.timeoutMs,
  // SDK 内置对 408/409/429/5xx 的指数退避重试
  maxRetries: config.llm.maxRetries,
})

export const llmGate = new Semaphore(config.llm.maxConcurrent, config.llm.maxQueue, config.llm.queueTimeoutMs)

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * 调用模型并解析 JSON 输出。
 * 思考模型的推理过程在 reasoning_content 里单独返回，不会混进 content；
 * max_tokens 需要同时容纳推理与最终输出，所以给得比较宽。
 */
export async function chatJSON<T>(messages: Msg[], opts: { maxTokens?: number } = {}): Promise<{ data: T; reasoning: string }> {
  const res = await llmGate.run(() =>
    client.chat.completions.create({
      model: config.llm.model,
      messages,
      max_tokens: opts.maxTokens ?? 6000,
      response_format: { type: 'json_object' },
      ...(config.llm.reasoningEffort ? { reasoning_effort: config.llm.reasoningEffort as OpenAI.ReasoningEffort } : {}),
    }),
  )
  const msg = res.choices[0]?.message as (OpenAI.ChatCompletionMessage & { reasoning_content?: string }) | undefined
  if (res.choices[0]?.finish_reason === 'length') throw new Error('LLM 输出被截断（max_tokens 不足）')
  return { data: parseJSON<T>(msg?.content ?? ''), reasoning: msg?.reasoning_content ?? '' }
}

function parseJSON<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0]) as T
    throw new Error(`LLM 返回的不是 JSON：${text.slice(0, 200)}`)
  }
}
