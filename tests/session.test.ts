import { describe, expect, it } from 'vitest'
import { devBypassAllowed } from '@/lib/dev-bypass'

describe('devBypassAllowed', () => {
  it('refuse quand la variable est absente', () => {
    expect(devBypassAllowed({})).toBe(false)
  })

  it('refuse quand la variable ne vaut pas exactement 1', () => {
    expect(devBypassAllowed({ DEV_AUTH_BYPASS: 'true' })).toBe(false)
    expect(devBypassAllowed({ DEV_AUTH_BYPASS: '0' })).toBe(false)
  })

  it('refuse sur Vercel même si la variable est posée', () => {
    expect(devBypassAllowed({ DEV_AUTH_BYPASS: '1', VERCEL: '1' })).toBe(false)
  })

  it('autorise uniquement en local avec la variable explicite', () => {
    expect(devBypassAllowed({ DEV_AUTH_BYPASS: '1' })).toBe(true)
  })
})
