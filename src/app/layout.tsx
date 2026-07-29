import type { Metadata, Viewport } from 'next'
import { TabBar } from '@/components/TabBar'
import { RegisterSW } from '@/components/RegisterSW'
import './globals.css'

export const metadata: Metadata = {
  title: 'Feedr',
  description: 'Agrégateur RSS personnel',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Feedr' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <main className="mx-auto max-w-lg px-4 pb-28 pt-4">{children}</main>
        <TabBar />
        <RegisterSW />
      </body>
    </html>
  )
}
