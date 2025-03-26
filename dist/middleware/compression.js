import { createGzip, createDeflate, createBrotliCompress } from 'zlib';
import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';
const logger = new Logger('compression-middleware');
const defaultConfig = {
    threshold: 1024,
    level: 6,
    memLevel: 8,
    filter: (req, res) => {
        if (res.getHeader('Content-Length') && Number(res.getHeader('Content-Length')) < 1024) {
            return false;
        }
        const type = res.getHeader('Content-Type');
        if (type && (type.includes('image/') ||
            type.includes('video/') ||
            type.includes('audio/') ||
            type.includes('application/zip') ||
            type.includes('application/x-gzip') ||
            type.includes('application/x-brotli'))) {
            return false;
        }
        return true;
    }
};
export function compressionMiddleware(config = {}) {
    const options = { ...defaultConfig, ...config };
    return async function compress(req, res, next) {
        const acceptEncoding = req.headers['accept-encoding'] || '';
        if (!acceptEncoding || !options.filter(req, res)) {
            return next();
        }
        const originalWrite = res.write;
        const originalEnd = res.end;
        let compress;
        if (acceptEncoding.includes('br')) {
            compress = createBrotliCompress();
            res.setHeader('Content-Encoding', 'br');
        }
        else if (acceptEncoding.includes('gzip')) {
            compress = createGzip({
                level: options.level,
                memLevel: options.memLevel
            });
            res.setHeader('Content-Encoding', 'gzip');
        }
        else if (acceptEncoding.includes('deflate')) {
            compress = createDeflate({
                level: options.level,
                memLevel: options.memLevel
            });
            res.setHeader('Content-Encoding', 'deflate');
        }
        else {
            return next();
        }
        res.removeHeader('Content-Length');
        compress.pipe(res);
        res.write = function (chunk, encoding) {
            return compress.write(chunk, encoding);
        };
        res.end = function (chunk, encoding) {
            if (chunk) {
                compress.end(chunk, encoding);
            }
            else {
                compress.end();
            }
            return res;
        };
        compress.on('error', (err) => {
            logger.error('Compression error:', err);
            res.write = originalWrite;
            res.end = originalEnd;
            next(err);
        });
        res.on('finish', () => {
            const originalSize = Number(res.getHeader('X-Original-Size') || 0);
            const compressedSize = Number(res.getHeader('Content-Length') || 0);
            if (originalSize && compressedSize) {
                trackRequestMetrics(async () => {
                    const ratio = (originalSize - compressedSize) / originalSize;
                    logger.debug('Compression metrics', {
                        originalSize,
                        compressedSize,
                        ratio: ratio.toFixed(2),
                        encoding: res.getHeader('Content-Encoding')
                    });
                }, 'compression-metrics');
            }
        });
        next();
    };
}
//# sourceMappingURL=compression.js.map