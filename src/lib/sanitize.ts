import sanitizeHtml from 'sanitize-html'

/**
 * Règles d'assainissement du HTML d'article, partagées entre l'extraction
 * (`extract.ts`, avant l'écriture en base : on ne stocke jamais du HTML tiers
 * brut) et le rendu (`ArticleDetail`). C'est une politique de
 * stockage-et-rendu, pas une préoccupation de l'extraction elle-même — d'où
 * son propre module, à l'écart de `extract.ts` qui entraîne linkedom et
 * Readability et n'a rien à faire dans le bundle du navigateur.
 */
export const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    // `rel` doit être explicitement autorisé : sans lui, sanitize-html
    // retire l'attribut juste après que `transformTags` l'a posé, et le
    // noopener/noreferrer ci-dessous ne survivrait pas à l'assainissement.
    a: [...sanitizeHtml.defaults.allowedAttributes.a, 'rel'],
    img: ['src', 'alt'],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
}
