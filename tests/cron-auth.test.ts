import { describe, it, expect } from 'vitest'
import { isAuthorizedCron } from '@/lib/cron-auth'

const secret = 's3cr3t-de-test'

describe('isAuthorizedCron', () => {
  it("accepte l'en-tête Bearer envoyé par le cron Vercel", () => {
    expect(isAuthorizedCron({
      authorization: `Bearer ${secret}`, secretParam: null, secret,
    })).toBe(true)
  })

  it('accepte le query param, pour le déclenchement manuel au curl', () => {
    expect(isAuthorizedCron({
      authorization: null, secretParam: secret, secret,
    })).toBe(true)
  })

  it('refuse tout si CRON_SECRET n\'est pas configuré', () => {
    // Sans cette garde, un déploiement sans CRON_SECRET exposerait le poll à
    // n'importe qui envoyant « Bearer undefined ».
    expect(isAuthorizedCron({
      authorization: 'Bearer undefined', secretParam: null, secret: undefined,
    })).toBe(false)
    expect(isAuthorizedCron({
      authorization: null, secretParam: 'undefined', secret: undefined,
    })).toBe(false)
  })

  it('refuse un CRON_SECRET vide', () => {
    expect(isAuthorizedCron({
      authorization: null, secretParam: '', secret: '',
    })).toBe(false)
  })

  it('refuse un mauvais secret', () => {
    expect(isAuthorizedCron({
      authorization: 'Bearer pas-le-bon', secretParam: null, secret,
    })).toBe(false)
    expect(isAuthorizedCron({
      authorization: null, secretParam: 'pas-le-bon', secret,
    })).toBe(false)
  })

  it('refuse une requête sans en-tête ni param', () => {
    expect(isAuthorizedCron({
      authorization: null, secretParam: null, secret,
    })).toBe(false)
  })

  it('refuse le secret nu, sans le préfixe Bearer', () => {
    // Vercel envoie toujours « Bearer <secret> » : accepter la valeur nue
    // élargirait la surface sans raison.
    expect(isAuthorizedCron({
      authorization: secret, secretParam: null, secret,
    })).toBe(false)
  })

  it('refuse un préfixe Bearer mal cassé', () => {
    expect(isAuthorizedCron({
      authorization: `bearer ${secret}`, secretParam: null, secret,
    })).toBe(false)
  })
})
