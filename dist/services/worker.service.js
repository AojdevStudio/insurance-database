import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';
const logger = new Logger('worker-service');
export class WorkerService {
    workerScript;
    workers = [];
    taskQueue = [];
    config;
    taskCallbacks = new Map();
    constructor(workerScript, config = {}) {
        this.workerScript = workerScript;
        this.config = {
            numWorkers: config.numWorkers || Math.max(1, cpus().length - 1),
            taskTimeout: config.taskTimeout || 30000,
            maxRetries: config.maxRetries || 3
        };
        this.initialize();
    }
    initialize() {
        for (let i = 0; i < this.config.numWorkers; i++) {
            this.createWorker();
        }
    }
    createWorker() {
        const worker = new Worker(this.workerScript);
        worker.busy = false;
        worker.on('message', (result) => {
            worker.busy = false;
            this.handleWorkerResult(result);
        });
        worker.on('error', (error) => {
            worker.busy = false;
            logger.error('Worker error:', error);
            this.handleWorkerError(worker, error);
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                logger.error(`Worker exited with code ${code}`);
                this.replaceWorker(worker);
            }
        });
        this.workers.push(worker);
    }
    replaceWorker(worker) {
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
            this.workers.splice(index, 1);
            this.createWorker();
        }
    }
    handleWorkerResult(result) {
        const callback = this.taskCallbacks.get(result.taskId);
        if (callback) {
            clearTimeout(callback.timer);
            this.taskCallbacks.delete(result.taskId);
            if (result.error) {
                callback.reject(result.error);
            }
            else {
                callback.resolve(result.result);
            }
        }
        this.processNextTask();
    }
    handleWorkerError(worker, error) {
        logger.error('Worker error:', error);
        this.replaceWorker(worker);
    }
    async processNextTask() {
        if (this.taskQueue.length === 0)
            return;
        const availableWorker = this.workers.find(w => !w.busy);
        if (!availableWorker)
            return;
        const task = this.taskQueue.shift();
        if (!task)
            return;
        try {
            availableWorker.busy = true;
            availableWorker.postMessage(task);
        }
        catch (error) {
            availableWorker.busy = false;
            const callback = this.taskCallbacks.get(task.id);
            if (callback) {
                clearTimeout(callback.timer);
                this.taskCallbacks.delete(task.id);
                callback.reject(error instanceof Error ? error : new Error(String(error)));
            }
        }
    }
    async executeTask(task) {
        return trackRequestMetrics(async () => {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.taskCallbacks.delete(task.id);
                    reject(new Error(`Task ${task.id} timed out after ${this.config.taskTimeout}ms`));
                }, this.config.taskTimeout);
                this.taskCallbacks.set(task.id, { resolve, reject, timer });
                this.taskQueue.push(task);
                this.processNextTask();
            });
        }, `worker-execute-${task.type}`);
    }
    async shutdown() {
        await Promise.all(this.workers.map(worker => worker.terminate()));
        this.workers = [];
        for (const [, callback] of this.taskCallbacks) {
            clearTimeout(callback.timer);
            callback.reject(new Error('Worker pool shutdown'));
        }
        this.taskCallbacks.clear();
        this.taskQueue = [];
    }
}
//# sourceMappingURL=worker.service.js.map