import { useEffect, useRef, useState } from 'react'

interface FlipValueProps {
  value: string
  size?: 'xl' | 'lg' | 'md' | 'sm'
  tone?: 'bone' | 'amber' | 'up' | 'down' | 'teal' | 'white'
}

const sizeClasses: Record<string, string> = {
  xl: 'text-[2.25rem] leading-none md:text-[2.75rem]',
  lg: 'text-[1.625rem] leading-tight md:text-[1.875rem]',
  md: 'text-lg',
  sm: 'text-sm'
}

const toneClasses: Record<string, string> = {
  bone: 'text-ink-900',
  amber: 'text-amber',
  teal: 'text-teal-800',
  white: 'text-white',
  up: 'text-up',
  down: 'text-down'
}

const flashClasses: Record<string, string> = {
  bone: 'value-flash-neutral',
  amber: 'value-flash-neutral',
  teal: 'value-flash-neutral',
  white: '',
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
      className={`inline-block font-normal tracking-[-0.02em] tabular rounded-lg px-0.5 -mx-0.5 ${sizeClasses[size]} ${toneClasses[tone]} ${flashKey > 0 ? flashClasses[tone] : ''}`}
    >
      {value}
    </span>
  )
}
