import winston from 'winston';
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    progress: 3,
    performance: 4,
    debug: 5,
};
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    progress: 'blue',
    performance: 'magenta',
    debug: 'cyan',
};
winston.addColors(colors);
const customFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json(), winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta,
    });
}));
export const logger = winston.createLogger({
    levels,
    level: 'debug',
    format: customFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
        new winston.transports.File({
            filename: 'logs/csv-import-error.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/csv-import.log',
        }),
    ],
});
export const logProgress = (progress) => {
    logger.log('progress', 'Import progress update', { progress });
};
export const logError = (error) => {
    logger.error('Import error occurred', { error });
};
export const logPerformance = (metrics) => {
    logger.log('performance', 'Performance metrics', { metrics });
};
export const logCompletion = (result) => {
    logger.info('Import operation completed', { result });
};
export const logDebug = (message, meta) => {
    logger.debug(message, meta);
};
export const createContextLogger = (context) => {
    return logger.child(context);
};
import { mkdirSync } from 'fs';
try {
    mkdirSync('logs', { recursive: true });
}
catch (error) {
    console.error('Failed to create logs directory:', error);
}
//# sourceMappingURL=logger.js.map