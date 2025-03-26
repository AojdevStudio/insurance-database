import { compressionMiddleware } from '../compression.js';
import { Readable, pipeline as streamPipeline } from 'stream';
import { createGunzip, createBrotliDecompress, createInflate } from 'zlib';
import { promisify } from 'util';
import { Buffer } from 'buffer';
const pipeline = promisify(streamPipeline);
describe('Compression Middleware', () => {
    let req;
    let res;
    let next;
    let chunks;
    let originalWrite;
    let originalEnd;
    beforeEach(() => {
        chunks = [];
        req = {
            headers: {
                'accept-encoding': ''
            }
        };
        const mockResponse = {
            write: function (chunk) {
                chunks.push(Buffer.from(chunk));
                return true;
            },
            end: function (chunk) {
                if (chunk) {
                    chunks.push(Buffer.from(chunk));
                }
                return mockResponse;
            },
            on: jest.fn(),
            setHeader: jest.fn(),
            getHeader: jest.fn(),
            removeHeader: jest.fn(),
            pipe: function (dest) {
                return dest;
            },
            status: function (code) {
                return mockResponse;
            },
            app: {
                get: jest.fn(),
                set: jest.fn(),
                disable: jest.fn(),
                enable: jest.fn(),
                enabled: jest.fn(),
                disabled: jest.fn()
            },
            req: {},
            headersSent: false,
            locals: {},
            charset: '',
            send: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            sendStatus: jest.fn().mockReturnThis(),
            links: jest.fn().mockReturnThis()
        };
        res = mockResponse;
        originalWrite = res.write;
        originalEnd = res.end;
        next = jest.fn();
    });
    it('should skip compression when accept-encoding is not present', async () => {
        const middleware = compressionMiddleware();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.write).toBe(originalWrite);
        expect(res.end).toBe(originalEnd);
    });
    it('should skip compression for small responses', async () => {
        if (req.headers) {
            req.headers['accept-encoding'] = 'gzip';
        }
        res.getHeader = jest.fn().mockReturnValue('500');
        const middleware = compressionMiddleware();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.write).toBe(originalWrite);
        expect(res.end).toBe(originalEnd);
    });
    it('should skip compression for already compressed content types', async () => {
        if (req.headers) {
            req.headers['accept-encoding'] = 'gzip';
        }
        res.getHeader = jest.fn().mockImplementation((header) => {
            if (header === 'Content-Type')
                return 'application/x-gzip';
            return null;
        });
        const middleware = compressionMiddleware();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.write).toBe(originalWrite);
        expect(res.end).toBe(originalEnd);
    });
    it('should use brotli compression when supported', async () => {
        if (req.headers) {
            req.headers['accept-encoding'] = 'br';
        }
        const testData = 'Hello World!'.repeat(1000);
        const middleware = compressionMiddleware();
        await middleware(req, res, next);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Encoding', 'br');
        res.write(testData);
        res.end();
        const decompressed = await decompress(Buffer.concat(chunks), 'br');
        expect(decompressed.toString()).toBe(testData);
    });
    it('should use gzip compression when supported', async () => {
        if (req.headers) {
            req.headers['accept-encoding'] = 'gzip';
        }
        const testData = 'Hello World!'.repeat(1000);
        const middleware = compressionMiddleware();
        await middleware(req, res, next);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Encoding', 'gzip');
        res.write(testData);
        res.end();
        const decompressed = await decompress(Buffer.concat(chunks), 'gzip');
        expect(decompressed.toString()).toBe(testData);
    });
    it('should use deflate compression when supported', async () => {
        if (req.headers) {
            req.headers['accept-encoding'] = 'deflate';
        }
        const testData = 'Hello World!'.repeat(1000);
        const middleware = compressionMiddleware();
        await middleware(req, res, next);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Encoding', 'deflate');
        res.write(testData);
        res.end();
        const decompressed = await decompress(Buffer.concat(chunks), 'deflate');
        expect(decompressed.toString()).toBe(testData);
    });
    it('should handle custom compression options', async () => {
        if (req.headers) {
            req.headers['accept-encoding'] = 'gzip';
        }
        const config = {
            threshold: 2048,
            level: 9,
            memLevel: 9,
            filter: () => true
        };
        const middleware = compressionMiddleware(config);
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith('Content-Encoding', 'gzip');
    });
    it('should track compression metrics', async () => {
        if (req.headers) {
            req.headers['accept-encoding'] = 'gzip';
        }
        res.getHeader = jest.fn().mockImplementation((header) => {
            if (header === 'X-Original-Size')
                return '1000';
            if (header === 'Content-Length')
                return '500';
            return null;
        });
        const onSpy = jest.spyOn(res, 'on');
        const middleware = compressionMiddleware();
        await middleware(req, res, next);
        expect(onSpy).toHaveBeenCalledWith('finish', expect.any(Function));
    });
});
async function decompress(data, encoding) {
    const decompressor = encoding === 'br'
        ? createBrotliDecompress()
        : encoding === 'gzip'
            ? createGunzip()
            : createInflate();
    const chunks = [];
    const readable = Readable.from(data);
    await pipeline(readable, decompressor);
    for await (const chunk of decompressor) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
//# sourceMappingURL=compression.test.js.map