// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { App } from '@/ui/App'

// Catches runtime/render crashes that a clean `tsc` build would not — the exact
// class of bug that shows as a white screen in production.
beforeAll(() => {
  // jsdom has no IndexedDB; the title screen probes it via idb-keyval. Stub it
  // so a missing API doesn't masquerade as an app bug.
  // @ts-expect-error minimal stub
  globalThis.indexedDB = undefined
})

describe('App renders', () => {
  it('mounts the title screen without throwing', () => {
    render(<App />)
    expect(screen.getByText(/Team Manager/i)).toBeTruthy()
    cleanup()
  })
})
