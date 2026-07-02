import { describe, it, expect } from 'vitest'
import { deleteMode } from './deleteDecision'

describe('deleteMode', () => {
  it('soft-deletes a referenced service', () => {
    expect(deleteMode(true)).toBe('soft')
  })
  it('hard-deletes an unreferenced service', () => {
    expect(deleteMode(false)).toBe('hard')
  })
})
