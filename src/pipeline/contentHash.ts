import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HashStatus = 'new' | 'changed' | 'unchanged'

type HashComparison = {
  status: HashStatus
  currentHash: string
  previousHash: string | null
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

function hashContent(html: string): string {
  return createHash('sha256').update(html, 'utf-8').digest('hex')
}

function compareHash(currentHash: string, previousHash: string | null): HashComparison {
  if (previousHash === null) {
    return { status: 'new', currentHash, previousHash }
  }
  return {
    status: currentHash === previousHash ? 'unchanged' : 'changed',
    currentHash,
    previousHash,
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { hashContent, compareHash }
export type { HashStatus, HashComparison }
