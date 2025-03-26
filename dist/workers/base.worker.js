import { parentPort } from 'worker_threads';
import { Logger } from '../utils/logging.js';
const logger = new Logger('base-worker');
if (!parentPort) {
    throw new Error('This file must be run as a worker thread');
}
export class BaseWorker {
    async handleError(error, taskId) {
        const result = {
            taskId,
            error: error instanceof Error ? error : new Error(String(error))
        };
        parentPort.postMessage(result);
    }
    async handleSuccess(result, taskId) {
        const workerResult = {
            taskId,
            result
        };
        parentPort.postMessage(workerResult);
    }
    async initialize() {
        try {
            parentPort.on('message', async (task) => {
                try {
                    logger.debug('Processing task', {
                        taskId: task.id,
                        type: task.type
                    });
                    const result = await this.processTask(task);
                    await this.handleSuccess(result, task.id);
                }
                catch (error) {
                    logger.error('Task processing error:', error instanceof Error ? error : new Error(String(error)));
                    await this.handleError(error, task.id);
                }
            });
            logger.info('Worker initialized');
        }
        catch (error) {
            logger.error('Worker initialization error:', error instanceof Error ? error : new Error(String(error)));
            throw error instanceof Error ? error : new Error(String(error));
        }
    }
}
//# sourceMappingURL=base.worker.js.map