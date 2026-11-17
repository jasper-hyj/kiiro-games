import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'zh'

// key: [English, 繁體中文]
const D: Record<string, [string, string]> = {
  brand: ['Kiiro Mahjong', 'Kiiro 麻將'],
  leave: ['Leave', '離開'],
  back: ['Back', '返回'], continue: ['Continue', '繼續'], chooseRules: ['Choose your rules', '選擇規則'], createRoom: ['Create room', '建立房間'],
  room: ['Room', '房間'],
  connecting: ['Connecting…', '連線中…'],
  connLost: ['Connection lost. Trying to reconnect…', '連線中斷，重新連線中…'],
  reconnecting: ['Reconnecting…', '重新連線中…'],
  tagline: ['Taiwanese, Hong Kong and Japanese mahjong. Play friends online — bots fill empty seats.', '台灣、香港與日本麻將。和朋友線上對戰，空位由電腦補上。'],
  step1: ['1 · Choose rules', '1 · 選擇規則'],
  step2: ['2 · Your name', '2 · 你的暱稱'],
  step3: ['3 · Play', '3 · 開始遊戲'],
  playFriends: ['Play with friends', '和朋友玩'],
  playBots: ['Play vs bots', '對戰電腦'],
  haveCode: ['Have a code?', '有房號嗎？'],
  roomCode: ['ROOM CODE', '房號'],
  join: ['Join', '加入'],
  options: ['Options', '選項'],
  length: ['Length', '局數'],
  eastRound: ['East round', '東風戰'],
  fullGame: ['Full game', '全莊（四圈）'],
  eastOnly: ['East only', '東風戰'],
  eastSouth: ['East + South', '東南戰'],
  players: ['Players', '人數'],
  sanma: ['3 (sanma)', '3 人（三麻）'],
  redFives: ['Red fives', '赤牌'],
  on: ['On', '開'], off: ['Off', '關'],
  minFan: ['Minimum fan', '最低番數'],
  bots: ['Bots', '電腦強度'], easy: ['Easy', '簡單'], normal: ['Normal', '普通'], hard: ['Hard', '困難'],
  rulesRef: ['Rules reference', '規則說明'],
  close: ['Close', '關閉'],
  nickname: ['Nickname', '暱稱'],
  yourName: ['Your name', '你的名字'],
  joinRoomTitle: ['Join room', '加入房間'],
  invited: ['You were invited to play mahjong. Pick a nickname to sit down — empty seats are played by bots.', '你被邀請來打麻將。輸入暱稱即可入座，空位由電腦補上。'],
  joinRoom: ['Join room', '加入房間'],
  backMenu: ['Back to menu', '回主選單'],
  // rule cards
  'riichi.name': ['Japanese Riichi', '日本麻將'],
  'riichi.blurb': ['13 tiles · yaku required · riichi, dora & red fives · han/fu scoring', '13 張 · 需有役 · 立直、寶牌、赤牌 · 翻符計分'],
  'hk.name': ['Hong Kong', '香港麻將'],
  'hk.blurb': ['13 tiles · 8 flowers · 3-fan minimum · fan doubling table', '13 張 · 8 張花牌 · 最低 3 番起胡 · 番數倍增'],
  'taiwan.name': ['Taiwanese', '台灣麻將'],
  'taiwan.blurb': ['16 tiles · 8 flowers · tai scoring · dealer streaks', '16 張 · 8 張花牌 · 台數計分 · 連莊拉莊'],
  // room lobby
  inviteLink: ['Copy invite link', '複製邀請連結'],
  copied: ['Copied!', '已複製！'],
  seats: ['Seats', '座位'],
  seatsNote: ['humans — empty seats play as bots', '位玩家 — 空位由電腦代打'],
  you: ['you', '你'],
  human: ['Human', '玩家'],
  botReserved: ['Bot (reserved)', '電腦（保留）'],
  openSeat: ['Open — bot if nobody joins', '開放 — 無人加入則由電腦代打'],
  openThis: ['Open this seat', '開放此座位'],
  makeBot: ['Make bot', '改為電腦'],
  gameSettings: ['Game settings', '遊戲設定'],
  hostDecides: ['(host decides)', '（由房主決定）'],
  startGame: ['Start game', '開始遊戲'],
  waitHost: ['Waiting for the host to start…', '等待房主開始…'],
  // table
  tsumo: ['Tsumo', '自摸'], ron: ['Ron', '胡'], pon: ['Pon', '碰'], kan: ['Kan', '槓'], chi: ['Chi', '吃'], pass: ['Pass', '過'],
  riichi: ['Riichi', '立直'], cancelRiichi: ['Cancel Riichi', '取消立直'], addKan: ['Add Kan', '加槓'], nuki: ['Nuki', '拔北'],
  abortDraw: ['Abort draw (9 terminals/honors)', '九種九牌流局'],
  autoWin: ['Auto-win', '自動胡牌'], autoDiscard: ['Auto-discard', '自動摸切'], skipCalls: ['Skip calls', '不吃碰槓'], hints: ['Hints', '提示'],
  autoWinTip: ['Automatically declare ron / tsumo when you can win', '可胡牌時自動胡牌／自摸'],
  autoDiscardTip: ['Automatically discard the tile you draw (unless you can win)', '自動打出摸到的牌（可胡時除外）'],
  skipCallsTip: ['Automatically pass on chi / pon / kan', '自動略過吃／碰／槓'],
  hintsTip: ['Show waits and shanten', '顯示聽牌與向聽數'],
  history: ['Round history', '對局紀錄'],
  noHistory: ['No hands played yet.', '尚未完成任何一局。'],
  drawShort: ['Draw', '流局'],
  shortcuts: ['Keyboard shortcuts', '鍵盤快捷鍵'],
  'sc.move': ['Move through your hand', '在手牌間移動'], 'sc.discard': ['Discard the selected tile', '打出選取的牌'], 'sc.tsumogiri': ['Discard the tile you just drew', '打出剛摸到的牌'],
  'sc.tsumo': ['Tsumo (win)', '自摸'], 'sc.ron': ['Ron (win)', '胡'], 'sc.pon': ['Pon', '碰'], 'sc.chi': ['Chi (1-3 picks a combination)', '吃（1-3 選擇組合）'], 'sc.kan': ['Kan', '槓'],
  'sc.pass': ['Pass', '過'], 'sc.riichi': ['Riichi mode', '立直模式'], 'sc.next': ['Next hand (on the result screen)', '下一局（結果畫面）'],
  chatTitle: ['Chat', '快速聊天'],
  'chat.hello': ['Hello!', '大家好！'], 'chat.nice': ['Nice!', '好牌！'], 'chat.thanks': ['Thanks!', '謝謝！'], 'chat.hurry': ['Hurry up!', '快點～'], 'chat.oops': ['Oops!', '糟糕！'], 'chat.gg': ['Good game!', '打得好！'],
  leftTiles: ['{n} left', '剩 {n} 張'],
  noValue: ['no win (needs a yaku / minimum)', '不能胡（缺役／未達最低）'],
  furiten: ['Furiten', '振聽'],
  hand: ['Hand', '手牌'],
  menu: ['Menu', '選單'],
  doraInd: ['Dora indicators', '寶牌指示牌'],
  doraInHand: ['Dora in your hand (dora + red fives + norths)', '手牌中的寶牌（寶牌＋赤牌＋拔北）'],
  doraRow: ['Dora', '寶牌'],
  uraRow: ['Ura dora', '裏寶牌'],
  cantJoin: ["Can't join this room", '無法加入此房間'],
  room_full: ['This room is full — all four seats are taken by players.', '此房間已滿，四個座位都有玩家。'],
  bad_id: ['Your browser sent an invalid player id. Reload the page and try again.', '玩家識別碼無效，請重新整理頁面後再試。'],
  rotate: ['Rotate table on phones', '手機自動旋轉牌桌'],
  rotateTip: ['Turn the table sideways when the phone is held upright, so tiles are bigger', '手機直拿時將牌桌轉成橫向，牌會更大'],
  onlineOff: ['Online rooms are not set up on this site yet (the game server address is missing). Play vs bots instead.', '此網站尚未設定線上房間（缺少遊戲伺服器位址），請先選擇「對戰電腦」。'],
  conn_failed: ['Could not reach the game server. Check your connection and try again.', '無法連線到遊戲伺服器，請檢查網路後再試。'],
  calcTw: ['Base 30 + 10 per tai: 30 + 10 × {n} = {base} from each payer', '底 30 + 每台 10：30 + 10 × {n} = {base}（每位付款者）'],
  calcHk: ['{n} fan = {base} points (self-draw: each pays {base}; discard: the discarder pays double)', '{n} 番 = {base} 點（自摸每家付 {base}；放槍者付雙倍）'],
  withRiichi: ['(with riichi)', '（立直後）'],
  discard: ['Discard', '打出'],
  discarded: ['{name} discarded', '{name} 打出'],
  choose: ['Choose an action', '請選擇動作'],
  auto: ['Auto', '自動'],
  yourTurn: ['Your turn — tap a tile twice to discard', '輪到你了 — 點兩下牌即可打出'],
  turnOf: ["{name}'s turn", '{name} 的回合'],
  waitingOthers: ['Waiting for other players…', '等待其他玩家…'],
  wall: ['Wall', '牌山'],
  dealer: ['Dealer', '莊家'],
  streak: ['Dealer streak', '連莊'],
  honba: ['Honba', '本場'],
  sticks: ['Riichi sticks', '立直棒'],
  away: ['away', '離線'],
  complete: ['Complete!', '胡牌！'],
  tenpai: ['Tenpai', '聽牌'],
  shanten: ['{n}-shanten', '{n} 向聽'],
  waits: ['waits:', '聽：'],
  discardWaits: ['discard → waits:', '打出 → 聽：'],
  threePlayers: ['3 players', '三人麻將'],
  timeLeft: ['{s}s', '{s} 秒'],
  // winds
  'wind.0': ['East', '東'], 'wind.1': ['South', '南'], 'wind.2': ['West', '西'], 'wind.3': ['North', '北'],
  roundName: ['{wind} {n}', '{wind}{n}局'],
  // result
  winsTsumo: ['{name} wins by tsumo', '{name} 自摸'],
  winsRon: ['{name} wins by ron ({from} dealt in)', '{name} 胡牌（{from} 放槍）'],
  alsoWins: ['{name} also wins (double ron)', '{name} 一炮雙響'],
  drawTitle: ['Draw — wall exhausted', '流局 — 牌牆已空'],
  tenpaiPlayers: ['Tenpai: {names}', '聽牌：{names}'],
  nobody: ['nobody', '無人'],
  uraDora: ['Ura dora:', '裏寶牌：'],
  riichiSticksWon: ['+{n} from riichi sticks', '+{n} 立直棒'],
  nextHand: ['Next hand', '下一局'],
  waitingAck: ['Waiting… ({n})', '等待中…（{n}）'],
  gameOver: ['Game over', '遊戲結束'],
  backLobby: ['Back to lobby', '回大廳'],
  pts: ['pts', '分'],
  han: ['han', '翻'], fan: ['fan', '番'], tai: ['tai', '台'], fu: ['fu', '符'],
  yakuman: ['Yakuman', '役滿'],
  'label.Mangan': ['Mangan', '滿貫'], 'label.Haneman': ['Haneman', '跳滿'], 'label.Baiman': ['Baiman', '倍滿'], 'label.Sanbaiman': ['Sanbaiman', '三倍滿'],
  'label.Yakuman': ['Yakuman', '役滿'], 'label.Kazoe Yakuman': ['Kazoe Yakuman', '累計役滿'], 'label.Limit': ['Limit', '滿番'],
  'draw.Exhaustive draw': ['Draw — wall exhausted', '流局 — 牌牆已空'],
  'draw.Abortive draw (nine terminals/honors)': ['Abortive draw (nine terminals/honors)', '九種九牌流局'],
  'draw.Abortive draw (four winds)': ['Abortive draw (four winds)', '四風連打流局'],
  'draw.Abortive draw (four riichi)': ['Abortive draw (four riichi)', '四家立直流局'],
  'draw.Abortive draw (four kans)': ['Abortive draw (four kans)', '四槓散了流局'],
  'draw.Abortive draw (triple ron)': ['Abortive draw (triple ron)', '三家和流局'],
}

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: string, vars?: Record<string, string | number>) => string }
const C = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => k })

const detect = (): Lang => {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'en' || q === 'zh') return q
    const saved = localStorage.getItem('kiiro-lang')
    if (saved === 'en' || saved === 'zh') return saved
  } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && /^zh/i.test(navigator.language) ? 'zh' : 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect)
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('kiiro-lang', l) } catch { /* ignore */ } }
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'; document.title = lang === 'zh' ? 'Kiiro 麻將' : 'Kiiro Mahjong' }, [lang])
  const value = useMemo<Ctx>(() => ({
    lang, setLang,
    t: (k, vars) => {
      const e = D[k]
      let s = e ? e[lang === 'zh' ? 1 : 0] : k
      if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b))
      return s
    },
  }), [lang])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useLang = () => useContext(C)

/** Pick the display name of a scoring item for the current language. */
export const yakuName = (y: { name: string; zh?: string }, lang: Lang) => (lang === 'zh' ? y.zh ?? y.name : y.name)
