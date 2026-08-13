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
      className="btn btn-secondary shrink-0"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
