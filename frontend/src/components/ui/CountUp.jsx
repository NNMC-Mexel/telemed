import { useEffect, useMemo, useRef, useState } from 'react'

// Splits "1100+" into ["", 1100, "+"] and "4.9" into ["", 4.9, ""].
// Anything we can't parse is rendered verbatim.
const STAT_PATTERN = /^(\D*?)([\d]+(?:[.,][\d]+)?)(.*)$/s

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function parseStat(value) {
  const match = STAT_PATTERN.exec(String(value ?? ''))
  if (!match) return null

  const [, prefix, rawNumber, suffix] = match
  const target = Number(rawNumber.replace(',', '.'))
  if (!Number.isFinite(target)) return null

  const decimals = (rawNumber.split(/[.,]/)[1] || '').length
  return { target, format: (n) => `${prefix}${n.toFixed(decimals)}${suffix}` }
}

/**
 * Counts a stat up to its final value the first time it scrolls into view.
 * Prefixes and suffixes ("+", "%") are preserved so CMS-authored values keep
 * their exact formatting.
 */
function CountUp({ value, duration = 1600, className }) {
  const ref = useRef(null)
  const stat = useMemo(() => parseStat(value), [value])

  // Start at zero so the number is never blank before it animates. Values we
  // can't parse — and anyone who opted out of motion — render as authored.
  const [display, setDisplay] = useState(() =>
    stat && !prefersReducedMotion() ? stat.format(0) : null,
  )

  useEffect(() => {
    const node = ref.current
    if (!node || !stat || prefersReducedMotion()) return

    let frame = 0
    let start = 0

    const tick = (now) => {
      if (!start) start = now
      const progress = Math.min((now - start) / duration, 1)
      setDisplay(stat.format(stat.target * easeOutExpo(progress)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [stat, duration])

  return (
    <span ref={ref} className={className}>
      {display ?? value}
    </span>
  )
}

export default CountUp
