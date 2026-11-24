import { Hub } from './hub/Hub'
import MahjongApp from './games/mahjong/MahjongApp'
import Admin from './account/Admin'
import { AccountProvider } from './account/Account'
import HoldemApp from './games/holdem/HoldemApp'
import BlackjackApp from './games/blackjack/BlackjackApp'
import BigTwoApp from './games/bigtwo/BigTwoApp'
import RoomApp from './room/RoomApp'
import { legacyTarget, newRoomUrl, route } from './route'

/**
 * The page for the current address (all addresses are described in src/route.ts). Old-style addresses are rewritten first.
 * A game's bare address (/holdem) has nothing to show, so it opens a new room for that game.
 */
function Redirect({ to }: { to: string }) { location.replace(to); return null }

export default function App() {
  const old = legacyTarget()
  if (old) return <Redirect to={old} />
  const r = route()
  const page = (() => {
    switch (r.page) {
      case 'admin': return <Admin />
      case 'room': return <RoomApp />
      case 'hub': return <Hub />
      case 'gameStart': return <Redirect to={newRoomUrl(r.game)} />
      case 'tiles': return <MahjongApp />
      default: // a table, or practice against bots
        return r.game === 'holdem' ? <HoldemApp /> : r.game === 'blackjack' ? <BlackjackApp /> : r.game === 'bigtwo' ? <BigTwoApp /> : <MahjongApp />
    }
  })()
  return <AccountProvider>{page}</AccountProvider>
}
