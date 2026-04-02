import { describe, it, expect } from 'vitest'
import { hashContent, compareHash } from './contentHash'

describe('hashContent', () => {
  it('should return a 64-character hex string (SHA-256)', () => {
    const hash = hashContent('<html><body>scores</body></html>')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('should be deterministic — same input always same hash', () => {
    const html = '<html><body>hello world</body></html>'
    expect(hashContent(html)).toBe(hashContent(html))
  })

  it('should produce different hashes for different content', () => {
    const h1 = hashContent('<html>version 1</html>')
    const h2 = hashContent('<html>version 2</html>')
    expect(h1).not.toBe(h2)
  })

  it('should handle empty string', () => {
    const hash = hashContent('')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('compareHash', () => {
  it('should return "new" when previous hash is null', () => {
    const result = compareHash('abc123', null)
    expect(result.status).toBe('new')
    expect(result.currentHash).toBe('abc123')
    expect(result.previousHash).toBeNull()
  })

  it('should return "unchanged" when hashes match', () => {
    const result = compareHash('abc123', 'abc123')
    expect(result.status).toBe('unchanged')
  })

  it('should return "changed" when hashes differ', () => {
    const result = compareHash('abc123', 'def456')
    expect(result.status).toBe('changed')
    expect(result.currentHash).toBe('abc123')
    expect(result.previousHash).toBe('def456')
  })
})
