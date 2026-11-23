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
export default function App() {
  return <AccountProvider>{isAdminPage() ? <Admin /> : isRoomPage() ? <RoomApp /> : isHoldem() ? <HoldemApp /> : isBlackjack() ? <BlackjackApp /> : isBigTwo() ? <BigTwoApp /> : isHub() ? <Hub /> : <MahjongApp />}</AccountProvider>
}
