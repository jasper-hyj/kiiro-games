import { useLang } from '../../i18n'

/** A collapsed "how to play" box: each game passes the keys of its rule lines. */
export function Rules({ title, lines }: { title: string; lines: string[] }) {
  const { t } = useLang()
  return (
    <details className="hdrules">
      <summary>{t(title)}</summary>
      <ul>
        {lines.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
    </details>
  )
}
