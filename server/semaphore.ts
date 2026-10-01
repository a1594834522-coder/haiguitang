/**
 * 异步信号量：限制同时进行的上游 LLM 请求数，超出部分 FIFO 排队。
 * Node 是单线程事件循环，这里的计数与队列操作都是同步完成的，不存在竞态。
 */
export class QueueFullError extends Error {}
export class QueueTimeoutError extends Error {}

type Waiter = { resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }

export class Semaphore {
  private active = 0
  private queue: Waiter[] = []

  constructor(
    private readonly max: number,
    private readonly maxQueue: number,
    private readonly queueTimeoutMs: number,
  ) {}

  get stats() {
    return { active: this.active, queued: this.queue.length, max: this.max }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++
      return Promise.resolve()
    }
    if (this.queue.length >= this.maxQueue) return Promise.reject(new QueueFullError())
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const i = this.queue.indexOf(waiter)
          if (i >= 0) this.queue.splice(i, 1)
          reject(new QueueTimeoutError())
        }, this.queueTimeoutMs),
      }
      this.queue.push(waiter)
    })
  }

  private release() {
    const next = this.queue.shift()
    if (next) {
      // 名额直接转交给下一个等待者，active 不变
      clearTimeout(next.timer)
      next.resolve()
    } else {
      this.active--
    }
  }
}
