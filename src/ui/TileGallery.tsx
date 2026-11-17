import { Side, Tile } from './Tile'

/** Dev page (?tiles) that shows every tile face and the meld / riichi layouts. */
export function TileGallery() {
  const kinds = Array.from({ length: 42 }, (_, i) => i)
  const idOf = (k: number) => (k >= 34 ? 136 + (k - 34) : k * 4 + 1)
  return (
    <div className="page" style={{ '--tw': '44px' } as React.CSSProperties}>
      <h1>Tiles</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0 22px' }}>
        {kinds.map((k) => <Tile key={k} id={idOf(k)} />)}
        <Tile back />
      </div>
      <h2>Small (pond size)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '10px 0 22px', ['--tw' as string]: '20px' }}>
        {kinds.slice(0, 34).map((k) => <Tile key={k} id={idOf(k)} />)}
      </div>
      <h2>Melds &amp; riichi</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', margin: '10px 0' }}>
        <div className="meld"><Side><Tile id={idOf(4)} hot /></Side><Tile id={idOf(3)} /><Tile id={idOf(5)} /></div>
        <div className="meld"><Tile id={idOf(31)} /><Side><Tile id={idOf(31)} hot /></Side><Tile id={idOf(31)} /></div>
        <div className="meld"><Tile id={idOf(9)} /><Tile id={idOf(9)} /><Side double><Tile id={idOf(9)} hot /><Tile id={idOf(9)} /></Side></div>
        <div className="meld"><Tile back /><Tile id={idOf(30)} /><Tile id={idOf(30)} /><Tile back /></div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}><Tile id={idOf(1)} /><Side><Tile id={idOf(2)} /></Side><Tile id={idOf(3)} /></div>
      </div>
    </div>
  )
}
