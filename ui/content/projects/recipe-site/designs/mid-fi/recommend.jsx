// mid-fi/recommend.jsx — "someone recommended a recipe to you" (the RECEIVING side).
// Primary surface: a dedicated "Recommended to you" inbox. Three directions to compare,
// plus the entry points (notification bell, homepage card) and mobile.
//
// Model: a recommendation is a deliberate person→you hand-off (distinct from the
// algorithmic ✨ rec cards in Discover). Sender is someone you FOLLOW or who's in your
// HOUSEHOLD — household gets a warmer, pinned treatment. The note is OPTIONAL; the recipe
// is always the hero. Actions: Save to box · Add to this week's plan · Cook now.

// ── senders & data ─────────────────────────────────────────────────────────
const REC_FOLLOWERS = { Dana: '#E2A040', Marco: '#8FA677', Wing: '#506B3F', Priya: '#B5462E', Sam: '#7E2D1F' };
const REC_SIG = {
  queso: { makes: 128, again: 54 }, creamy: { makes: 410, again: 58 }, slowmex: { makes: 274, again: 66 },
  soup: { makes: 73, again: 44 }, chips: { makes: 502, again: 71 }, cajun: { makes: 188, again: 60 },
};
const findRecipe = (id) => RECIPES.find((r) => r.id === id) || RECIPES[0];
const sig = (id) => REC_SIG[id] || { makes: 60, again: 45 };

// Ordered newest-first; household + unread bubble up in the views that group.
const REC_ALL = [
  { id: 1, from: 'Ellie', rel: 'household', rid: 'queso',   note: "the kids actually ate this — zero complaints. you have to make it.", when: '2h', unread: true },
  { id: 2, from: 'Marco', rel: 'follow',    rid: 'creamy',  note: "works completely without the onion — thought of your diet straight away.", when: '5h', unread: true },
  { id: 3, from: 'Dana',  rel: 'follow',    rid: 'slowmex', note: null, when: '1d', unread: true },
  { id: 4, from: 'Jamie', rel: 'household', rid: 'soup',    note: "low-FODMAP, made it last night — there's a portion in the freezer for you.", when: '1d', unread: false },
  { id: 5, from: 'Wing',  rel: 'follow',    rid: 'chips',   note: "18 minutes in the air fryer. trust me on this one.", when: '2d', unread: false },
  { id: 6, from: 'Priya', rel: 'follow',    rid: 'cajun',   note: null, when: '3d', unread: false },
];

// Tweaks: recCount (empty/one/several) · recNotes (bool) · recSenders (both/household/follow)
function useRecs() {
  const t = useHH();
  let list = REC_ALL;
  if (t.recSenders === 'household') list = list.filter((r) => r.rel === 'household');
  else if (t.recSenders === 'follow') list = list.filter((r) => r.rel === 'follow');
  if (t.recCount === 'empty') list = [];
  else if (t.recCount === 'one') list = list.slice(0, 1);
  if (t.recNotes === false) list = list.map((r) => ({ ...r, note: null }));
  return list;
}

function senderMeta(rec) {
  if (rec.rel === 'household') {
    const m = HH_ALL_MEMBERS.find((x) => x.name === rec.from);
    return { name: rec.from, color: m ? m.color : '#C8693C', ink: m ? m.ink : '#FFF6E0' };
  }
  return { name: rec.from, color: REC_FOLLOWERS[rec.from] || '#8B7C66', ink: '#FFF6E0' };
}

function RecAvatar({ rec, size = 42 }) {
  const m = senderMeta(rec);
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: m.color, color: m.ink, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: size * 0.5, border: '1.5px solid var(--ink)', flexShrink: 0 }}>{m.name[0]}</span>);
}

function RelPill({ rec, mini }) {
  const hh = rec.rel === 'household';
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: mini ? '1px 7px' : '2px 9px', borderRadius: 999, background: hh ? 'rgba(143,166,119,0.18)' : 'var(--butter-soft)', border: `1px solid ${hh ? 'var(--sage)' : 'var(--butter)'}`, fontFamily: 'Kalam', fontSize: mini ? 10.5 : 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
      {hh ? '🏠 your household' : '👤 you follow'}
    </span>);
}

// honest-signal strip, reused
function RecSignal({ id, mini }) {
  const s = sig(id);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: mini ? 5 : 7, fontFamily: 'Kalam', fontSize: mini ? 11 : 12.5, color: 'var(--ink-3)' }}>
      <span>🍳 made <b style={{ color: 'var(--ink-2)' }}>{s.makes}×</b></span><span>·</span>
      <span><b style={{ color: 'var(--terracotta)' }}>{s.again}%</b> make it again</span>
    </span>);
}

// the action bar — the three actions you asked for + reply/dismiss
function RecActions({ compact }) {
  const sz = compact ? ' sm' : '';
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className={'mf-btn primary' + sz}>♡ Save to box</button>
      <button className={'mf-btn' + sz}>📅 Add to plan</button>
      <button className={'mf-btn' + sz}>🔥 Cook now</button>
      <span style={{ flex: 1 }}></span>
      <button className={'mf-btn ghost' + sz} title="say thanks to the sender">↩ thanks</button>
      <button className={'mf-btn ghost' + sz} title="dismiss" style={{ color: 'var(--ink-3)' }}>✕</button>
    </div>);
}

// recipe strip — the hero, clickable through to the recipe page
function RecipeStrip({ rid, h = 92 }) {
  const r = findRecipe(rid);
  return (
    <div className="mf-card" style={{ display: 'flex', gap: 14, padding: 10, alignItems: 'center' }}>
      <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: h, height: h, borderRadius: 9, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mf-display" style={{ fontSize: 23, lineHeight: 1 }}>{r.title}</div>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 3 }}>{r.cuisine.toLowerCase()} · {r.total} · serves {r.serves}</div>
        <div style={{ marginTop: 6 }}><RecSignal id={rid} mini /></div>
      </div>
      <span className="mf-mono" style={{ color: 'var(--ink-4)', alignSelf: 'flex-start' }}>open →</span>
    </div>);
}

// ── shared header ───────────────────────────────────────────────────────────
function RecHeader({ recs, sub }) {
  const unread = recs.filter((r) => r.unread).length;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
      <div>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>RECOMMENDED TO YOU</div>
        <h1 className="mf-display" style={{ fontSize: 60, margin: '4px 0 0', lineHeight: 0.92 }}>
          things people <span style={{ color: 'var(--terracotta)' }}>passed you.</span>
        </h1>
        <div style={{ fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-2)', marginTop: 6 }}>{sub}</div>
      </div>
      {recs.length > 0 &&
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="mf-display" style={{ fontSize: 40, color: 'var(--terracotta)', lineHeight: 1 }}>{unread}</div>
          <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>new · {recs.length} total</div>
        </div>}
    </div>);
}

// ── empty state ─────────────────────────────────────────────────────────────
function RecEmpty({ compact }) {
  return (
    <div style={{ textAlign: 'center', padding: compact ? '36px 18px' : '64px 24px', border: '1.5px dashed var(--line-strong)', borderRadius: 16, background: 'var(--card)' }}>
      <div style={{ fontSize: compact ? 34 : 46 }}>📮</div>
      <div className="mf-display" style={{ fontSize: compact ? 26 : 34, marginTop: 8 }}>nothing in the post yet.</div>
      <p style={{ fontFamily: 'Kalam', fontSize: compact ? 13 : 15, color: 'var(--ink-2)', maxWidth: 380, margin: '6px auto 0', lineHeight: 1.4 }}>
        When someone you follow — or anyone in your household — sends you a recipe, it lands here. Recipes you’re sent are kept separate from your own box until you save them.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <button className="mf-btn primary sm">share a recipe →</button>
        <button className="mf-btn sm">find cooks to follow</button>
      </div>
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// DIRECTION A — "The stack": note-forward letters. Personal, warm. Household pinned.
// ════════════════════════════════════════════════════════════════════════════
function LetterCard({ rec }) {
  const m = senderMeta(rec);
  return (
    <div style={{ position: 'relative', background: 'var(--card)', border: `1.25px solid ${rec.unread ? 'var(--line-strong)' : 'var(--line)'}`, borderRadius: 16, padding: '18px 20px 16px', boxShadow: rec.unread ? 'var(--shadow)' : 'none' }}>
      {rec.unread && <span style={{ position: 'absolute', top: 16, right: 16, width: 9, height: 9, borderRadius: '50%', background: 'var(--terracotta)' }}></span>}
      {/* sender row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <RecAvatar rec={rec} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Kalam', fontSize: 15.5, color: 'var(--ink-2)' }}>
            <b style={{ color: 'var(--ink)' }}>{m.name}</b> recommended this to you
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <RelPill rec={rec} />
            <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>{rec.when} ago</span>
          </div>
        </div>
      </div>
      {/* note — the personal hero, when present */}
      {rec.note &&
        <div style={{ margin: '14px 0 4px', padding: '12px 16px 12px 18px', borderLeft: '3px solid var(--butter)', background: 'var(--butter-soft)', borderRadius: '4px 12px 12px 4px' }}>
          <span className="mf-display" style={{ fontSize: 25, color: 'var(--ink)', lineHeight: 1.12 }}>“{rec.note}”</span>
        </div>}
      {/* recipe strip — the hero */}
      <div style={{ marginTop: 14 }}><RecipeStrip rid={rec.rid} /></div>
      <div style={{ marginTop: 14 }}><RecActions /></div>
    </div>);
}

function GroupLabel({ children, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 2px' }}>
      <span className="mf-mono" style={{ color: accent ? 'var(--sage)' : 'var(--ink-3)' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--line)' }}></span>
    </div>);
}

// Secondary tab row — Recipes is a SPACE; "Recommended" is the incoming-recipes tab.
// This is the IA answer: it explains the active "Recipes" nav state and gives a
// durable home with an unread badge that the 🔔 bell deep-links into.
function RecipesSubNav({ active = 'rec', count = 0 }) {
  const tabs = [['box', 'My recipe box'], ['rec', 'Recommended'], ['books', 'Cookbooks']];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '0 48px', borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
      {tabs.map(([k, l]) => {
        const on = k === active;
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '13px 0', marginBottom: -1, borderBottom: on ? '2px solid var(--terracotta)' : '2px solid transparent', cursor: 'pointer' }}>
            <span style={{ fontFamily: 'Kalam', fontSize: 16, fontWeight: on ? 700 : 400, color: on ? 'var(--ink)' : 'var(--ink-3)' }}>{l}</span>
            {k === 'rec' && count > 0 &&
              <span style={{ minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: on ? 'var(--terracotta)' : 'var(--ink-4)', color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>}
          </div>);
      })}
      <span style={{ flex: 1 }}></span>
      <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>RECIPES › RECOMMENDED</span>
    </div>);
}

function RecInboxStack() {
  const recs = useRecs();
  const household = recs.filter((r) => r.rel === 'household');
  const others = recs.filter((r) => r.rel === 'follow');
  return (
    <div className="mf mf-page">
      <Nav active="recipes" />
      <RecipesSubNav active="rec" count={recs.filter((r) => r.unread).length} />
      <div style={{ padding: '30px 48px 56px', maxWidth: 720, margin: '0 auto' }}>
        <RecHeader recs={recs} sub="newest first · from your household and the cooks you follow." />
        <div style={{ height: 22 }}></div>
        {recs.length === 0 ? <RecEmpty /> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {household.length > 0 && <>
              <GroupLabel accent>🏠 FROM YOUR HOUSEHOLD</GroupLabel>
              {household.map((rec) => <LetterCard key={rec.id} rec={rec} />)}
            </>}
            {others.length > 0 && <>
              {household.length > 0 && <div style={{ height: 6 }}></div>}
              <GroupLabel>FROM PEOPLE YOU FOLLOW</GroupLabel>
              {others.map((rec) => <LetterCard key={rec.id} rec={rec} />)}
            </>}
          </div>}
      </div>
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// ENTRY POINT 1 — Notification bell dropdown. Recommendation is the showcase type,
// shown alongside the other notification kinds the product already produces.
// ════════════════════════════════════════════════════════════════════════════
const NOTIF_OTHER = [
  { kind: 'follow', who: 'Priya', color: REC_FOLLOWERS.Priya, text: 'started following you', when: '4h', unread: true },
  { kind: 'cheer', who: 'Sam', color: REC_FOLLOWERS.Sam, text: 'cheered your 50-meals badge', when: '1d', unread: false },
  { kind: 'household', who: 'Jamie', color: '#C8693C', text: "added Sunday roast to this week's plan", when: '1d', unread: false },
];

function NotifBellPanel({ width = 380 }) {
  const recs = useRecs();
  const recCount = recs.filter((r) => r.unread).length;
  return (
    <div className="mf" style={{ width, background: 'var(--card)', borderRadius: 16, border: '1.25px solid var(--line-strong)', boxShadow: '0 12px 40px rgba(31,26,20,0.22)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="mf-display" style={{ fontSize: 26 }}>Notifications</span>
        <span className="mf-mono" style={{ color: 'var(--terracotta)', cursor: 'pointer' }}>mark all read</span>
      </div>
      {/* recommendations — pulled to the top, visually distinct */}
      {recs.length > 0 &&
        <div style={{ background: 'var(--butter-soft)', padding: '10px 14px 12px', borderBottom: '1px solid var(--butter)' }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta-deep)', marginBottom: 8 }}>✉ RECOMMENDED TO YOU · {recCount} NEW</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recs.slice(0, 2).map((rec) => {
              const r = findRecipe(rec.rid); const m = senderMeta(rec);
              return (
                <div key={rec.id} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--card)', borderRadius: 11, padding: 8, border: '1px solid var(--butter)' }}>
                  <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 46, height: 46, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.2 }}>
                      <b>{m.name}</b> sent you <b>{r.title}</b>{rec.rel === 'household' ? ' 🏠' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button className="mf-btn primary sm" style={{ fontSize: 11, padding: '2px 9px' }}>♡ Save</button>
                      <button className="mf-btn sm" style={{ fontSize: 11, padding: '2px 9px' }}>📅 Plan</button>
                    </div>
                  </div>
                </div>);
            })}
          </div>
          {recs.length > 2 && <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 9, cursor: 'pointer' }}>see all {recs.length} in your inbox →</div>}
        </div>}
      {/* the rest */}
      <div style={{ padding: '6px 6px 8px' }}>
        {NOTIF_OTHER.map((n, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 10 }}>
            <span style={{ width: 8, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{n.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--terracotta)' }}></span>}</span>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: n.color, border: '1.5px solid var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 17, color: '#FFF6E0', flexShrink: 0 }}>{n.who[0]}</span>
            <div style={{ flex: 1, minWidth: 0, fontFamily: 'Kalam', fontSize: 13.5, color: 'var(--ink-2)' }}>
              <b style={{ color: 'var(--ink)' }}>{n.who}</b> {n.text}
              <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, marginLeft: 6 }}>{n.when}</span>
            </div>
          </div>
        ))}
      </div>
      {/* footer — the bell is a peek; the page is the archive */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--line)', background: 'var(--paper-warm)' }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)', cursor: 'pointer' }}>View all notifications →</span>
        <span style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer' }}>⚙ settings</span>
      </div>
    </div>);
}

// Framed demo: the bell sitting in a nav corner, panel open beneath it.
function NotifBellDemo() {
  const recs = useRecs();
  const count = recs.filter((r) => r.unread).length + NOTIF_OTHER.filter((n) => n.unread).length;
  return (
    <div className="mf" style={{ height: '100%', background: 'var(--paper)', padding: 22, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 18 }}>
        <div className="mf-search" style={{ minWidth: 180, opacity: 0.5 }}><span style={{ color: 'var(--ink-3)' }}>⌕</span><input placeholder="search…" readOnly /></div>
        <div style={{ position: 'relative' }}>
          <span style={{ fontSize: 26, cursor: 'pointer' }}>🔔</span>
          {count > 0 && <span style={{ position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--terracotta)', color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--paper)' }}>{count}</span>}
        </div>
        <div className="mf-avatar">R</div>
      </div>
      <div style={{ position: 'absolute', top: 60, right: 22 }}><NotifBellPanel /></div>
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// ENTRY POINT 2 — Homepage prompt card (sits on the first-run / home).
// ════════════════════════════════════════════════════════════════════════════
function RecHomeCard() {
  const recs = useRecs();
  return (
    <div className="mf" style={{ height: '100%', background: 'var(--paper)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {recs.length === 0 ? <div style={{ width: 380 }}><RecEmpty compact /></div> :
        <div style={{ width: 420, background: 'var(--card)', borderRadius: 18, border: '1.25px solid var(--line-strong)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--butter-soft)', borderBottom: '1px solid var(--butter)' }}>
            <div>
              <div className="mf-mono" style={{ color: 'var(--terracotta-deep)' }}>✉ RECOMMENDED TO YOU</div>
              <div className="mf-display" style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>
                {recs.length} {recs.length === 1 ? 'recipe is' : 'recipes are'} waiting
              </div>
            </div>
            <div style={{ display: 'flex' }}>
              {recs.slice(0, 3).map((rec, i) => <span key={rec.id} style={{ marginLeft: i === 0 ? 0 : -10 }}><RecAvatar rec={rec} size={34} /></span>)}
            </div>
          </div>
          <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.slice(0, 2).map((rec) => {
              const r = findRecipe(rec.rid); const m = senderMeta(rec);
              return (
                <div key={rec.id} style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                  <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 52, height: 52, borderRadius: 9, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mf-display" style={{ fontSize: 19, lineHeight: 1 }}>{r.title}</div>
                    <div style={{ fontFamily: 'Kalam', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>from <b style={{ color: 'var(--ink-2)' }}>{m.name}</b>{rec.rel === 'household' ? ' · 🏠 household' : ''}</div>
                  </div>
                  <button className="mf-btn primary sm">♡ Save</button>
                </div>);
            })}
            <button className="mf-btn" style={{ justifyContent: 'center', marginTop: 2 }}>open recommendations inbox →</button>
          </div>
        </div>}
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// MOBILE — the inbox (stack direction) + the bell as a sheet.
// ════════════════════════════════════════════════════════════════════════════
function MobileRecInbox() {
  const recs = useRecs();
  const unread = recs.filter((r) => r.unread).length;
  return (
    <Phone>
      <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>RECOMMENDED TO YOU</div>
            <h2 className="mf-display" style={{ fontSize: 27, margin: '2px 0 0', lineHeight: 0.95 }}>passed to you.</h2>
          </div>
          <MobileAvatar />
        </div>
        {/* secondary tabs — Recommended lives under the Recipes tab */}
        <div style={{ display: 'flex', gap: 3, padding: 3, marginTop: 10, background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 999 }}>
          {[['box', 'Box'], ['rec', 'Recommended'], ['books', 'Books']].map(([k, l]) => {
            const on = k === 'rec';
            return (
              <div key={k} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px 6px', borderRadius: 999, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--paper)' : 'var(--ink-2)', fontFamily: 'Kalam', fontWeight: 700, fontSize: 12 }}>
                {l}{k === 'rec' && unread > 0 && <span style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--terracotta)', color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}
              </div>);
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 16px' }}>
        {recs.length === 0 ? <RecEmpty compact /> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recs.map((rec) => {
              const r = findRecipe(rec.rid); const m = senderMeta(rec);
              return (
                <div key={rec.id} style={{ position: 'relative', background: 'var(--card)', borderRadius: 14, border: `1px solid ${rec.unread ? 'var(--line-strong)' : 'var(--line)'}`, padding: 12, boxShadow: rec.unread ? 'var(--shadow)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <RecAvatar rec={rec} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.1 }}><b style={{ color: 'var(--ink)' }}>{m.name}</b> recommended this</div>
                      <div style={{ marginTop: 2 }}><RelPill rec={rec} mini /></div>
                    </div>
                    {rec.unread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--terracotta)', flexShrink: 0 }}></span>}
                  </div>
                  {rec.note && <div style={{ margin: '10px 0 0', padding: '9px 12px', borderLeft: '3px solid var(--butter)', background: 'var(--butter-soft)', borderRadius: '3px 10px 10px 3px', fontFamily: 'Caveat', fontWeight: 600, fontSize: 18, lineHeight: 1.15, color: 'var(--ink)' }}>“{rec.note}”</div>}
                  <div className="mf-card" style={{ display: 'flex', gap: 10, padding: 8, alignItems: 'center', marginTop: 10 }}>
                    <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mf-display" style={{ fontSize: 18, lineHeight: 1 }}>{r.title}</div>
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 3 }}>🍳 {sig(rec.rid).makes}× · {sig(rec.rid).again}% again</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button className="mf-btn primary sm" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>♡ Save</button>
                    <button className="mf-btn sm" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>📅 Plan</button>
                    <button className="mf-btn sm" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>🔥 Cook</button>
                  </div>
                </div>);
            })}
          </div>}
      </div>
      <TabBar active="recipes" />
    </Phone>);
}

window.RecInboxStack = RecInboxStack;
window.NotifBellDemo = NotifBellDemo;
window.RecHomeCard = RecHomeCard;
window.MobileRecInbox = MobileRecInbox;
window.RecEmpty = RecEmpty;
// shared with notifications.jsx
window.findRecipe = findRecipe;
window.senderMeta = senderMeta;
window.RecAvatar = RecAvatar;
window.recSig = sig;
