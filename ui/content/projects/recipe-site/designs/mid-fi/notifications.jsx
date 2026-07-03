// mid-fi/notifications.jsx — the full notifications system.
// Three views beyond "redirect to source": (1) the full Notifications PAGE (the bell's
// "see all" archive — grouped, filterable, read/unread), (2) notification PREFERENCES
// (per-category channels + frequency, incl. a digest for noisy household activity), and
// (3) inline actions on the types that resolve without a redirect (follow back, save a
// rec, review a suggested edit, pull an upstream update). Everything else deep-links.
//
// Taxonomy is product-specific: Recommendations · Social · Household · Your recipes
// (forks / suggestions / upstream sync) · Milestones.

// ── category meta ───────────────────────────────────────────────────────────
const NCAT = {
  rec:       { label: 'Recommendations', icon: '✉', color: '#C8693C' },
  social:    { label: 'Social',          icon: '👥', color: '#99394A' },
  household: { label: 'Household',        icon: '🏠', color: '#8FA677' },
  recipes:   { label: 'Your recipes',    icon: '🌱', color: '#A04F26' },
  you:       { label: 'Milestones',      icon: '🎉', color: '#E2A040' },
};
const NPEOPLE = { Ellie: '#8FA677', Jamie: '#C8693C', Mac: '#99394A', Ash: '#506B3F', Priya: '#B5462E', Dana: '#E2A040', Marco: '#8FA677', Wing: '#506B3F', Sam: '#7E2D1F' };
const NHOUSEHOLD = ['Ellie', 'Jamie', 'Mac', 'Ash'];

function NAvatar({ who, size = 38 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: NPEOPLE[who] || '#8B7C66', color: '#FFF6E0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: size * 0.5, border: '1.5px solid var(--ink)', flexShrink: 0 }}>{who[0]}</span>);
}
function NSysIcon({ cat, size = 38 }) {
  const c = NCAT[cat];
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: c.color, color: '#FFF6E0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, border: '1.5px solid var(--ink)', flexShrink: 0 }}>{c.icon}</span>);
}

// bold helpers
const Nm = ({ children }) => <b style={{ color: 'var(--ink)' }}>{children}</b>;
const Tg = ({ children }) => <b style={{ color: 'var(--terracotta-deep)' }}>{children}</b>;

// ── the feed of notifications ───────────────────────────────────────────────
// who → person avatar · sys:true → category icon. `act` = inline actions (no redirect);
// when absent the row just deep-links via "view →".
const NOTIFS = [
  // ——— today ———
  { id: 1, cat: 'rec', who: 'Ellie', hh: true, bucket: 'today', when: '2h', unread: true,
    body: <><Nm>Ellie</Nm> recommended <Tg>Chicken Quesadillas</Tg> to you</>, quote: 'the kids actually ate this — zero complaints.',
    act: ['♡ Save', '📅 Plan'], to: 'Recipes › Recommended' },
  { id: 2, cat: 'social', who: 'Priya', bucket: 'today', when: '4h', unread: true,
    body: <><Nm>Priya</Nm> started following you</>, act: ['＋ Follow back'], to: 'Priya’s profile' },
  { id: 3, cat: 'recipes', who: 'Dana', bucket: 'today', when: '5h', unread: true,
    body: <><Nm>Dana</Nm> suggested an edit to your <Tg>Cajun Sausage Pasta</Tg></>, quote: 'half the salt in step 3 — it’s plenty.',
    act: ['Review change'], to: 'Suggestion review' },
  { id: 4, cat: 'household', who: 'Jamie', hh: true, bucket: 'today', when: '6h', unread: true,
    body: <><Nm>Jamie</Nm> added <Tg>Slow Cooker Mexican</Tg> to this week’s plan</>, to: 'Shared plan' },
  // ——— this week ———
  { id: 5, cat: 'recipes', sys: true, bucket: 'week', when: '1d', unread: false,
    body: <>The recipe you forked updated — <Nm>Mum</Nm> changed <Tg>Pasta Bake</Tg></>, quote: 'swapped passata for fresh tomato.',
    act: ['Pull update'], to: 'Upstream sync' },
  { id: 6, cat: 'social', who: 'Marco', bucket: 'week', when: '1d', unread: false,
    body: <><Nm>Marco</Nm> cheered your <Tg>50 meals cooked</Tg> badge</>, to: 'Your profile' },
  { id: 7, cat: 'rec', who: 'Wing', bucket: 'week', when: '2d', unread: false,
    body: <><Nm>Wing</Nm> recommended <Tg>Salt &amp; Chilli Chips</Tg> to you</>, act: ['♡ Save'], to: 'Recipes › Recommended' },
  { id: 8, cat: 'household', who: 'Mac', hh: true, bucket: 'week', when: '2d', unread: false,
    body: <><Nm>Mac</Nm> ticked 6 items off the shopping list</>, to: 'Shared shopping' },
  { id: 9, cat: 'recipes', who: 'Sam', bucket: 'week', when: '3d', unread: false,
    body: <><Nm>Sam</Nm> forked your <Tg>Creamy Chilli Tomato Pasta</Tg> → “Vegan Chilli Pasta”</>, to: 'The fork' },
  { id: 10, cat: 'social', who: 'Ash', hh: true, bucket: 'week', when: '3d', unread: false,
    body: <><Nm>Ash</Nm> commented on your <Tg>Chicken Alfredo</Tg></>, quote: 'cream or crème fraîche?', act: ['↩ Reply'], to: 'Comment thread' },
  // ——— earlier ———
  { id: 11, cat: 'you', sys: true, bucket: 'earlier', when: '1w', unread: false,
    body: <>You earned the <Tg>Batch Boss</Tg> badge — 10 freezer meals banked</>, to: 'Your badges' },
  { id: 12, cat: 'household', who: 'Ellie', hh: true, bucket: 'earlier', when: '1w', unread: false,
    body: <><Nm>Ellie</Nm> cooked <Tg>Potato &amp; Leek Soup</Tg> for the house</>, quote: 'there’s a portion in the freezer for you.', to: 'Activity' },
  { id: 13, cat: 'you', sys: true, bucket: 'earlier', when: '1w', unread: false,
    body: <>Your weekly cook-log summary is ready — <Tg>5 meals, 2 new</Tg></>, to: 'Cook log' },
  { id: 14, cat: 'social', who: 'Dana', bucket: 'earlier', when: '2w', unread: false,
    body: <><Nm>Dana</Nm> followed you back</>, to: 'Dana’s profile' },
];

const BUCKETS = [['today', 'TODAY'], ['week', 'THIS WEEK'], ['earlier', 'EARLIER']];

// ── one row ─────────────────────────────────────────────────────────────────
function NotifRow({ n, compact, onDismiss }) {
  return (
    <div className="notif-row" style={{ position: 'relative', display: 'flex', gap: 12, padding: compact ? '11px 12px' : '14px 16px', borderRadius: 12, background: n.unread ? 'rgba(245,199,100,0.12)' : 'transparent', alignItems: 'flex-start' }}>
      <span style={{ width: 7, paddingTop: 14, flexShrink: 0 }}>{n.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--terracotta)', display: 'block' }}></span>}</span>
      <span style={{ position: 'relative' }}>
        {n.sys ? <NSysIcon cat={n.cat} size={compact ? 34 : 40} /> : <NAvatar who={n.who} size={compact ? 34 : 40} />}
        {/* small category dot so person-rows still read their type */}
        {!n.sys && <span style={{ position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: '50%', background: NCAT[n.cat].color, border: '1.5px solid var(--card)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>{NCAT[n.cat].icon}</span>}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Kalam', fontSize: compact ? 13.5 : 15, color: 'var(--ink-2)', lineHeight: 1.3 }}>{n.body}</div>
        {n.quote && <div style={{ fontFamily: 'Caveat', fontWeight: 600, fontSize: compact ? 16 : 18, color: 'var(--ink)', marginTop: 2 }}>“{n.quote}”</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          {(n.act || []).map((a, i) => <button key={a} className={'mf-btn sm' + (i === 0 ? ' primary' : '')} style={{ fontSize: 12 }}>{a}</button>)}
          {n.to && <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>{(n.act ? '· ' : '')}view → {n.to}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, paddingTop: 3 }}>{n.when}</span>
        <button className="notif-x" title="Dismiss" onClick={() => onDismiss && onDismiss(n.id)}
          style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'var(--card)', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 11, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
      </div>
    </div>);
}

// ── filter chips ────────────────────────────────────────────────────────────
function NotifFilters({ active, setActive, counts }) {
  const chips = [['all', 'All', '', counts.all], ...Object.keys(NCAT).map((k) => [k, NCAT[k].label, NCAT[k].icon, counts[k] || 0])];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {chips.map(([k, l, ic, c]) => {
        const on = active === k;
        return (
          <button key={k} onClick={() => setActive(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', border: `1.25px solid ${on ? 'var(--ink)' : 'var(--line-strong)'}`, background: on ? 'var(--ink)' : 'var(--card)', color: on ? 'var(--paper)' : 'var(--ink-2)', fontFamily: 'Kalam', fontSize: 13.5 }}>
            {ic && <span>{ic}</span>}{l}
            {c > 0 && <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: on ? 'var(--butter)' : 'var(--terracotta)' }}>{c}</span>}
          </button>);
      })}
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// VIEW 1 — the full Notifications page (the bell's "see all" destination).
// ════════════════════════════════════════════════════════════════════════════
function NotificationsPage() {
  const [filter, setFilter] = React.useState('all');
  const [gone, setGone] = React.useState([]);
  const dismiss = (id) => setGone((g) => [...g, id]);
  const live = NOTIFS.filter((n) => !gone.includes(n.id));
  const list = filter === 'all' ? live : live.filter((n) => n.cat === filter);
  const counts = { all: live.filter((n) => n.unread).length };
  Object.keys(NCAT).forEach((k) => { counts[k] = live.filter((n) => n.cat === k && n.unread).length; });

  return (
    <div className="mf mf-page">
      <Nav active={null} />
      <div style={{ padding: '34px 48px 56px', maxWidth: 820, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>🔔 NOTIFICATIONS</div>
            <h1 className="mf-display" style={{ fontSize: 60, margin: '4px 0 0', lineHeight: 0.92 }}>
              everything, <span style={{ color: 'var(--terracotta)' }}>in one place.</span>
            </h1>
            <div style={{ fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-2)', marginTop: 6 }}>{counts.all} unread · act right here, or jump to where it happened.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="mf-btn sm">mark all read</button>
            <button className="mf-btn sm">⚙ settings</button>
          </div>
        </div>

        <div style={{ margin: '22px 0 8px' }}><NotifFilters active={filter} setActive={setFilter} counts={counts} /></div>

        {BUCKETS.map(([bk, label]) => {
          const rows = list.filter((n) => n.bucket === bk);
          if (rows.length === 0) return null;
          return (
            <div key={bk} style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 4px' }}>
                <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>{label}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }}></span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {rows.map((n) => <NotifRow key={n.id} n={n} onDismiss={dismiss} />)}
              </div>
            </div>);
        })}
        <div style={{ textAlign: 'center', padding: '24px 0 0', fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-3)' }}>· that’s everything ·</div>
      </div>
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// VIEW 2 — notification preferences (channels + frequency per category).
// ════════════════════════════════════════════════════════════════════════════
function ChTog({ on, set, label }) {
  return (
    <button onClick={set} title={label} style={{ width: 40, height: 24, borderRadius: 999, border: '1.5px solid var(--ink)', background: on ? 'var(--sage)' : 'var(--paper-warm)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 1.5, left: on ? 18 : 1.5, width: 18, height: 18, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--ink)', transition: 'left .15s' }}></span>
    </button>);
}

function NotifPrefs() {
  const init = {
    rec:       { inapp: true, push: true,  email: false },
    social:    { inapp: true, push: false, email: false },
    household: { inapp: true, push: true,  email: false },
    recipes:   { inapp: true, push: true,  email: true },
    you:       { inapp: true, push: false, email: true },
  };
  const [p, setP] = React.useState(init);
  const [hhFreq, setHhFreq] = React.useState('digest');
  const tog = (cat, ch) => setP((s) => ({ ...s, [cat]: { ...s[cat], [ch]: !s[cat][ch] } }));

  return (
    <div className="mf" style={{ height: '100%', background: 'var(--paper)', overflow: 'auto', padding: '32px 40px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SETTINGS › NOTIFICATIONS</div>
        <h1 className="mf-display" style={{ fontSize: 48, margin: '4px 0 0', lineHeight: 0.95 }}>what reaches you, and how.</h1>
        <p style={{ fontFamily: 'Kalam', fontSize: 14.5, color: 'var(--ink-2)', marginTop: 6, maxWidth: 540 }}>
          In-app always keeps a copy in your 🔔 bell. Push and email are opt-in per type. Household activity defaults to a <b>daily digest</b> so it never floods the bell.
        </p>

        <div style={{ marginTop: 24, background: 'var(--card)', border: '1.25px solid var(--line-strong)', borderRadius: 16, overflow: 'hidden' }}>
          {/* header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper-warm)' }}>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>TYPE</span>
            {['IN-APP', 'PUSH', 'EMAIL'].map((h) => <span key={h} className="mf-mono" style={{ color: 'var(--ink-3)', textAlign: 'center', fontSize: 9 }}>{h}</span>)}
          </div>
          {Object.keys(NCAT).map((cat, i) => (
            <div key={cat}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px 64px', alignItems: 'center', padding: '14px 20px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <NSysIcon cat={cat} size={34} />
                  <div>
                    <div style={{ fontFamily: 'Kalam', fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>{NCAT[cat].label}</div>
                    <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>{NCAT_HINT[cat]}</div>
                  </div>
                </div>
                {['inapp', 'push', 'email'].map((ch) => (
                  <span key={ch} style={{ display: 'flex', justifyContent: 'center' }}><ChTog on={p[cat][ch]} set={() => tog(cat, ch)} label={ch} /></span>
                ))}
              </div>
              {/* household gets a frequency control */}
              {cat === 'household' &&
                <div style={{ padding: '0 20px 14px 65px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>FREQUENCY</span>
                  <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 999 }}>
                    {[['instant', 'Instant'], ['digest', 'Daily digest'], ['off', 'Off']].map(([k, l]) => (
                      <button key={k} onClick={() => setHhFreq(k)} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'Kalam', fontWeight: 700, fontSize: 13, background: hhFreq === k ? 'var(--ink)' : 'transparent', color: hhFreq === k ? 'var(--paper)' : 'var(--ink-2)' }}>{l}</button>
                    ))}
                  </div>
                </div>}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'var(--butter-soft)', border: '1px solid var(--butter)', borderRadius: 12 }}>
          <span style={{ fontSize: 22 }}>🔕</span>
          <div style={{ flex: 1, fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-2)' }}>
            <b>Quiet hours</b> — pause push between <b>9pm and 7am</b>. Recommendations & household digests still collect in the bell.
          </div>
          <ChTog on={true} set={() => {}} label="quiet" />
        </div>
      </div>
    </div>);
}
const NCAT_HINT = {
  rec: 'someone sends you a recipe',
  social: 'follows · cheers · comments',
  household: 'plan · pantry · shopping · cooked',
  recipes: 'forks · suggested edits · upstream changes',
  you: 'badges · streaks · weekly summary',
};

// ════════════════════════════════════════════════════════════════════════════
// MOBILE — notifications page.
// ════════════════════════════════════════════════════════════════════════════
function MobileNotifications() {
  const [filter, setFilter] = React.useState('all');
  const [sheet, setSheet] = React.useState(false);
  const [gone, setGone] = React.useState([]);
  const dismiss = (id) => setGone((g) => [...g, id]);
  const live = NOTIFS.filter((n) => !gone.includes(n.id));
  const list = filter === 'all' ? live : live.filter((n) => n.cat === filter);
  const unread = live.filter((n) => n.unread).length;
  const counts = { all: live.filter((n) => n.unread).length };
  Object.keys(NCAT).forEach((k) => { counts[k] = live.filter((n) => n.cat === k && n.unread).length; });
  const opts = [['all', 'All notifications', ''], ...Object.keys(NCAT).map((k) => [k, NCAT[k].label, NCAT[k].icon])];
  const curLabel = filter === 'all' ? 'All' : NCAT[filter].label;
  return (
    <Phone>
      <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>🔔 NOTIFICATIONS</div>
            <h2 className="mf-display" style={{ fontSize: 26, margin: '2px 0 0', lineHeight: 0.95 }}>{unread} unread</h2>
          </div>
          <button className="mf-btn ghost sm" style={{ fontSize: 11 }}>⚙</button>
        </div>
        {/* filter as a single dropdown button + sheet — no horizontal scroll */}
        <button onClick={() => setSheet(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.25px solid var(--line-strong)', background: 'var(--card)', cursor: 'pointer', fontFamily: 'Kalam', fontSize: 13.5, color: 'var(--ink)' }}>
          <span style={{ color: 'var(--ink-3)' }}>Filter:</span>
          <b>{curLabel}</b>
          {filter !== 'all' && counts[filter] > 0 && <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, color: 'var(--terracotta)' }}>{counts[filter]}</span>}
          <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>▾</span>
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px 14px', position: 'relative' }}>
        {BUCKETS.map(([bk, label]) => {
          const rows = list.filter((n) => n.bucket === bk);
          if (rows.length === 0) return null;
          return (
            <div key={bk} style={{ marginTop: 6 }}>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, padding: '6px 10px 2px' }}>{label}</div>
              {rows.map((n) => <NotifRow key={n.id} n={n} compact onDismiss={dismiss} />)}
            </div>);
        })}
        {/* filter sheet */}
        {sheet &&
          <div onClick={() => setSheet(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(31,26,20,0.32)', display: 'flex', alignItems: 'flex-end', zIndex: 5 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: 'var(--card)', borderRadius: '18px 18px 0 0', padding: '10px 10px 16px', boxShadow: '0 -8px 30px rgba(31,26,20,0.22)' }}>
              <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line-strong)', margin: '4px auto 10px' }}></div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, padding: '0 10px 6px' }}>SHOW</div>
              {opts.map(([k, l, ic]) => {
                const on = filter === k; const c = k === 'all' ? counts.all : counts[k];
                return (
                  <button key={k} onClick={() => { setFilter(k); setSheet(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 12px', borderRadius: 10, border: 'none', background: on ? 'var(--paper-warm)' : 'transparent', cursor: 'pointer', fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink)' }}>
                    {ic && <span style={{ fontSize: 16 }}>{ic}</span>}
                    <span style={{ flex: 1, textAlign: 'left' }}>{l}</span>
                    {c > 0 && <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--terracotta)' }}>{c}</span>}
                    {on && <span style={{ color: 'var(--sage-deep, var(--sage))' }}>✓</span>}
                  </button>);
              })}
            </div>
          </div>}
      </div>
      <TabBar active={null} />
    </Phone>);
}

window.NotificationsPage = NotificationsPage;
window.NotifPrefs = NotifPrefs;
window.MobileNotifications = MobileNotifications;
