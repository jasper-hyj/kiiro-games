import type { ReactNode } from 'react'

/** Thin outline icons (24px grid, 1.8 stroke) for the buttons in the top-right row. */
const base = (children: ReactNode) => (
  <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
export const IconHint = () => base(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></>)
export const IconLog = () => base(<><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>)
export const IconChat = () => base(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />)
export const IconSort = () => base(<><path d="M7 4v16M7 4 4 7M7 4l3 3" /><path d="M17 20V4M17 20l-3-3M17 20l3-3" /></>)
export const IconCoach = () => base(<><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.5V16c0 1.2 2.7 3 6 3s6-1.8 6-3v-4.5" /></>)
