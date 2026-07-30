'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export function CategorySelect({
  name,
  categories,
}: {
  name: string
  categories: { id: number; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(categories[0]?.id ?? null)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = categories.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function choose(index: number) {
    const cat = categories[index]
    if (!cat) return
    setSelectedId(cat.id)
    setActiveIndex(index)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActiveIndex((i) => Math.min(i + 1, categories.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault()
      choose(activeIndex)
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      {selectedId !== null && <input type="hidden" name={name} value={selectedId} />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded border border-rule bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
      >
        <span className={selected ? '' : 'text-muted'}>{selected?.name ?? 'Category'}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Category"
          className="absolute z-10 mt-1 w-full rounded border border-rule bg-background py-1 shadow-none"
        >
          {categories.map((c, i) => (
            <li key={c.id} role="option" aria-selected={c.id === selectedId}>
              <button
                type="button"
                onClick={() => choose(i)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors ${
                  i === activeIndex ? 'bg-surface text-foreground' : 'text-muted'
                }`}
              >
                {c.name}
                {c.id === selectedId && <Check size={14} strokeWidth={1.5} aria-hidden="true" className="text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
