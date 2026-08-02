import { useRef, useState } from 'react'

const MIN = 280
const MAX = 720
const DEFAULT = 384
const KEY = 'feedr.listWidth'

function initialWidth(): number {
	if (typeof window === 'undefined') return DEFAULT
	try {
		const saved = Number(localStorage.getItem(KEY))
		if (Number.isFinite(saved) && saved >= MIN && saved <= MAX) return saved
	} catch { }
	return DEFAULT
}

export function ResizablePanes({ list, detail }: { list: React.ReactNode; detail: React.ReactNode }) {
	const [width, setWidth] = useState(initialWidth)
	const widthRef = useRef(width)
	const containerRef = useRef<HTMLDivElement>(null)
	const dragging = useRef(false)

	function apply(w: number, persist: boolean) {
		const clamped = Math.min(MAX, Math.max(MIN, w))
		widthRef.current = clamped
		setWidth(clamped)
		if (persist) {
			try {
				localStorage.setItem(KEY, String(Math.round(clamped)))
			} catch { }
		}
	}

	function onPointerDown(e: React.PointerEvent) {
		dragging.current = true
			; (e.target as HTMLElement).setPointerCapture(e.pointerId)
		document.body.style.userSelect = 'none'
		document.body.style.cursor = 'col-resize'
	}

	function onPointerMove(e: React.PointerEvent) {
		if (!dragging.current || !containerRef.current) return
		apply(e.clientX - containerRef.current.getBoundingClientRect().left, false)
	}

	function endDrag() {
		if (!dragging.current) return
		dragging.current = false
		document.body.style.userSelect = ''
		document.body.style.cursor = ''
		apply(widthRef.current, true)
	}

	return (
		<div
			ref={containerRef}
			suppressHydrationWarning
			className="lg:grid lg:h-dvh sticky bg-background"
			style={{ gridTemplateColumns: `${width}px 1px minmax(0, 1fr)` }}
		>
			{list}
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize panels"
				tabIndex={0}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onKeyDown={(e) => {
					if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
						e.preventDefault()
						apply(widthRef.current + (e.key === 'ArrowRight' ? 24 : -24), true)
					}
				}}
				className="relative hidden bg-rule outline-none focus-visible:bg-accent lg:block"
			>
				<div aria-hidden="true" className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
			</div>
			{detail}
		</div>
	)
}
