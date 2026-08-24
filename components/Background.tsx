/**
 * Ambient gradient mesh the whole app's glass panels blur against. Liquid Glass reads as
 * translucent material only when there's something with color and shape behind it — a flat
 * black page makes every backdrop-blur panel invisible. Mounted once in _app so it's shared,
 * fixed, and never re-renders per navigation.
 */
export default function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      <div className="bg-drift-a absolute -top-1/4 -left-1/4 h-[70vmax] w-[70vmax] rounded-full bg-signal/25 blur-[120px]" />
      <div className="bg-drift-b absolute -bottom-1/3 -right-1/4 h-[65vmax] w-[65vmax] rounded-full bg-up/20 blur-[130px]" />
      <div className="bg-drift-c absolute top-1/3 right-1/4 h-[50vmax] w-[50vmax] rounded-full bg-amber/10 blur-[130px]" />
      <div className="absolute inset-0 bg-ink-950/40" />
    </div>
  )
}
