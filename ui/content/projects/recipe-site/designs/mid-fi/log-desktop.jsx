// mid-fi/log-desktop.jsx — Cook Log desktop layouts (2 directions) + the
// three "neglected" visualization variations.

// Shared filter hook.
function useCookLog() {
  const t = useHH();
  const members = getMembers(t.householdSize);
  const [who, setWho] = React.useState('all');
  const log = who === 'all' ? CL_LOG : CL_LOG.filter(e => e.by === who);
  const byId = Object.fromEntries(members.map(m => [m.id, m]));
  return { members, byId, who, setWho, log, stats: clStats(log) };
}

function clInsight(stats) {
  const rows = Object.entries(stats.cuisine).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return 'No cooks logged in this window yet.';
  const [topC, topN] = rows[0];
  const pct = Math.round(topN / stats.totalCooks * 100);
  const rested = rows[rows.length - 1][0];
  return { topC, pct, rested };
}

// Header shared by both directions.
function CLHeader({ stats }) {
  return (
    <div style={{ padding: '30px 48px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>COOK LOG · VARIETY · ROTATION</div>
        <h1 className="mf-display" style={{ fontSize: 54, margin: '4px 0 0', lineHeight: 0.92 }}>your kitchen, <span style={{ color: 'var(--terracotta)' }}>last 10 weeks.</span></h1>
      </div>
      <div style={{ textAlign: 'right' }}>
        <button className="mf-btn primary" title="Manually log a meal you cooked — for catch-up entries">＋ log a cook</button>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 6 }}>finishing cooking mode logs automatically</div>
      </div>
    </div>
  );
}

// Variety hero — the primary job. Donut + legend + tiles + warm insight.
function CLVarietyHero({ stats }) {
  const ins = clInsight(stats);
  const segs = Object.entries(stats.cuisine).map(([c, n]) => ({ label: c, value: n, color: CL_CUISINE[c] || 'var(--ink-3)' }));
  return (
    <div className="mf-card" style={{ padding: 20, cursor: 'default' }}>
      <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>VARIETY & BALANCE</div>
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 22, marginTop: 14, alignItems: 'center' }}>
        <CLDonut segs={segs} size={150} thickness={24}
          center={<React.Fragment>
            <div className="mf-display" style={{ fontSize: 40, lineHeight: 0.85 }}>{stats.distinct}</div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>recipes</div>
          </React.Fragment>} />
        <CLCuisineLegend cuisine={stats.cuisine} total={stats.totalCooks} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
        <CLStat n={stats.totalCooks} label="meals cooked" sub="across the window" />
        <CLStat n={stats.distinct} label="different dishes" sub="more = more variety" tone="#5E7A3F" />
        <CLStat n={stats.newPct + '%'} label="something new" sub="weren't a repeat" tone="#5E7A3F" />
      </div>
      {ins.topC && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(143,166,119,0.10)', border: '1px solid var(--line)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-2)' }}>
          <span style={{ fontSize: 16, lineHeight: 1.2 }}>🌿</span>
          <span><b>{ins.pct}% of your meals were {ins.topC}.</b> You've barely touched <b>{ins.rested}</b> lately — a {ins.rested.toLowerCase()} night this week would even things out.</span>
        </div>
      )}
    </div>
  );
}

// "In heavy rotation" — popular, sorted by count.
function CLRotation({ stats, limit = 4 }) {
  const rows = [...stats.roll].sort((a, b) => b.count - a.count).slice(0, limit);
  return (
    <div className="mf-card" style={{ padding: 16, cursor: 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>IN HEAVY ROTATION</span>
        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>most-cooked</span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map(({ r, count, last }) => {
          const f = clFresh(last);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CLChip r={r} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Kalam', fontSize: 14, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div className="mf-mono" style={{ color: f.tone, fontSize: 9, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: f.dot }}></span>
                  last cooked {clAgo(last)}{f.rest ? ' · maybe rest it' : ''}
                </div>
              </div>
              <span className="mf-display" style={{ fontSize: 26, color: 'var(--terracotta)', lineHeight: 1 }}>×{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Period options shared by desktop + mobile matrix.
const CL_PERIODS = [{ k: 6, label: '6 wks' }, { k: 10, label: '10 wks' }, { k: 16, label: '16 wks' }];
const CL_SORTS = [{ k: 'recency', label: 'least recent' }, { k: 'most', label: 'most made' }, { k: 'least', label: 'least made' }];

function clSortRoll(roll, sort) {
  const r = [...roll];
  if (sort === 'most')  return r.sort((a, b) => b.count - a.count || a.last - b.last);
  if (sort === 'least') return r.sort((a, b) => a.count - b.count || b.last - a.last);
  return r.sort((a, b) => b.last - a.last); // recency: longest unmade first
}

// Tiny segmented control matching the mf-tag vocabulary.
function CLSeg({ options, value, onChange, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {label && <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>{label}</span>}
      <div style={{ display: 'inline-flex', background: 'var(--paper-warm)', borderRadius: 7, padding: 2, gap: 2, boxShadow: 'inset 0 0 0 1px var(--line)' }}>
        {options.map(o => (
          <span key={o.k} onClick={() => onChange(o.k)} className="mf-mono"
            style={{ fontSize: 10, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
              background: value === o.k ? 'var(--card)' : 'transparent',
              color: value === o.k ? 'var(--terracotta)' : 'var(--ink-3)',
              boxShadow: value === o.k ? '0 1px 2px rgba(31,26,20,0.12)' : 'none', fontWeight: value === o.k ? 700 : 400 }}>
            {o.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Recency matrix — recipes as rows, a timeline with a dot on weeks each was
// cooked. Long empty tails = neglected. Rankable (least-recent / most / least
// made) and the time window is configurable.
function CLRecencyMatrix({ log }) {
  const [weeks, setWeeks] = React.useState(10);
  const [sort, setSort] = React.useState('recency');
  const roll = clSortRoll(clRollup(log), sort);
  const cookedWeeks = {};
  log.forEach(e => {
    const wk = weeks - 1 - Math.floor(e.d / 7);
    if (wk >= 0 && wk < weeks) (cookedWeeks[e.rid] = cookedWeeks[e.rid] || new Set()).add(wk);
  });
  return (
    <div className="mf-card" style={{ padding: 16, cursor: 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>WHEN DID I LAST MAKE…?</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <CLSeg options={CL_SORTS} value={sort} onChange={setSort} />
          <CLSeg options={CL_PERIODS} value={weeks} onChange={setWeeks} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {roll.map(({ r, last, count }) => {
          const f = clFresh(last);
          const cw = cookedWeeks[r.id] || new Set();
          const inWindow = last < weeks * 7;
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '154px 1fr 70px', gap: 10, alignItems: 'center', opacity: inWindow ? 1 : 0.62 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <CLChip r={r} size={24} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 8.5 }}>×{count} · {r.cuisine.toLowerCase()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: weeks }).map((_, w) => (
                  <span key={w} title={cw.has(w) ? 'cooked this week' : ''} style={{ flex: 1, height: 15, borderRadius: 3, background: cw.has(w) ? 'var(--terracotta)' : 'var(--paper-warm)', boxShadow: 'inset 0 0 0 1px rgba(31,26,20,0.07)' }}></span>
                ))}
              </div>
              <span className="mf-mono" style={{ color: f.tone, fontSize: 10, textAlign: 'right' }}>{clAgo(last)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--terracotta)' }}></span> cooked that week</span>
        <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>← {weeks} wks ago · this week →</span>
        <span className="mf-mono" style={{ color: '#5E7A3F', fontSize: 9, marginLeft: 'auto' }}>long empty tail = due a revisit</span>
      </div>
    </div>
  );
}

// Compact recent cooks + the "last cooked X ago" freshness signal — the
// actionable "too soon?" read, without the noise of a full diary.
function CLRecentCooks({ log, byId, limit = 5 }) {
  const recent = [...log].sort((a, b) => a.d - b.d).slice(0, limit);
  return (
    <div className="mf-card" style={{ padding: 16, cursor: 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>RECENTLY COOKED</span>
        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>rest before repeating</span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {recent.map((e, i) => {
          const r = clById[e.rid]; const m = byId[e.by]; const f = clFresh(e.d);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CLChip r={r} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Kalam', fontSize: 13.5, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  {m && <MemberDot m={m} size={14} ring />}
                  <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{m ? m.name : '—'} · serves {e.s}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mf-mono" style={{ color: f.tone, fontSize: 10 }}>{clAgo(e.d)}</div>
                {f.rest && <span className="mf-mono" style={{ color: 'var(--terracotta-deep)', fontSize: 8.5 }}>still resting</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DASHBOARD (variety-led) ────────────────────────────────────
function MidCookLogDashboard() {
  const { members, byId, who, setWho, log, stats } = useCookLog();
  return (
    <div className="mf mf-page">
      <LogNav active="log" />
      <CLHeader stats={stats} />
      <div style={{ padding: '14px 48px 0' }}><CLMemberFilter members={members} value={who} onChange={setWho} /></div>
      <div style={{ padding: '18px 48px 40px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <CLVarietyHero stats={stats} />
          <CLRecencyMatrix log={log} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <CLRotation stats={stats} />
          <CLRecentCooks log={log} byId={byId} />
        </div>
      </div>
    </div>
  );
}

// ── DIRECTION B — diary / feed-led ─────────────────────────────
function MidCookLogDiary() {
  const { members, byId, who, setWho, log, stats } = useCookLog();
  // Group by week bucket.
  const groups = {};
  [...log].sort((a, b) => a.d - b.d).forEach(e => {
    const w = Math.floor(e.d / 7);
    (groups[w] = groups[w] || []).push(e);
  });
  const weekLabel = (w) => w === 0 ? 'this week' : w === 1 ? 'last week' : w + ' weeks ago';
  const ins = clInsight(stats);
  return (
    <div className="mf mf-page">
      <LogNav active="log" />
      <CLHeader stats={stats} />
      <div style={{ padding: '14px 48px 0' }}><CLMemberFilter members={members} value={who} onChange={setWho} /></div>
      <div style={{ padding: '18px 48px 40px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 26, alignItems: 'start' }}>
        {/* diary spine */}
        <div className="mf-card" style={{ padding: '18px 22px', cursor: 'default' }}>
          <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>THE DIARY · WHAT YOU COOKED, WHEN</span>
          <div style={{ marginTop: 14 }}>
            {Object.keys(groups).map(w => w | 0).sort((a, b) => a - b).map(w => (
              <div key={w} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 16, paddingBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  <div className="mf-display" style={{ fontSize: 22, color: 'var(--ink-2)', lineHeight: 1 }}>{weekLabel(w)}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, marginTop: 2 }}>{groups[w].length} cooked</div>
                </div>
                <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {groups[w].map((e, i) => {
                    const r = clById[e.rid]; const m = byId[e.by]; const f = clFresh(e.d);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: -23, top: 12, width: 9, height: 9, borderRadius: 9, background: f.dot, border: '2px solid var(--paper)' }}></span>
                        <CLChip r={r} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'Kalam', fontSize: 15, lineHeight: 1.1 }}>{r.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                            {m && <MemberDot m={m} size={15} ring />}
                            <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{m ? m.name : '—'} · {r.cuisine.toLowerCase()} · serves {e.s}</span>
                          </div>
                        </div>
                        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 10 }}>{clAgo(e.d)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* insights rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="mf-card" style={{ padding: 16, cursor: 'default' }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>BALANCE</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <CLDonut segs={Object.entries(stats.cuisine).map(([c, n]) => ({ value: n, color: CL_CUISINE[c] }))} size={96} thickness={16}
                center={<div className="mf-display" style={{ fontSize: 26, lineHeight: 0.9 }}>{stats.distinct}</div>} />
              <div style={{ flex: 1 }}><CLCuisineLegend cuisine={stats.cuisine} total={stats.totalCooks} /></div>
            </div>
            {ins.topC && <div style={{ marginTop: 12, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic' }}>mostly {ins.topC.toLowerCase()} — rest it, try {ins.rested.toLowerCase()}?</div>}
          </div>
          <CLRotation stats={stats} limit={3} />
          <CLNeglectedList stats={stats} limit={3} />
        </div>
      </div>
    </div>
  );
}

// ── NEGLECTED VIZ · variation 1 — ranked list ──────────────────
function CLNeglectedList({ stats, limit = 4, framed }) {
  const rows = [...stats.roll].sort((a, b) => b.last - a.last).slice(0, limit);
  const body = (
    <React.Fragment>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>GATHERING DUST</span>
        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>longest unmade</span>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map(({ r, last, count }) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CLChip r={r} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Kalam', fontSize: 14, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 1 }}>cooked {count}× · {r.cuisine.toLowerCase()}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mf-display" style={{ fontSize: 20, color: 'var(--ink-2)', lineHeight: 1 }}>{clAgo(last)}</div>
              <span className="mf-mono" style={{ color: '#5E7A3F', fontSize: 9, cursor: 'pointer' }}>＋ plan it ↗</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>good candidates for next week's plan.</div>
    </React.Fragment>
  );
  return framed ? <div className="mf-card" style={{ padding: 16, cursor: 'default' }}>{body}</div> : <div className="mf-card" style={{ padding: 16, cursor: 'default' }}>{body}</div>;
}

// ── NEGLECTED VIZ · variation 2 — recency matrix ───────────────
// Recipes as rows; a 10-week timeline with a dot on weeks it was cooked.
// Neglected recipes read instantly as long empty tails on the right.
function CLNeglectedMatrix() {
  const roll = [...clRollup(CL_LOG)].sort((a, b) => b.last - a.last);
  const weeks = 10;
  // which weeks (0=oldest .. 9=newest) each recipe was cooked
  const cookedWeeks = {};
  CL_LOG.forEach(e => {
    const wk = weeks - 1 - Math.floor(e.d / 7);
    if (wk >= 0 && wk < weeks) (cookedWeeks[e.rid] = cookedWeeks[e.rid] || new Set()).add(wk);
  });
  return (
    <div className="mf mf-page" style={{ height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: 22, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>NEGLECTED · RECENCY MATRIX</span>
        <h2 className="mf-display" style={{ fontSize: 30, margin: '4px 0 2px' }}>when did I last make…?</h2>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginBottom: 14 }}>each dot = a week you cooked it · empty tail = gathering dust →</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {roll.map(({ r, last }) => {
            const f = clFresh(last);
            const cw = cookedWeeks[r.id] || new Set();
            return (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 64px', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <CLChip r={r} size={22} />
                  <span style={{ fontFamily: 'Kalam', fontSize: 12.5, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: weeks }).map((_, w) => (
                    <span key={w} style={{ flex: 1, height: 14, borderRadius: 3, background: cw.has(w) ? 'var(--terracotta)' : 'var(--paper-warm)', boxShadow: 'inset 0 0 0 1px rgba(31,26,20,0.07)' }}></span>
                  ))}
                </div>
                <span className="mf-mono" style={{ color: f.tone, fontSize: 10, textAlign: 'right' }}>{clAgo(last)}</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--terracotta)' }}></span> cooked that week</span>
          <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>← 10 weeks ago · this week →</span>
        </div>
      </div>
    </div>
  );
}

// ── NEGLECTED VIZ · variation 3 — dusty shelf ──────────────────
// Recipes as jars on a shelf; the longer since cooked, the dustier/greyer.
function CLNeglectedShelf() {
  const roll = [...clRollup(CL_LOG)].sort((a, b) => b.last - a.last);
  const dust = (d) => Math.min(0.62, d / 70 * 0.62); // 0..0.62 grayscale-ish veil
  return (
    <div className="mf mf-page" style={{ height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: 22, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>NEGLECTED · THE DUSTY SHELF</span>
        <h2 className="mf-display" style={{ fontSize: 30, margin: '4px 0 2px' }}>blow the dust off.</h2>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginBottom: 16 }}>the longer since you cooked it, the dustier the jar</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {roll.slice(0, 9).map(({ r, last, count }) => {
            const veil = dust(last); const f = clFresh(last);
            return (
              <div key={r.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1.25px solid var(--line-strong)', cursor: 'pointer' }}>
                <div style={{ height: 86, background: `linear-gradient(135deg, ${r.palette[0]}, ${r.palette[1]})`, position: 'relative' }}>
                  <FoodGlyph kind={r.glyph} size={56} />
                  {/* dust veil */}
                  <div style={{ position: 'absolute', inset: 0, background: '#D8CDB6', opacity: veil, mixBlendMode: 'screen' }}></div>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(120,110,92,0.5)', opacity: veil * 0.7 }}></div>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--card)' }}>
                  <div style={{ fontFamily: 'Kalam', fontSize: 12.5, lineHeight: 1.05, height: 28, overflow: 'hidden' }}>{r.title}</div>
                  <div className="mf-mono" style={{ color: f.tone, fontSize: 9, marginTop: 3 }}>{clAgo(last)} · ×{count}</div>
                </div>
                {veil > 0.4 && <span className="mf-mono" style={{ position: 'absolute', top: 6, right: 6, fontSize: 8, color: 'var(--ink)', background: 'rgba(250,243,226,0.85)', padding: '1px 5px', borderRadius: 999 }}>dusty</span>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 14, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic' }}>tap a dusty jar to drop it straight into next week's plan.</div>
      </div>
    </div>
  );
}

window.useCookLog = useCookLog;
window.CLSeg = CLSeg;
window.CL_PERIODS = CL_PERIODS;
window.CL_SORTS = CL_SORTS;
window.clSortRoll = clSortRoll;
window.MidCookLogDashboard = MidCookLogDashboard;
window.CLRecencyMatrix = CLRecencyMatrix;
window.CLRecentCooks = CLRecentCooks;
window.CLVarietyHero = CLVarietyHero;
window.CLRotation = CLRotation;
window.CLHeader = CLHeader;
