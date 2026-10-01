import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const int = (v: string | undefined, d: number) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : d
}

export const config = {
  port: int(process.env.PORT, 8787),
  // 部署在反代后面时设为 127.0.0.1，只接受本机连接；默认监听所有网卡（Docker 里需要）
  host: process.env.HOST || undefined,
  isProd: process.env.NODE_ENV === 'production',
  trustProxy: process.env.TRUST_PROXY === '1',

  // OpenAI 兼容协议，默认指向 DeepSeek
  llm: {
    baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'deepseek-flash',
    // 思考强度：deepseek-flash 支持 low / high / max；留空则不传该参数（非思考模型）
    reasoningEffort: process.env.LLM_REASONING_EFFORT ?? 'high',
    timeoutMs: int(process.env.LLM_TIMEOUT_MS, 45_000),
    maxRetries: int(process.env.LLM_MAX_RETRIES, 2),
    // 全局同时在途的上游请求数；超出的请求排队
    maxConcurrent: int(process.env.LLM_MAX_CONCURRENT, 16),
    // 排队超过这个时间直接返回 503，避免请求无限堆积
    queueTimeoutMs: int(process.env.LLM_QUEUE_TIMEOUT_MS, 20_000),
    maxQueue: int(process.env.LLM_MAX_QUEUE, 200),
  },

  session: {
    ttlMs: int(process.env.SESSION_TTL_MIN, 360) * 60_000,
    maxSessions: int(process.env.SESSION_MAX, 50_000),
    maxQuestions: int(process.env.SESSION_MAX_QUESTIONS, 200),
    maxGuesses: int(process.env.SESSION_MAX_GUESSES, 30),
    // 会话落盘位置；设为空字符串则只放内存
    file: process.env.SESSION_FILE ?? 'data/sessions.json',
  },

  rateLimit: {
    // 每个 IP 每分钟最多调用多少次需要 LLM 的接口
    perIpPerMin: int(process.env.RATE_PER_IP_PER_MIN, 30),
    // 每个 IP 每分钟最多新建多少局
    sessionsPerIpPerMin: int(process.env.RATE_SESSIONS_PER_IP_PER_MIN, 10),
  },
}

export const mockMode = !config.llm.apiKey
