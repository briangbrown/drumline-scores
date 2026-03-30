import { describe, it, expect, beforeEach } from 'vitest'
import { getFavorite, setFavorite, clearFavorite, isFavorite } from './favorites'

// Mock localStorage
const store = new Map<string, string>()
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
} as Storage

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => {
  store.clear()
})

describe('getFavorite', () => {
  it('should return null when no favorite is set', () => {
    expect(getFavorite()).toBeNull()
  })

  it('should return the stored favorite', () => {
    setFavorite('Longmont High School', 'percussion-scholastic-a')
    const fav = getFavorite()
    expect(fav).toEqual({
      ensembleName: 'Longmont High School',
      classId: 'percussion-scholastic-a',
    })
  })
})

describe('setFavorite', () => {
  it('should store ensemble name and class ID', () => {
    setFavorite('Blue Knights', 'percussion-independent-world')
    const fav = getFavorite()
    expect(fav?.ensembleName).toBe('Blue Knights')
    expect(fav?.classId).toBe('percussion-independent-world')
  })

  it('should overwrite previous favorite', () => {
    setFavorite('Longmont High School', 'psa')
    setFavorite('Blue Knights', 'piw')
    expect(getFavorite()?.ensembleName).toBe('Blue Knights')
  })
})

describe('clearFavorite', () => {
  it('should remove the favorite', () => {
    setFavorite('Longmont High School', 'psa')
    clearFavorite()
    expect(getFavorite()).toBeNull()
  })
})

describe('isFavorite', () => {
  it('should return true for the favorited ensemble', () => {
    setFavorite('Longmont High School', 'psa')
    expect(isFavorite('Longmont High School')).toBe(true)
  })

  it('should return false for a different ensemble', () => {
    setFavorite('Longmont High School', 'psa')
    expect(isFavorite('Blue Knights')).toBe(false)
  })

  it('should return false when no favorite is set', () => {
    expect(isFavorite('Longmont High School')).toBe(false)
  })
})
