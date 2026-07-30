'use client'

import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API unavailable (e.g. insecure context) — silently ignore
    }
  }

  return (
    <button
      onClick={copy}
      className="mono-label rounded border border-rule bg-surface px-3 py-1.5 transition-colors hover:text-foreground motion-reduce:transition-none"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
