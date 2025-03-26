class TokenBucket {
    tokens;
    lastRefill;
    refillRate;
    capacity;
    constructor(ratePerMinute) {
        this.capacity = ratePerMinute;
        this.tokens = ratePerMinute;
        this.lastRefill = Date.now();
        this.refillRate = ratePerMinute / (60 * 1000);
    }
    refill() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const newTokens = timePassed * this.refillRate;
        this.tokens = Math.min(this.capacity, this.tokens + newTokens);
        this.lastRefill = now;
    }
    async acquire() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }
        const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.acquire();
    }
    release() {
        this.tokens = Math.min(this.capacity, this.tokens + 1);
    }
}
export class OpenAIRateLimiter {
    bucket;
    timeoutMs;
    constructor(ratePerMinute, timeoutMs = 30000) {
        this.bucket = new TokenBucket(ratePerMinute);
        this.timeoutMs = timeoutMs;
    }
    async acquireToken() {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Rate limit timeout')), this.timeoutMs);
        });
        try {
            await Promise.race([
                this.bucket.acquire(),
                timeoutPromise
            ]);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Rate limit timeout') {
                throw error;
            }
            this.releaseToken();
            throw error;
        }
    }
    releaseToken() {
        this.bucket.release();
    }
}
//# sourceMappingURL=rateLimiter.js.map