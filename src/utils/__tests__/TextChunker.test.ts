import { TextChunker, ChunkingStrategy, ChunkingOptions, Chunk } from '../TextChunker.js';

describe('TextChunker', () => {
  let chunker: TextChunker;

  beforeEach(() => {
    chunker = new TextChunker();
  });

  describe('Fixed-size chunking', () => {
    it('should chunk text into fixed-size pieces', () => {
      const text = 'This is a test text that needs to be chunked into smaller pieces.';
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.FixedSize,
        chunkSize: 10,
        overlap: 0
      };

      const chunks = chunker.chunk(text, options);
      expect(chunks.length).toBe(6);
      chunks.forEach((chunk: Chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(10);
      });
    });

    it('should handle overlap correctly', () => {
      const text = 'This is a test text for overlap handling.';
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.FixedSize,
        chunkSize: 10,
        overlap: 5
      };

      const chunks = chunker.chunk(text, options);
      expect(chunks.length).toBeGreaterThan(1);
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1].content;
        const currentChunk = chunks[i].content;
        expect(prevChunk.slice(-5)).toBe(currentChunk.slice(0, 5));
      }
    });
  });

  describe('Sentence chunking', () => {
    it('should chunk text by sentences', () => {
      const text = 'This is sentence one. This is sentence two! Is this sentence three? Yes, it is.';
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.Sentence
      };

      const chunks = chunker.chunk(text, options);
      expect(chunks.length).toBe(4);
      expect(chunks[0].content).toBe('This is sentence one');
      expect(chunks[1].content).toBe('This is sentence two');
      expect(chunks[2].content).toBe('Is this sentence three');
      expect(chunks[3].content).toBe('Yes, it is');
    });

    it('should handle complex punctuation', () => {
      const text = 'Mr. Smith went to Dr. Jones. Mrs. Brown visited Ms. Green! Prof. White teaches Jr. High.';
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.Sentence
      };

      const chunks = chunker.chunk(text, options);
      expect(chunks.length).toBe(3);
    });
  });

  describe('Recursive chunking', () => {
    it('should chunk text based on separators', () => {
      const text = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.Recursive,
        separators: ['\n\n']
      };

      const chunks = chunker.chunk(text, options);
      expect(chunks.length).toBe(3);
      expect(chunks[0].content).toBe('Paragraph 1');
      expect(chunks[1].content).toBe('Paragraph 2');
      expect(chunks[2].content).toBe('Paragraph 3');
    });
  });

  describe('Error handling', () => {
    it('should throw error for empty text', () => {
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.FixedSize,
        chunkSize: 10
      };

      const chunks = chunker.chunk('', options);
      expect(chunks).toEqual([]);
    });

    it('should throw error for invalid chunk size', () => {
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.FixedSize,
        chunkSize: -1
      };

      expect(() => chunker.chunk('test', options)).toThrow('Chunk size must be a positive number');
    });

    it('should throw error for invalid strategy', () => {
      const options = {
        strategy: 'invalid' as ChunkingStrategy
      };

      expect(() => chunker.chunk('test', options)).toThrow('Unknown chunking strategy');
    });
  });

  describe('Special cases', () => {
    it('should handle Unicode text', () => {
      const text = '🌟 This is a test with emoji 🎉 and Unicode characters 你好';
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.FixedSize,
        chunkSize: 10
      };

      const chunks = chunker.chunk(text, options);
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk: Chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(10);
      });
    });

    it('should handle multiple line endings', () => {
      const text = 'Line 1\r\nLine 2\nLine 3\rLine 4';
      const options: ChunkingOptions = {
        strategy: ChunkingStrategy.Recursive,
        separators: ['\r\n', '\n', '\r']
      };

      const chunks = chunker.chunk(text, options);
      expect(chunks.length).toBe(4);
      expect(chunks[0].content).toBe('Line 1');
      expect(chunks[1].content).toBe('Line 2');
      expect(chunks[2].content).toBe('Line 3');
      expect(chunks[3].content).toBe('Line 4');
    });
  });
}); 