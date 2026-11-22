import { useEffect, useState } from 'react'
import { api, ApiError } from './api'
import { useAccount } from './Account'
import { Bar } from '../hub/Hub'

type Tab = 'overview' | 'users' | 'matches' | 'ledger' | 'audit'
const ago = (ms: number) => (ms ? new Date(ms).toLocaleString() : '—')

function Table({ rows, cols }: { rows: any[]; cols: [string, (r: any) => any][] }) {
  return (
    <div className="adscroll"><table className="kgt">
      <thead><tr>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([h, f]) => <td key={h}>{f(r)}</td>)}</tr>)}</tbody>
    </table></div>
  )
}

const Shell = ({ children }: { children?: React.ReactNode }) => <div className="kg adpage"><div className="kg-wrap"><Bar /><div className="adwrap">{children}</div></div></div>

export default function Admin() {
  const { me, ready, available, openSignIn } = useAccount()
  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<any>(null)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [pick, setPick] = useState<string>('')
  const load = async (t: Tab = tab) => {
    setErr('')
    try {
      const path = t === 'users' ? `/admin/users?q=${encodeURIComponent(q)}` : t === 'ledger' ? `/admin/ledger${pick ? `?user=${pick}` : ''}` : `/admin/${t}`
      setData(await api(path))
    } catch (e) { setData(null); setErr(e instanceof ApiError ? e.code : 'offline') }
  }
  useEffect(() => { if (me?.admin) void load() }, [tab, me?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (path: string, body: object) => { try { await api('/admin/' + path, body); await load() } catch (e) { setErr(e instanceof ApiError ? e.code : 'offline') } }

  if (!available) return <Shell><h1>Admin</h1><p className="kg-note">Accounts are not configured on this site.</p></Shell>
  if (!ready) return null
  if (!me) return <Shell><h1>Admin</h1><div><button className="primary" onClick={openSignIn}>Sign in</button></div></Shell>
  if (!me.admin) return <Shell><h1>Admin</h1><p className="kg-note">This account is not an admin.</p></Shell>

  return (
    <Shell>
      <h1>Admin</h1>
      <nav className="adtabs">
        {(['overview', 'users', 'matches', 'ledger', 'audit'] as Tab[]).map((x) => <button key={x} className={tab === x ? 'on' : ''} onClick={() => { setPick(''); setTab(x) }}>{x}</button>)}
      </nav>
      {err && <p className="acerr" role="alert">{err}</p>}
      {tab === 'overview' && data && (
        <>
          <div className="adstats">{([['Users', data.users], ['New today', data.newToday], ['Active 24h', data.active24h], ['Active 7d', data.active7d], ['Matches', data.matches], ['Matches today', data.matchesToday], [`Ranked ${data.season}`, data.rankedThisSeason], ['Chips in play', data.chipsInCirculation?.toLocaleString()], ['Banned', data.banned]] as [string, any][]).map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>
          <h3>By game</h3><Table rows={data.byGame ?? []} cols={[['Game', (r) => r.game], ['Matches', (r) => r.matches], ['Last 24h', (r) => r.last24h], ['Signed-in players', (r) => r.players]]} />
          <h3>Matches per day</h3><Table rows={data.matchesPerDay} cols={[['Day', (r) => r.day], ['Matches', (r) => r.n]]} />
          <h3>Sign-ups per day</h3><Table rows={data.signupsPerDay} cols={[['Day', (r) => r.day], ['New users', (r) => r.n]]} />
        </>
      )}
      {tab === 'users' && (
        <>
          <form className="acform" onSubmit={(e) => { e.preventDefault(); void load() }}><input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /><button className="primary">Search</button></form>
          {data && <Table rows={data.users} cols={[
            ['Name', (r) => r.name], ['Email', (r) => r.email], ['Games', (r) => r.games], ['Chips', (r) => r.balance ?? '—'], ['Last seen', (r) => ago(r.last_seen)], ['Joined', (r) => ago(r.created_at)],
            ['Actions', (r) => (<span className="adcells">
              <button className="ghost" onClick={() => { setPick(r.id); setTab('ledger') }}>ledger</button>
              <button className="ghost" onClick={() => { const a = prompt(`Chips to add (negative removes) for ${r.name}`, '1000'); if (a) void act('grant', { user: r.id, amount: Number(a) }) }}>chips</button>
              <button className="ghost" onClick={() => { const n = prompt('New display name', r.name); if (n) void act('rename', { user: r.id, name: n }) }}>rename</button>
              <button className="ghost" onClick={() => { if (confirm(`${r.banned ? 'Unban' : 'Ban'} ${r.name}?`)) void act('ban', { user: r.id, banned: !r.banned }) }}>{r.banned ? 'unban' : 'ban'}</button></span>)],
          ]} />}
        </>
      )}
      {tab === 'matches' && data && <Table rows={data.matches} cols={[['When', (r) => ago(r.at)], ['Rule', (r) => r.rule], ['Mode', (r) => (r.ranked ? 'ranked' : 'casual')], ['Players (points)', (r) => r.players], ['', (r) => <a href={`#m=${r.id}`} onClick={async (e) => { e.preventDefault(); const d = await api(`/match/${r.id}`); alert(JSON.stringify({ players: d.players, rounds: d.summary?.length, replayStored: !!d.replay }, null, 1)) }}>details</a>]]} />}
      {tab === 'ledger' && data && <><p className="muted small">{pick ? `User ${pick}` : 'Latest 200 entries'}</p><Table rows={data.ledger} cols={[['When', (r) => ago(r.at)], ['User', (r) => r.user_id], ['Change', (r) => r.delta], ['Reason', (r) => r.reason], ['Ref', (r) => r.ref]]} /></>}
      {tab === 'audit' && data && (
        <>
          <p className={data.ok ? 'kg-up' : 'kg-down'}>{data.ok ? 'All checks passed' : 'Problems found'} — season {data.season}</p>
          <h3>Balances that differ from the ledger</h3><Table rows={data.balanceDrift} cols={[['User', (r) => r.user_id], ['Balance', (r) => r.balance], ['Ledger', (r) => r.ledger]]} />
          <h3>Negative balances</h3><Table rows={data.negativeBalances} cols={[['User', (r) => r.user_id], ['Balance', (r) => r.balance]]} />
          <h3>Games whose chips do not net to zero</h3><Table rows={data.unbalancedMatches} cols={[['Match', (r) => r.match_id], ['Net', (r) => r.net]]} />
          <button className="ghost" onClick={() => void act('trim', { user: me.id })}>Trim replay logs older than 90 days</button>
        </>
      )}
    </Shell>
  )
}
