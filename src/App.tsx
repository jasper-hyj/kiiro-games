import { Hub } from './hub/Hub'
import MahjongApp from './games/mahjong/MahjongApp'
import Admin from './account/Admin'
import { AccountProvider } from './account/Account'
import HoldemApp from './games/holdem/HoldemApp'
import BlackjackApp from './games/blackjack/BlackjackApp'
import BigTwoApp from './games/bigtwo/BigTwoApp'
import RoomApp from './room/RoomApp'
import { isRoomPage, isAdminPage, isBigTwo, isBlackjack, isHoldem, isHub } from './route'

/** The site: a hub at "/", Mahjong at "/mahjong", Hold'em at "/holdem", an admin page at "/admin"; each game has its own folder under src/games/. */
/** One way in: a game page with no table to open goes to the room flow with that game preselected (practice and shared links stay direct). */
function Redirect({ to }: { to: string }) { location.replace(to); return null }
const q = () => new URLSearchParams(location.search)
const direct = (extra: string[] = []) => ['room', 'practice', ...extra].some((k) => q().has(k))
const MJ_DIRECT = ['solo', 'tutorial', 'tiles', 'stress', 'debug', 'rule', 'players']

export default function App() {
  return <AccountProvider>{isAdminPage() ? <Admin /> : isRoomPage() ? <RoomApp /> : isHoldem() ? (direct() ? <HoldemApp /> : <Redirect to="/room?create=1&pick=holdem" />) : isBlackjack() ? (direct() ? <BlackjackApp /> : <Redirect to="/room?create=1&pick=blackjack" />) : isBigTwo() ? (direct() ? <BigTwoApp /> : <Redirect to="/room?create=1&pick=bigtwo" />) : isHub() ? <Hub /> : (direct(MJ_DIRECT) ? <MahjongApp /> : <Redirect to="/room?create=1&pick=mahjong" />)}</AccountProvider>
}
