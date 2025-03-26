import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
export function monitor(auditLogService) {
    return async (req, res, next) => {
        const requestId = uuidv4();
        const startTime = process.hrtime();
        res.setHeader('X-Request-ID', requestId);
        const originalSend = res.send;
        res.send = function (body) {
            const hrTime = process.hrtime(startTime);
            const durationInMs = hrTime[0] * 1000 + hrTime[1] / 1000000;
            const authenticatedReq = req;
            if (authenticatedReq.apiKey) {
                auditLogService.logRequest({
                    keyId: authenticatedReq.apiKey.id,
                    endpoint: req.path,
                    requestMethod: req.method,
                    responseStatus: res.statusCode,
                    clientIp: req.ip || 'unknown',
                    userAgent: req.get('user-agent') ?? 'unknown',
                    requestId,
                    requestDurationMs: Math.round(durationInMs)
                }).catch(error => {
                    logger.error('Failed to log API request', { error, requestId });
                });
            }
            res.setHeader('X-Response-Time', `${Math.round(durationInMs)}ms`);
            return originalSend.call(this, body);
        };
        next();
    };
}
//# sourceMappingURL=monitoring.js.map