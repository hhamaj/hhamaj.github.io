/**
 * Win98-style "zoom rectangle": a caption-coloured frame that flies between two
 * screen rects when a window opens, restores or minimizes.
 */
export const zoomRect = (from: DOMRect, to: DOMRect, duration = 200): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()
  if (!from.width || !to.width) return Promise.resolve()

  const frame = (r: DOMRect) => ({
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  })

  const el = document.createElement('div')
  el.className = 'zoom-rect'
  Object.assign(el.style, frame(to))
  document.body.appendChild(el)

  const anim = el.animate([frame(from), frame(to)], { duration, easing: 'ease-out' })
  return anim.finished.then(
    () => el.remove(),
    () => el.remove()
  )
}

/** Screen rect of the first element matching `selector`, if it is rendered. */
export const rectOf = (selector: string): DOMRect | null => {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width && r.height ? r : null
}
