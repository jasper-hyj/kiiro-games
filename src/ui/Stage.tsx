import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** The table is designed once at 1600 x (720..900) and scaled to fit any window.
 *  Wider windows get a shorter stage; on a portrait phone the stage rotates sideways if that gives larger tiles. */
export const STAGE_W = 1600
const fit = (aw: number, ah: number) => {
  const dh = Math.min(900, Math.max(720, (STAGE_W * ah) / Math.max(1, aw)))
  return { dh, s: Math.min(aw / STAGE_W, ah / dh) }
}

export function Stage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current!
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('orientationchange', measure)
    return () => { ro.disconnect(); window.removeEventListener('orientationchange', measure) }
  }, [])
  const land = fit(box.w, box.h)
  const port = fit(box.h, box.w)
  const rotate = box.w > 0 && port.s > land.s * 1.05
  const f = rotate ? port : land
  const style = {
    width: STAGE_W, height: f.dh,
    transform: `translate(-50%, -50%) ${rotate ? 'rotate(90deg) ' : ''}scale(${f.s || 0.01})`,
    '--s': f.s || 0.01, '--H': f.dh,
  } as CSSProperties
  return (
    <div className="stagewrap" ref={ref} data-rotated={rotate ? '1' : '0'}>
      {box.w > 0 && <div className="stage" style={style}>{children}</div>}
    </div>
  )
}
