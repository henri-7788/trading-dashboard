interface FlipValueProps {
  value: string
  size?: 'lg' | 'md' | 'sm'
  tone?: 'bone' | 'amber' | 'up' | 'down'
}

const sizeClasses: Record<string, string> = {
  lg: 'h-12 min-w-[0.72em] text-3xl md:text-4xl px-1',
  md: 'h-8 min-w-[0.68em] text-lg px-0.5',
  sm: 'h-6 min-w-[0.62em] text-sm px-0.5'
}

const toneClasses: Record<string, string> = {
  bone: 'text-flap-bone',
  amber: 'text-flap-amber',
  up: 'text-up',
  down: 'text-down'
}

/** Renders each character in its own split-flap tile; a changed character remounts and replays the flip. */
export default function FlipValue({ value, size = 'md', tone = 'bone' }: FlipValueProps) {
  return (
    <span className="inline-flex gap-[3px] align-middle">
      {value.split('').map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          className={`flap-tile flap-flip flex items-center justify-center font-mono font-medium tabular ${sizeClasses[size]} ${toneClasses[tone]}`}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}
