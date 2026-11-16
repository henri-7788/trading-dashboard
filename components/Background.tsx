/**
 * Page ground shared by every route: a cool grey field with the deep petrol hero band across the
 * top. Content scrolls over it; the band stays anchored to the top of the document, not the
 * viewport, so it reads as the header's material rather than a fixed backdrop.
 */
export default function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] md:h-[620px] overflow-hidden">
      <div className="hero-band absolute inset-0" />
    </div>
  )
}
