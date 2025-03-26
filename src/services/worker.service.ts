import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';

const logger = new Logger('worker-service');

export interface WorkerConfig {
  numWorkers?: number;
  taskTimeout?: number;
  maxRetries?: number;
}

export interface WorkerTask<T> {
  id: string;
  data: T;
  type: string;
}

export interface WorkerResult<R> {
  taskId: string;
  result?: R;
  error?: Error;
}

interface ExtendedWorker extends Worker {
  busy?: boolean;
}

export class WorkerService<T, R> {
  private workers: ExtendedWorker[] = [];
  private taskQueue: WorkerTask<T>[] = [];
  private readonly config: Required<WorkerConfig>;
  private taskCallbacks: Map<string, { 
    resolve: (result: R) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(
    private readonly workerScript: string,
    config: WorkerConfig = {}
  ) {
    this.config = {
      numWorkers: config.numWorkers || Math.max(1, cpus().length - 1),
      taskTimeout: config.taskTimeout || 30000,
      maxRetries: config.maxRetries || 3
    };

    this.initialize();
  }

  private initialize(): void {
    for (let i = 0; i < this.config.numWorkers; i++) {
      this.createWorker();
    }
  }

  private createWorker(): void {
    const worker = new Worker(this.workerScript) as ExtendedWorker;
    worker.busy = false;

    worker.on('message', (result: WorkerResult<R>) => {
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

  private replaceWorker(worker: ExtendedWorker): void {
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
      this.createWorker();
    }
  }

  private handleWorkerResult(result: WorkerResult<R>): void {
    const callback = this.taskCallbacks.get(result.taskId);
    if (callback) {
      clearTimeout(callback.timer);
      this.taskCallbacks.delete(result.taskId);

      if (result.error) {
        callback.reject(result.error);
      } else {
        callback.resolve(result.result!);
      }
    }

    this.processNextTask();
  }

  private handleWorkerError(worker: ExtendedWorker, error: Error): void {
    logger.error('Worker error:', error);
    this.replaceWorker(worker);
  }

  private async processNextTask(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    try {
      availableWorker.busy = true;
      availableWorker.postMessage(task);
    } catch (error) {
      availableWorker.busy = false;
      const callback = this.taskCallbacks.get(task.id);
      if (callback) {
        clearTimeout(callback.timer);
        this.taskCallbacks.delete(task.id);
        callback.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  async executeTask(task: WorkerTask<T>): Promise<R> {
    return trackRequestMetrics(async () => {
      return new Promise<R>((resolve, reject) => {
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

  async shutdown(): Promise<void> {
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