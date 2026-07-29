import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import sanitizeHtml from 'sanitize-html'
import { db } from '@/db'
import { articles, feeds } from '@/db/schema'
import { toggleBookmark } from '@/app/actions'
import { relativeDate } from '@/lib/text'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId)) notFound()

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      link: articles.link,
      description: articles.description,
      content: articles.content,
      publishedAt: articles.publishedAt,
      bookmarked: articles.bookmarked,
      feedTitle: feeds.title,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.id, numericId))
    .limit(1)

  const article = rows[0]
  if (!article) notFound()

  const raw = article.content ?? article.description
  const safe = raw
    ? sanitizeHtml(raw, {
        allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt'],
        },
      })
    : null

  return (
    <article>
      <p className="text-xs text-neutral-500">
        {article.feedTitle} · {relativeDate(article.publishedAt)}
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>
        <form action={toggleBookmark.bind(null, article.id, !article.bookmarked)}>
          <button
            aria-label={article.bookmarked ? 'Retirer le bookmark' : 'Bookmarker'}
            className={`-m-2 mt-1 p-2 ${article.bookmarked ? 'text-orange-500' : 'text-neutral-400'}`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill={article.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M6 4h12v17l-6-4-6 4z" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
      {safe && (
        <div
          className="prose prose-neutral mt-4 max-w-none dark:prose-invert prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      )}
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 block rounded-xl bg-orange-500 py-3 text-center font-semibold text-white"
      >
        Lire sur le site
      </a>
    </article>
  )
}
