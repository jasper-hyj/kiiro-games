import { useState } from 'react'
import { useLang } from '../../i18n'
import '../chess/strings'

/** the "Resign" button with its confirmation (the texts are Chess's) */
export function Resign({ send }: { send(a: Record<string, unknown>): void }) {
  const { t } = useLang()
  const [ask, setAsk] = useState(false)
  return (
    <>
      <button className="hdbtn quiet" onClick={() => setAsk(true)}>
        {t('chResign')}
      </button>
      {ask && (
        <div className="acmodal" onClick={() => setAsk(false)}>
          <div className="acbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('chResignAsk')}>
            <h2>{t('chResignAsk')}</h2>
            <div className="acrow">
              <button className="ghost" onClick={() => setAsk(false)}>
                {t('chNo')}
              </button>
              <button
                className="primary"
                onClick={() => {
                  send({ k: 'act', a: { resign: true } })
                  setAsk(false)
                }}
              >
                {t('chYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
