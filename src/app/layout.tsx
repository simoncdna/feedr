import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'
import { RegisterSW } from '@/components/RegisterSW'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Feedr',
  description: 'Personal RSS reader',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Feedr' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c0e' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.theme;if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;var c=t==='dark'?'#0c0c0e':'#ffffff';var o=document.querySelector('meta[name="theme-color"][data-theme-override]');if(!o){o=document.createElement('meta');o.setAttribute('name','theme-color');o.setAttribute('data-theme-override','');document.head.insertBefore(o,document.head.querySelector('meta[name="theme-color"]'))}o.setAttribute('content',c)}}catch(e){}`,
          }}
        />
        <div className="lg:flex">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main className="mx-auto w-full max-w-lg pb-28 pt-4 lg:m-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:p-0">
            {children}
          </main>
        </div>
        <TabBar />
        <RegisterSW />
      </body>
    </html>
  )
}
