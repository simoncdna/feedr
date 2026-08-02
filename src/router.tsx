import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from './integrations/tanstack-query/root-provider'

// Sens de la navigation, déduit de l'URL : ouvrir un article avance, le fermer
// recule. Le type est posé sur <html> pendant la transition, et styles.css s'en
// sert pour choisir la direction du glissement. Un navigateur qui ne connaît pas
// les types applique simplement le fondu croisé par défaut.
function typeDeTransition({
  fromLocation,
  toLocation,
}: {
  fromLocation?: { pathname: string; search: Record<string, unknown> }
  toLocation: { pathname: string; search: Record<string, unknown> }
}): Array<string> {
  if (!fromLocation) return []
  const article = (l: { pathname: string; search: Record<string, unknown> }) =>
    Boolean(l.search.article) || l.pathname.startsWith('/article')
  const avant = article(fromLocation)
  const apres = article(toLocation)
  if (!avant && apres) return ['nav-forward']
  if (avant && !apres) return ['nav-back']
  return []
}

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultViewTransition: { types: typeDeTransition },
    // Le squelette n'apparaît qu'au-delà de 150 ms d'attente — en dessous, il
    // clignoterait pour rien. Et une fois affiché il reste au moins 300 ms,
    // pour ne pas produire un flash encore plus désagréable que l'attente.
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
