import { useEffect, useRef, useState } from 'react'

interface FlipValueProps {
  value: string
  size?: 'lg' | 'md' | 'sm'
  tone?: 'bone' | 'amber' | 'up' | 'down'
}

const sizeClasses: Record<string, string> = {
  lg: 'text-3xl md:text-4xl',
  md: 'text-lg',
  sm: 'text-sm'
}

const toneClasses: Record<string, string> = {
  bone: 'text-ink-100',
  amber: 'text-amber',
  up: 'text-up',
  down: 'text-down'
}

const flashClasses: Record<string, string> = {
  bone: 'value-flash-neutral',
  amber: 'value-flash-neutral',
  up: 'value-flash-up',
  down: 'value-flash-down'
}

/** Flashes its background briefly on value change, the way a ticker readout marks a live tick. */
export default function FlipValue({ value, size = 'md', tone = 'bone' }: FlipValueProps) {
  const prevValue = useRef(value)
  const [flashKey, setFlashKey] = useState(0)

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value
      setFlashKey((k) => k + 1)
    }
  }, [value])

  return (
    <span
      key={flashKey}
      className={`inline-block font-semibold tabular rounded-lg px-0.5 -mx-0.5 ${sizeClasses[size]} ${toneClasses[tone]} ${flashKey > 0 ? flashClasses[tone] : ''}`}
    >
      {value}
    </span>
  )
}
