
import { describe, it, expect, vi } from 'vitest'
import { RequestQueue } from './request-queue.util'

describe('RequestQueue', () => {
    it('should execute requests in order', async () => {
        const queue = new RequestQueue({ maxConcurrent: 1 })
        const results: number[] = []

        await Promise.all([
            queue.enqueue(() => {
                results.push(1)
                return Promise.resolve(1)
            }),
            queue.enqueue(() => {
                results.push(2)
                return Promise.resolve(2)
            }),
            queue.enqueue(() => {
                results.push(3)
                return Promise.resolve(3)
            })
        ])

        expect(results).toEqual([1, 2, 3])
    })

    it('should respect concurrency limit', async () => {
        const queue = new RequestQueue({ maxConcurrent: 2 })
        let concurrent = 0
        let maxConcurrent = 0

        const createRequest = () => async () => {
            concurrent++
            maxConcurrent = Math.max(maxConcurrent, concurrent)
            await new Promise(r => setTimeout(r, 10))
            concurrent--
            return true
        }

        await Promise.all([
            queue.enqueue(createRequest()),
            queue.enqueue(createRequest()),
            queue.enqueue(createRequest()),
            queue.enqueue(createRequest())
        ])

        expect(maxConcurrent).toBe(2)
    })

    it('should prioritize high priority requests', async () => {
        const queue = new RequestQueue({ maxConcurrent: 1 })
        const results: string[] = []

        // First enqueue a slow request to block the queue
        const slowRequest = queue.enqueue(async () => {
            await new Promise(r => setTimeout(r, 50))
            results.push('first')
            return 'first'
        })

        // Then enqueue requests with different priorities
        const lowPriority = queue.enqueue(async () => {
            results.push('low')
            return 'low'
        }, { priority: 'low' })

        const highPriority = queue.enqueue(async () => {
            results.push('high')
            return 'high'
        }, { priority: 'high' })

        const normalPriority = queue.enqueue(async () => {
            results.push('normal')
            return 'normal'
        }, { priority: 'normal' })

        await Promise.all([slowRequest, lowPriority, highPriority, normalPriority])

        // After first, high should run first, then normal, then low
        expect(results).toEqual(['first', 'high', 'normal', 'low'])
    })

    it('should reject when queue is full', async () => {
        const queue = new RequestQueue({ maxConcurrent: 1, maxQueueSize: 2 })

        // Fill the queue
        queue.enqueue(() => new Promise(r => setTimeout(r, 100)))
        queue.enqueue(() => Promise.resolve(1))
        queue.enqueue(() => Promise.resolve(2))

        // This should be rejected
        await expect(
            queue.enqueue(() => Promise.resolve(3))
        ).rejects.toThrow('Request queue is full')
    })

    it('should report correct stats', () => {
        const queue = new RequestQueue({ maxConcurrent: 5 })

        expect(queue.getStats()).toEqual({
            queueLength: 0,
            running: 0,
            maxConcurrent: 5
        })
    })

    it('should handle request timeout', async () => {
        const queue = new RequestQueue({ maxConcurrent: 1, timeoutMs: 50 })

        await expect(
            queue.enqueue(() => new Promise(r => setTimeout(r, 100)))
        ).rejects.toThrow('Request timeout')
    })

    it('should drain properly', async () => {
        const queue = new RequestQueue({ maxConcurrent: 2 })
        const completed: number[] = []

        queue.enqueue(async () => {
            await new Promise(r => setTimeout(r, 20))
            completed.push(1)
        })
        queue.enqueue(async () => {
            await new Promise(r => setTimeout(r, 10))
            completed.push(2)
        })

        expect(queue.isIdle()).toBe(false)
        await queue.drain()
        expect(queue.isIdle()).toBe(true)
        expect(completed.length).toBe(2)
    })
})
