import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** The table is designed once at 1600 x (720..900) and scaled to fit any window.
 *  Wider windows get a shorter stage; on a portrait phone the stage rotates sideways if that gives larger tiles. */
export const STAGE_W = 1600
/** A squarer window (tablet held upright) gets a narrower, taller design so the table can use the height instead of leaving bands above and below. */
const fit = (aw: number, ah: number) => {
  const ratio = aw / Math.max(1, ah)
  // upright phone / tablet: a narrow, tall design (small side columns) so the table fills the width; squarish window: 1000 wide; landscape: 1600 wide
  const sw = ratio < 0.8 ? 700 : ratio < 1.25 ? 1000 : STAGE_W
  const dh = Math.min(sw === STAGE_W ? 760 : 1000, Math.max(480, (sw * ah) / Math.max(1, aw)))
  return { dh, sw, s: Math.min(aw / sw, ah / dh) }
}

export function Stage({ children, allowRotate = true }: { children: ReactNode; allowRotate?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current!
    const measure = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    // iOS Safari can report the old size right after a rotation or while the URL bar animates,
    // so re-measure on every signal and again shortly after
    const timers: number[] = []
    const settle = () => {
      measure()
      timers.forEach(clearTimeout)
      timers.length = 0
      for (const ms of [100, 300, 700]) timers.push(window.setTimeout(measure, ms))
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    const vv = window.visualViewport
    window.addEventListener('orientationchange', settle)
    window.addEventListener('resize', settle)
    window.addEventListener('pageshow', settle)
    vv?.addEventListener('resize', settle)
    return () => {
      ro?.disconnect()
      timers.forEach(clearTimeout)
      window.removeEventListener('orientationchange', settle)
      window.removeEventListener('resize', settle)
      window.removeEventListener('pageshow', settle)
      vv?.removeEventListener('resize', settle)
    }
  }, [])
  const land = fit(box.w, box.h)
  const port = fit(box.h, box.w)
  const rotate = allowRotate && box.w > 0 && port.s > land.s * 1.05
  const f = rotate ? port : land
  const style = {
    width: f.sw,
    height: f.dh,
    transform: `translate(-50%, -50%) ${rotate ? 'rotate(90deg) ' : ''}scale(${f.s || 0.01})`,
    '--s': f.s || 0.01,
    '--H': f.dh,
    '--SW': f.sw,
  } as CSSProperties
  return (
    <div className="stagewrap" ref={ref} data-rotated={rotate ? '1' : '0'} data-narrow={f.sw === 700 ? '1' : '0'}>
      {box.w > 0 && (
        <div className="stage" style={style}>
          {children}
        </div>
      )}
    </div>
  )
}
