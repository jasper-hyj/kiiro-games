import { Hub } from './hub/Hub'
import MahjongApp from './games/mahjong/MahjongApp'
import Admin from './account/Admin'
import { AccountProvider } from './account/Account'
import HoldemApp from './games/holdem/HoldemApp'
import { isAdminPage, isHoldem, isHub } from './route'

/** The site: a hub at "/", Mahjong at "/mahjong", Hold'em at "/holdem", an admin page at "/admin"; each game has its own folder under src/games/. */
export default function App() {
  return <AccountProvider>{isAdminPage() ? <Admin /> : isHoldem() ? <HoldemApp /> : isHub() ? <Hub /> : <MahjongApp />}</AccountProvider>
}
