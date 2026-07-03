// mid-fi/log-mobile.jsx — mobile Cook Log + the section read-me.

function MobileLogTabBar() {
  const tabs = [['recipes', '🍝', 'Recipes'], ['cookbooks', '📚', 'Books'], ['log', '📊', 'Log'], ['kitchen', '🧂', 'Kitchen']];
  return (
    <div style={{ padding: '8px 10px 14px', borderTop: '1px solid var(--line)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      {tabs.slice(0, 2).map(([k, e, l]) => <LogTab key={k} e={e} l={l} active={k === 'log'} />)}
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--ink)', color: 'var(--butter)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginTop: -18, boxShadow: 'var(--shadow)', flexShrink: 0 }} title="add / scan — the old Scan tab, now an action">＋</div>
      {tabs.slice(2).map(([k, e, l]) => <LogTab key={k} e={e} l={l} active={k === 'log'} />)}
    </div>
  );
}
function LogTab({ e, l, active }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontFamily: 'Kalam', fontSize: 10, color: active ? 'var(--terracotta)' : 'var(--ink-3)', fontWeight: active ? 700 : 400, flex: 1 }}>
      <span style={{ fontSize: 16, filter: active ? 'none' : 'grayscale(0.6)' }}>{e}</span>
      <span>{l}</span>
    </div>
  );
}

function MobileCookLog() {
  const t = useHH();
  const members = getMembers(t.householdSize);
  const byId = Object.fromEntries(members.map(m => [m.id, m]));
  const [who, setWho] = React.useState('all');
  const [tab, setTab] = React.useState('balance');
  const [sort, setSort] = React.useState('recency');
  const [weeks, setWeeks] = React.useState(10);
  const log = who === 'all' ? CL_LOG : CL_LOG.filter(e => e.by === who);
  const stats = clStats(log);
  const ins = (() => { const r = Object.entries(stats.cuisine).sort((a, b) => b[1] - a[1]); return r.length ? { topC: r[0][0], pct: Math.round(r[0][1] / stats.totalCooks * 100), rested: r[r.length - 1][0] } : null; })();

  const TABS = [['balance', 'Balance'], ['matrix', 'Last made'], ['popular', 'Popular']];

  return (
    <Phone>
      {/* header */}
      <div style={{ padding: '6px 18px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>COOK LOG · LAST 10 WEEKS</div>
          <MobileAvatar size={26} />
        </div>
        <div className="mf-display" style={{ fontSize: 27, lineHeight: 0.95, marginTop: 2 }}>your kitchen.</div>
        {/* member filter */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 8, paddingBottom: 2, margin: '0 -2px' }}>
          <span onClick={() => setWho('all')} className={'mf-tag ' + (who === 'all' ? 'include' : '')} style={{ fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>everyone</span>
          {members.map(m => (
            <span key={m.id} onClick={() => setWho(m.id)} className={'mf-tag ' + (who === m.id ? 'include' : '')} style={{ fontSize: 12, cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
              <MemberDot m={m} size={15} ring />{m.name}
            </span>
          ))}
        </div>
      </div>

      {/* segmented tabs */}
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', background: 'var(--paper-warm)', borderRadius: 9, padding: 3, gap: 3, boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          {TABS.map(([k, l]) => (
            <span key={k} onClick={() => setTab(k)} className="mf-mono"
              style={{ flex: 1, textAlign: 'center', fontSize: 11, padding: '8px 0', borderRadius: 6, cursor: 'pointer',
                background: tab === k ? 'var(--card)' : 'transparent', color: tab === k ? 'var(--terracotta)' : 'var(--ink-3)',
                fontWeight: tab === k ? 700 : 400, boxShadow: tab === k ? '0 1px 2px rgba(31,26,20,0.12)' : 'none' }}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'balance' && (
          <React.Fragment>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <CLDonut segs={Object.entries(stats.cuisine).map(([c, n]) => ({ value: n, color: CL_CUISINE[c] }))} size={132} thickness={20}
                center={<React.Fragment><div className="mf-display" style={{ fontSize: 38, lineHeight: 0.82 }}>{stats.distinct}</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>different dishes</div></React.Fragment>} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <CLStat n={stats.totalCooks} label="meals cooked" sub="across the window" />
              <CLStat n={stats.newPct + '%'} label="something new" sub="weren't a repeat" tone="#5E7A3F" />
            </div>
            <div className="mf-card" style={{ padding: 14, cursor: 'default' }}>
              <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>CUISINE MIX</span>
              <div style={{ marginTop: 10 }}><CLCuisineLegend cuisine={stats.cuisine} total={stats.totalCooks} /></div>
            </div>
            {ins && <div style={{ padding: '12px 14px', background: 'rgba(143,166,119,0.12)', borderRadius: 9, fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.4 }}>🌿 <b>{ins.pct}% of your meals were {ins.topC}.</b> A {ins.rested.toLowerCase()} night this week would even things out.</div>}
          </React.Fragment>
        )}

        {tab === 'matrix' && (
          <React.Fragment>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <CLSeg options={CL_SORTS} value={sort} onChange={setSort} label="sort" />
              <CLSeg options={CL_PERIODS} value={weeks} onChange={setWeeks} label="window" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {clSortRoll(stats.roll, sort).map(({ r, last, count }) => {
                const f = clFresh(last);
                const cw = new Set(log.filter(e => e.rid === r.id).map(e => weeks - 1 - Math.floor(e.d / 7)).filter(w => w >= 0 && w < weeks));
                const inWindow = last < weeks * 7;
                return (
                  <div key={r.id} style={{ opacity: inWindow ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
                      <CLChip r={r} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Kalam', fontSize: 14, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                        <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 8.5 }}>×{count} · {r.cuisine.toLowerCase()}</div>
                      </div>
                      <span className="mf-mono" style={{ color: f.tone, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 6, background: f.dot }}></span>{clAgo(last)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3, paddingLeft: 37 }}>
                      {Array.from({ length: weeks }).map((_, w) => (
                        <span key={w} style={{ flex: 1, height: 13, borderRadius: 3, background: cw.has(w) ? 'var(--terracotta)' : 'var(--paper-warm)', boxShadow: 'inset 0 0 0 1px rgba(31,26,20,0.07)' }}></span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 8.5, textAlign: 'center', marginTop: 2 }}>← {weeks} wks ago · this week → · long empty tail = due a revisit</div>
          </React.Fragment>
        )}

        {tab === 'popular' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[...stats.roll].sort((a, b) => b.count - a.count).map(({ r, count, last }) => {
              const f = clFresh(last);
              return (
                <div key={r.id} className="mf-card" style={{ padding: '11px 13px', cursor: 'default', display: 'flex', alignItems: 'center', gap: 11 }}>
                  <CLChip r={r} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Kalam', fontSize: 15, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    <div className="mf-mono" style={{ color: f.tone, fontSize: 9.5, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 6, background: f.dot }}></span>last cooked {clAgo(last)}{f.rest ? ' · maybe rest it' : ''}</div>
                  </div>
                  <span className="mf-display" style={{ fontSize: 28, color: 'var(--terracotta)', lineHeight: 1 }}>×{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MobileLogTabBar />
    </Phone>
  );
}

// ── Read-me artboard ───────────────────────────────────────────
function CookLogReadme() {
  return (
    <div style={{ padding: 28, height: '100%', background: '#FAF3E2', fontFamily: 'Kalam', boxSizing: 'border-box', overflow: 'auto' }}>
      <div style={{ fontFamily: 'Caveat', fontSize: 44, lineHeight: 1, color: '#1F1A14' }}>cook log & insights.</div>
      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: '#4D4337' }}>
        Fills the gap in the brief: <i>"track what I've cooked and when, so I can spot popular vs neglected recipes and avoid repeating meals too soon."</i> The existing app shows <b>aggregate / social</b> signals (how many strangers cooked a recipe); this is the <b>personal, first-party</b> mirror — your own household's cooking, over time.
      </div>
      <hr className="mf-rule" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div>
          <div className="mf-mono" style={{ color: '#A04F26' }}>WHAT IT ANSWERS</div>
          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 13, lineHeight: 1.5, color: '#4D4337' }}>
            <li><b>Balance</b> — cuisine mix + how much was <i>something new</i> (the hero)</li>
            <li><b>What & when</b> — a recency matrix: when you last made each dish</li>
            <li><b>Popular</b> — what's in heavy rotation</li>
            <li><b>Neglected</b> — long empty tails in the matrix = due a revisit</li>
            <li><b>Too soon?</b> — a "last cooked X ago" freshness signal on every recipe</li>
          </ul>
        </div>
        <div>
          <div className="mf-mono" style={{ color: '#A04F26' }}>HOW IT'S FED</div>
          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 13, lineHeight: 1.5, color: '#4D4337' }}>
            <li><b>Auto</b> — finishing cooking mode logs the cook</li>
            <li><b>Manual</b> — "＋ log a cook" for catch-up entries</li>
            <li><b>Household-aware</b> — every cook is attributed; filter by member</li>
          </ul>
          <div className="mf-mono" style={{ color: '#A04F26', marginTop: 12 }}>TONE</div>
          <div style={{ fontSize: 13, color: '#4D4337', lineHeight: 1.5, marginTop: 4 }}>warm framing over honest data — counts & dates are real, the nudges are gentle ("maybe rest the chorizo bake?").</div>
        </div>
      </div>
      <hr className="mf-rule" />
      <div className="mf-mono" style={{ color: '#A04F26' }}>YOUR NAV QUESTION — "won't the nav get too busy?"</div>
      <div style={{ fontSize: 13.5, color: '#4D4337', lineHeight: 1.5, marginTop: 6 }}>
        Good instinct. The fix isn't a longer nav — it's noticing that <b>Scan/Add is an action, not a place.</b> Destinations belong in the nav; actions belong on a button. So I demoted <b>Scan</b> from a tab to a <b>"＋ add"</b> button (top-right on desktop, the center <b>＋</b> on mobile) and gave its slot to <b>Log</b>. Net tabs: unchanged.
      </div>
      <div style={{ marginTop: 8, padding: '10px 12px', background: '#F4ECD6', borderRadius: 8, fontSize: 13, color: '#4D4337', lineHeight: 1.5 }}>
        <b>nav before:</b> Recipes · Cookbooks · Shopping · Kitchen · <span style={{ textDecoration: 'line-through', color: '#8B7C66' }}>Scan</span><br />
        <b>nav after:&nbsp;</b> Recipes · Cookbooks · Shopping · Kitchen · <b style={{ color: '#A04F26' }}>Log</b> &nbsp;<span style={{ color: '#8B7C66' }}>+ a ＋ add button</span>
      </div>
      <div style={{ fontSize: 12.5, color: '#4D4337', lineHeight: 1.5, marginTop: 8 }}>
        (Common alternatives if Log ever needs to coexist with Scan-as-tab: fold Log under <b>Kitchen</b> as a sub-tab, or tuck it in the <b>avatar menu</b> since it's personal. The action-button move is the cleanest here.)
      </div>
      <hr className="mf-rule" />
      <div className="mf-mono" style={{ color: '#A04F26' }}>WHAT CHANGED THIS ROUND</div>
      <div style={{ fontSize: 13, color: '#4D4337', lineHeight: 1.5, marginTop: 4 }}>
        The <b>recency matrix</b> is now <b>rankable</b> (least-recent / most-made / least-made) with a <b>configurable window</b> (6 / 10 / 16 weeks) — so it doubles as your popular-vs-neglected ranking and lives only on the Log page (dropped the redundant standalone view). <b>Mobile</b> was rebuilt around a <b>segmented control</b> — Balance · Last made · Popular — so each screen does one thing with room to breathe, instead of stacking every card into one cramped scroll.
      </div>
    </div>
  );
}

window.MobileCookLog = MobileCookLog;
window.CookLogReadme = CookLogReadme;
