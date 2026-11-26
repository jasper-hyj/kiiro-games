import { Side, Tile } from './Tile'

/** Dev page (?tiles) that shows every tile face and the meld / riichi layouts. */
export function TileGallery() {
  const kinds = Array.from({ length: 42 }, (_, i) => i)
  const idOf = (k: number) => (k >= 34 ? 136 + (k - 34) : k * 4 + 1)
  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <h1>Tiles</h1>
      {[68, 44, 30, 20].map((w) => (
        <div key={w}>
          <h2>{w}px wide</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: Math.max(3, w / 8), margin: '8px 0 18px', ['--tw' as string]: w + 'px' }}>
            {kinds.map((k) => (
              <Tile key={k} id={idOf(k)} />
            ))}
            <Tile back />
          </div>
        </div>
      ))}
      <h2>Melds &amp; riichi</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', margin: '10px 0' }}>
        <div className="meld">
          <Side>
            <Tile id={idOf(4)} hot />
          </Side>
          <Tile id={idOf(3)} />
          <Tile id={idOf(5)} />
        </div>
        <div className="meld">
          <Tile id={idOf(31)} />
          <Side>
            <Tile id={idOf(31)} hot />
          </Side>
          <Tile id={idOf(31)} />
        </div>
        <div className="meld">
          <Tile id={idOf(9)} />
          <Tile id={idOf(9)} />
          <Side double>
            <Tile id={idOf(9)} hot />
            <Tile id={idOf(9)} />
          </Side>
        </div>
        <div className="meld">
          <Tile back />
          <Tile id={idOf(30)} />
          <Tile id={idOf(30)} />
          <Tile back />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Tile id={idOf(1)} />
          <Side>
            <Tile id={idOf(2)} />
          </Side>
          <Tile id={idOf(3)} />
        </div>
      </div>
    </div>
  )
}
