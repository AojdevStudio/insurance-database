import { Request, Response, NextFunction } from 'express';
import { createGzip, createDeflate, createBrotliCompress } from 'zlib';
import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';

const logger = new Logger('compression-middleware');

export interface CompressionConfig {
  threshold?: number;
  level?: number;
  memLevel?: number;
  filter?: (req: Request, res: Response) => boolean;
}

const defaultConfig: Required<CompressionConfig> = {
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Default compression level
  memLevel: 8, // Default memory level
  filter: (req, res) => {
    // Skip compression for small responses or those already compressed
    if (res.getHeader('Content-Length') && Number(res.getHeader('Content-Length')) < 1024) {
      return false;
    }
    
    // Skip compression for certain content types
    const type = res.getHeader('Content-Type') as string;
    if (type && (
      type.includes('image/') ||
      type.includes('video/') ||
      type.includes('audio/') ||
      type.includes('application/zip') ||
      type.includes('application/x-gzip') ||
      type.includes('application/x-brotli')
    )) {
      return false;
    }

    return true;
  }
};

export function compressionMiddleware(config: CompressionConfig = {}) {
  const options: Required<CompressionConfig> = { ...defaultConfig, ...config };

  return async function compress(req: Request, res: Response, next: NextFunction) {
    // Skip compression if client doesn't support it
    const acceptEncoding = req.headers['accept-encoding'] || '';

    if (!acceptEncoding || !options.filter(req, res)) {
      return next();
    }

    // Store the original response methods
    const originalWrite = res.write;
    const originalEnd = res.end;

    // Create compression stream based on accepted encoding
    let compress;
    if (acceptEncoding.includes('br')) {
      compress = createBrotliCompress();
      res.setHeader('Content-Encoding', 'br');
    } else if (acceptEncoding.includes('gzip')) {
      compress = createGzip({
        level: options.level,
        memLevel: options.memLevel
      });
      res.setHeader('Content-Encoding', 'gzip');
    } else if (acceptEncoding.includes('deflate')) {
      compress = createDeflate({
        level: options.level,
        memLevel: options.memLevel
      });
      res.setHeader('Content-Encoding', 'deflate');
    } else {
      return next();
    }

    // Remove content-length as it will change
    res.removeHeader('Content-Length');

    // Pipe the compression stream to the response
    compress.pipe(res);

    // Override response methods to use compression
    res.write = function (chunk: any, encoding?: any) {
      return compress.write(chunk, encoding);
    };

    res.end = function (chunk?: any, encoding?: any) {
      if (chunk) {
        compress.end(chunk, encoding);
      } else {
        compress.end();
      }
      return res;
    };

    // Handle compression errors
    compress.on('error', (err) => {
      logger.error('Compression error:', err);
      // Fall back to uncompressed response
      res.write = originalWrite;
      res.end = originalEnd;
      next(err);
    });

    // Track compression metrics
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