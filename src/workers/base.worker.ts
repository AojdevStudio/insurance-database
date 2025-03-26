import { parentPort } from 'worker_threads';
import { Logger } from '../utils/logging.js';

const logger = new Logger('base-worker');

if (!parentPort) {
  throw new Error('This file must be run as a worker thread');
}

interface WorkerTask<T> {
  id: string;
  data: T;
  type: string;
}

interface WorkerResult<R> {
  taskId: string;
  result?: R;
  error?: Error;
}

export abstract class BaseWorker<T, R> {
  protected abstract processTask(task: WorkerTask<T>): Promise<R>;

  protected async handleError(error: unknown, taskId: string): Promise<void> {
    const result: WorkerResult<R> = {
      taskId,
      error: error instanceof Error ? error : new Error(String(error))
    };
    parentPort!.postMessage(result);
  }

  protected async handleSuccess(result: R, taskId: string): Promise<void> {
    const workerResult: WorkerResult<R> = {
      taskId,
      result
    };
    parentPort!.postMessage(workerResult);
  }

  public async initialize(): Promise<void> {
    try {
      parentPort!.on('message', async (task: WorkerTask<T>) => {
        try {
          logger.debug('Processing task', {
            taskId: task.id,
            type: task.type
          });

          const result = await this.processTask(task);
          await this.handleSuccess(result, task.id);
        } catch (error: unknown) {
          logger.error('Task processing error:', error instanceof Error ? error : new Error(String(error)));
          await this.handleError(error, task.id);
        }
      });

      logger.info('Worker initialized');
    } catch (error: unknown) {
      logger.error('Worker initialization error:', error instanceof Error ? error : new Error(String(error)));
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

// Example implementation:
/*
export class ExampleWorker extends BaseWorker<string, number> {
  protected async processTask(task: WorkerTask<string>): Promise<number> {
    // Process the task
    return task.data.length;
  }
}

// Usage:
if (!isMainThread) {
  const worker = new ExampleWorker();
  worker.initialize().catch(error => {
    logger.error('Worker initialization failed:', error);
    process.exit(1);
  });
}
*/ 