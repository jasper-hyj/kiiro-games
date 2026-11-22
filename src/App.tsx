import { Hub } from './hub/Hub'
import MahjongApp from './games/mahjong/MahjongApp'
import { isHub } from './route'

/** The site: a hub at "/" and one folder per game under src/games/. */
export default function App() {
  return isHub() ? <Hub /> : <MahjongApp />
}
