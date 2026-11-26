/** Small line pictograms, one per game, drawn on a cream medal. */
export const ART: Record<string, JSX.Element> = {
  mahjong: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <g transform="rotate(-7 19 24)">
        <rect x="8" y="9" width="22" height="30" rx="4" fill="#fbf6ea" />
        <rect x="11" y="12" width="16" height="24" rx="2" opacity=".3" />
        <circle cx="14.6" cy="29.5" r="2.6" />
        <circle cx="19" cy="24" r="2.6" />
        <circle cx="23.4" cy="18.5" r="2.6" />
      </g>
      <g transform="rotate(6 45 24)">
        <rect x="34" y="9" width="22" height="30" rx="4" fill="#fbf6ea" />
        <rect x="37" y="12" width="16" height="24" rx="2" opacity=".3" />
        <rect x="40" y="19" width="10" height="9" rx="1" />
        <path d="M45 15v18" />
      </g>
    </svg>
  ),
  holdem: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <g transform="rotate(-9 20 24)">
        <rect x="9" y="7" width="22" height="32" rx="4" fill="#fbf6ea" />
        <path d="M12.5 17l2.5-6 2.5 6M13.5 15h3" stroke-width="1.3" />
        <path d="M20 18.5c-4.2 4-7 5.6-7 8.6a3.2 3.2 0 0 0 5.6 2L17.7 34h4.6l-.9-4.9a3.2 3.2 0 0 0 5.6-2c0-3-2.8-4.6-7-8.6z" transform="translate(0 2)" />
      </g>
      <g transform="rotate(9 45 24)">
        <rect x="34" y="7" width="22" height="32" rx="4" fill="#fbf6ea" />
        <path d="M38 11v6M38 14l4-3M38 14l4 3" stroke-width="1.3" />
        <path d="M45 33c-5-3.6-7.6-6.2-7.6-9.2a3.7 3.7 0 0 1 7.6-1.1 3.7 3.7 0 0 1 7.6 1.1c0 3-2.6 5.6-7.6 9.2z" transform="translate(0 -1)" />
      </g>
    </svg>
  ),
  blackjack: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <g transform="rotate(-8 22 26)">
        <rect x="6" y="7" width="22" height="32" rx="4" fill="#fbf6ea" />
        <path d="M9.5 17l2.5-6 2.5 6M10.5 15h3" stroke-width="1.3" />
        <path
          transform="translate(1 4) scale(.7)"
          d="M17 17.5c-3.4 3.2-5.6 4.5-5.6 7a2.6 2.6 0 0 0 4.5 1.6L15.2 30h3.6l-.7-3.9a2.6 2.6 0 0 0 4.5-1.6c0-2.5-2.2-3.8-5.6-7z"
        />
      </g>
      <g transform="rotate(5 32 26)">
        <rect x="19" y="7" width="22" height="32" rx="4" fill="#fbf6ea" />
        <path d="M23 11v6M23 14l4-3M23 14l4 3" stroke-width="1.3" />
        <path d="M30 18l5 5-5 5-5-5z" />
      </g>
      <circle cx="50" cy="33" r="9" fill="#fbf6ea" />
      <circle cx="50" cy="33" r="9" stroke-dasharray="4 3.3" />
      <circle cx="50" cy="33" r="4.6" />
    </svg>
  ),
  bigtwo: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <rect x="17" y="9" width="20" height="30" rx="4" fill="#fbf6ea" transform="rotate(-18 27 45)" />
      <rect x="27" y="9" width="20" height="30" rx="4" fill="#fbf6ea" transform="rotate(18 37 45)" />
      <rect x="22" y="6" width="20" height="32" rx="4" fill="#fbf6ea" />
      <path d="M27.5 15c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4c0 2.2-1.8 3.6-4.5 6L27.5 24h9" />
      <path d="M32 27l3 3.5-3 3.5-3-3.5z" />
    </svg>
  ),
  gomoku: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <path d="M10 6v36M22 6v36M34 6v36M46 6v36M6 12h44M6 24h44M6 36h44" opacity=".4" strokeWidth="1.2" />
      <circle cx="22" cy="12" r="5" fill="#a9552f" />
      <circle cx="34" cy="24" r="5" fill="#a9552f" />
      <circle cx="46" cy="36" r="5" fill="#a9552f" />
      <circle cx="34" cy="12" r="5" fill="#fbf6ea" />
      <circle cx="22" cy="24" r="5" fill="#fbf6ea" />
      <circle cx="22" cy="36" r="5" fill="#fbf6ea" />
    </svg>
  ),
  crazyeights: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <g transform="rotate(-14 24 44)">
        <rect x="12" y="7" width="22" height="32" rx="4" fill="#fbf6ea" />
        <path d="M23 18l5 6-5 6-5-6z" />
      </g>
      <g transform="rotate(8 40 44)">
        <rect x="29" y="5" width="22" height="34" rx="4" fill="#fbf6ea" />
        <circle cx="40" cy="17" r="4" />
        <circle cx="40" cy="28" r="5" />
        <path d="M34 11h0M46 33h0" strokeWidth="2.4" />
      </g>
    </svg>
  ),
  yahtzee: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <g transform="rotate(-10 22 26)">
        <rect x="8" y="12" width="24" height="24" rx="5" fill="#fbf6ea" />
        <circle cx="15" cy="19" r="2.2" fill="#a9552f" />
        <circle cx="20" cy="24" r="2.2" fill="#a9552f" />
        <circle cx="25" cy="29" r="2.2" fill="#a9552f" />
      </g>
      <g transform="rotate(12 44 24)">
        <rect x="32" y="8" width="24" height="24" rx="5" fill="#fbf6ea" />
        <circle cx="39" cy="15" r="2.2" fill="#a9552f" />
        <circle cx="49" cy="15" r="2.2" fill="#a9552f" />
        <circle cx="44" cy="20" r="2.2" fill="#a9552f" />
        <circle cx="39" cy="25" r="2.2" fill="#a9552f" />
        <circle cx="49" cy="25" r="2.2" fill="#a9552f" />
      </g>
    </svg>
  ),
  liarsdice: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <path d="M14 40V26a14 14 0 0 1 28 0v14z" fill="#fbf6ea" />
      <path d="M10 40h36" strokeWidth="2.2" />
      <circle cx="28" cy="10" r="2.6" fill="#a9552f" />
      <rect x="40" y="22" width="18" height="18" rx="4" fill="#fbf6ea" transform="rotate(10 49 31)" />
      <g transform="rotate(10 49 31)">
        <circle cx="44" cy="27" r="1.8" fill="#a9552f" />
        <circle cx="49" cy="31" r="1.8" fill="#a9552f" />
        <circle cx="54" cy="35" r="1.8" fill="#a9552f" />
      </g>
    </svg>
  ),
  chess: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <path d="M18 41c0-7 4-11 9-14-4 0-8-1-11-4-1-2 0-3 2-5l5-8 1-5 4 3c2-1 5-1.500 8-.500 7 3 11 11 11 34z" fill="#fbf6ea" />
      <circle cx="29" cy="14" r="1.500" fill="#a9552f" />
      <path d="M33 12c4 1 8 6 9 14M17 20l3 1" strokeWidth="1.2" />
      <path d="M15 43h34" strokeWidth="2.2" />
    </svg>
  ),
  xiangqi: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <circle cx="32" cy="24" r="18" fill="#fbf6ea" />
      <circle cx="32" cy="24" r="14.500" />
      <text
        x="32"
        y="31.500"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fontFamily="'LXGW WenKai TC','Songti TC','Noto Serif TC',serif"
        fill="#a9552f"
        stroke="none"
      >
        帥
      </text>
    </svg>
  ),
  doudizhu: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <g transform="rotate(-12 18 44)">
        <rect x="7" y="8" width="20" height="30" rx="4" fill="#fbf6ea" />
        <path d="M14 20l3-4 3 4 3-4v8H14z" />
      </g>
      <g transform="rotate(0 32 44)">
        <rect x="22" y="5" width="20" height="32" rx="4" fill="#fbf6ea" />
        <path d="M27 17l5-6 5 6M32 11v10" strokeWidth="1.4" />
        <circle cx="32" cy="27" r="3.4" />
      </g>
      <g transform="rotate(12 46 44)">
        <rect x="37" y="8" width="20" height="30" rx="4" fill="#fbf6ea" />
        <path d="M47 14v14M42 19h10" />
      </g>
    </svg>
  ),
  bridge: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <rect x="22" y="3" width="20" height="14" rx="3" fill="#fbf6ea" />
      <rect x="22" y="31" width="20" height="14" rx="3" fill="#fbf6ea" />
      <rect x="3" y="14" width="14" height="20" rx="3" fill="#fbf6ea" />
      <rect x="47" y="14" width="14" height="20" rx="3" fill="#fbf6ea" />
      <path
        transform="translate(18.4 5) scale(.8)"
        d="M17 17.5c-3.400 3.200-5.600 4.500-5.600 7a2.600 2.600 0 0 0 4.500 1.600L15.200 30h3.600l-.7-3.900a2.600 2.600 0 0 0 4.500-1.600c0-2.500-2.200-3.800-5.600-7z"
        fill="#a9552f"
      />
    </svg>
  ),
  hearts: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <rect x="14" y="3" width="36" height="42" rx="5" fill="#fbf6ea" />
      <path
        d="M32 36C20 28 18 22 18 18.500c0-3.300 2.600-5.500 5.500-5.500 3.200 0 6 1.800 8.500 5.200C34.500 14.800 37.300 13 40.500 13c2.900 0 5.500 2.200 5.500 5.500 0 3.500-2 9.500-14 17.500z"
        fill="#a9552f"
      />
    </svg>
  ),
  spades: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <rect x="14" y="3" width="36" height="42" rx="5" fill="#fbf6ea" />
      <path
        d="M32 11C21 20 18 24 18 28.500c0 3.200 2.500 5.500 5.600 5.500 2.200 0 3.800-.9 5-2.600L27.600 38h8.800l-1-6.600c1.200 1.700 2.800 2.600 5 2.600 3.100 0 5.600-2.300 5.600-5.500C46 24 43 20 32 11z"
        fill="#a9552f"
      />
    </svg>
  ),
  go: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <path d="M12 6v36M28 6v36M44 6v36M6 12h46M6 24h46M6 36h46" opacity=".4" strokeWidth="1.200" />
      <circle cx="28" cy="24" r="7.500" fill="#3a3025" />
      <circle cx="44" cy="24" r="7.500" fill="#fbf6ea" />
      <circle cx="28" cy="36" r="7.500" fill="#fbf6ea" />
      <circle cx="44" cy="12" r="7.500" fill="#3a3025" />
    </svg>
  ),
  checkers: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <circle cx="21" cy="26" r="14" fill="#a9552f" />
      <circle cx="21" cy="26" r="9" stroke="#fbf6ea" />
      <circle cx="43" cy="22" r="14" fill="#fbf6ea" />
      <circle cx="43" cy="22" r="9" />
      <path d="M38 24l1.500-5 3.500 3 3.500-3 1.500 5z" strokeWidth="1.300" />
    </svg>
  ),
  reversi: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <rect x="6" y="4" width="52" height="40" rx="6" fill="#fbf6ea" />
      <circle cx="22" cy="24" r="11" fill="#3a3025" />
      <circle cx="42" cy="24" r="11" fill="#fbf6ea" />
      <path d="M30 11c4 2 4 24 0 26" strokeWidth="1.300" opacity=".6" />
    </svg>
  ),
  chinesecheckers: (
    <svg viewBox="0 0 64 48" aria-hidden>
      <path d="M32 3L58 36H6zM32 45L6 12h52z" fill="#fbf6ea" />
      <circle cx="32" cy="12" r="2.200" fill="#a9552f" />
      <circle cx="28" cy="18" r="2.200" fill="#a9552f" />
      <circle cx="36" cy="18" r="2.200" fill="#a9552f" />
      <circle cx="32" cy="36" r="2.200" fill="#3a3025" />
      <circle cx="28" cy="30" r="2.200" fill="#3a3025" />
      <circle cx="36" cy="30" r="2.200" fill="#3a3025" />
      <circle cx="32" cy="24" r="2.200" />
    </svg>
  ),
}
