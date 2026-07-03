// mid-fi/feed.jsx — the social DISCOVERY FEED, built like a real scrollable feed.
// Logged-OUT: PUBLIC activity only (no friends — you don't have any yet).
// Logged-IN: scope switcher — Following / Household / Public (à la Twitter For-You/Following).
// Terminology: a "cook" = a person. The activity = a recipe is "made". So "made 341×",
// "make it again", and people are counted as "home cooks".

const PEOPLE = {
  Ellie: '#C8693C', Marco: '#8FA677', Jess: '#99394A', Dana: '#E2A040',
  Sam: '#7E2D1F', Wing: '#506B3F', Priya: '#B5462E', You: '#1F1A14'
};
const personColor = (n) => PEOPLE[n] || '#8B7C66';
const FEED_META = {
  chorizo: { makes: 341, repeat: 62 }, queso: { makes: 128, repeat: 54 }, chips: { makes: 502, repeat: 71 },
  slowmex: { makes: 274, repeat: 66 }, pesto: { makes: 96, repeat: 49 }, creamy: { makes: 410, repeat: 58 },
  soup: { makes: 73, repeat: 44 }, cajun: { makes: 188, repeat: 60 }, alfredo: { makes: 233, repeat: 51 }
};
const fmeta = (id) => FEED_META[id] || { makes: 60, repeat: 45 };
const recById = (id) => RECIPES.find((r) => r.id === id) || RECIPES[0];

function FAvatar({ name, size = 38 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: personColor(name), border: '1.5px solid var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: size * 0.5, color: '#FFF6E0', flexShrink: 0 }}>{name === 'You' ? '🧑\u200d🍳' : name[0]}</span>);

}

// honest-signal strip — "made 341× · 62% make it again"
function Signal({ id, mini }) {
  const m = fmeta(id);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: mini ? 6 : 8, fontFamily: 'Kalam', fontSize: mini ? 11 : 13, color: 'var(--ink-3)' }}>
      <span>🍳 made <b style={{ color: 'var(--ink-2)' }}>{m.makes}×</b></span>
      <span>·</span>
      <span><b style={{ color: 'var(--terracotta)' }}>{m.repeat}%</b> make it again</span>
    </span>);

}

// the bottom action row on every post — looks like a social action bar
function PostActions({ r, onGated, comments }) {
  const A = ({ icon, label, onClick }) =>
  <button onClick={onClick} className="mf-feed-act" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Kalam', fontSize: 13.5, color: 'var(--ink-3)', padding: '4px 2px' }}>
      <span style={{ fontSize: 15 }}>{icon}</span>{label}
    </button>;

  return (
    <div style={{ display: 'flex', gap: 18, marginTop: 10, alignItems: 'center' }}>
      <A icon="♡" label="Save" onClick={() => onGated(r, 'save')} />
      <A icon="🔥" label="Cook this" onClick={() => onGated(r, 'cook')} />
      <A icon="🌱" label="Fork" onClick={() => onGated(r, 'fork')} />
      <A icon="💬" label={comments || ''} onClick={() => onGated(r, 'save')} />
    </div>);

}

// ── one post in the continuous feed ───────────────────────────────────────
function FeedPost({ item, onGated, showFollow, first }) {
  const r = recById(item.rid);

  // suggested / trending recommendation — visually distinct, inline
  if (item.type === 'rec') {
    return (
      <article style={{ borderTop: first ? 'none' : '1px solid var(--line)', padding: '16px 0' }}>
        <div style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 14, background: 'var(--butter-soft)', border: '1px solid var(--butter)' }}>
          <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 110, height: 110, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta-deep)' }}>✨ {item.reason}</div>
            <div className="mf-display" style={{ fontSize: 24, lineHeight: 1, marginTop: 3 }}>{r.title}</div>
            <div style={{ marginTop: 5 }}><Signal id={item.rid} mini /></div>
            <div style={{ marginTop: 'auto', paddingTop: 8 }}><PostActions r={r} onGated={onGated} /></div>
          </div>
        </div>
      </article>);

  }

  // header line per activity type
  let line,when = item.when;
  if (item.type === 'cooked') line = <>cooked this{item.forWho ? <> for {item.forWho}</> : ''}</>;else
  if (item.type === 'forked') line = <>forked a recipe</>;else
  if (item.type === 'saved') line = <>saved {item.count} recipes to <b>{item.book}</b></>;else
  if (item.type === 'planned') line = <>added this to <b>{item.book}</b></>;else
  if (item.type === 'milestone') line = item.text;

  return (
    <article style={{ borderTop: first ? 'none' : '1px solid var(--line)', padding: '18px 0' }}>
      {/* author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FAvatar name={item.who} />
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
          <div style={{ fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-2)' }}>
            <b style={{ color: 'var(--ink)' }}>{item.who}</b> {line}
          </div>
          <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, marginTop: 1 }}>{item.sub || `${when} ago`}</div>
        </div>
        {showFollow ?
        <button className="mf-btn sm" onClick={() => onGated(r, 'follow')}>＋ follow</button> :
        <button className="mf-btn ghost sm" style={{ padding: '4px 8px' }}>···</button>}
      </div>

      {/* body per type */}
      {item.type === 'milestone' ?
      <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(143,166,119,0.14)', border: '1px solid var(--sage)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--butter)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{item.badge}</div>
          <div style={{ flex: 1 }}>
            <div className="mf-display" style={{ fontSize: 24, lineHeight: 1 }}>{item.title}</div>
            <div style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{item.cap}</div>
          </div>
          <button className="mf-btn sm" onClick={() => onGated(r, 'save')}>🎉 cheer</button>
        </div> :
      item.type === 'saved' ?
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {RECIPES.slice(2, 5).map((rr) =>
        <div key={rr.id} onClick={() => onGated(rr, 'save')} style={{ flex: 1, cursor: 'pointer' }}>
              <FoodPhoto palette={rr.palette} glyph={rr.glyph} style={{ height: 96, borderRadius: 10 }} />
              <div className="mf-display" style={{ fontSize: 15, marginTop: 4, lineHeight: 1 }}>{rr.title}</div>
            </div>
        )}
        </div> :

      // cooked / forked / planned — big hero photo of the make
      <div style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => onGated(r, 'save')}>
          <div style={{ position: 'relative' }}>
            <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 260 }} big />
            {item.type === 'forked' &&
          <span style={{ position: 'absolute', top: 10, left: 10, padding: '4px 10px', borderRadius: 999, background: 'rgba(31,26,20,0.66)', color: '#FFF6E0', fontFamily: 'Caveat', fontWeight: 700, fontSize: 17 }}>🌱 {item.fork}</span>
          }
          </div>
          <div style={{ padding: '12px 14px', background: 'var(--card)' }}>
            <div className="mf-display" style={{ fontSize: 23, lineHeight: 1 }}>{item.type === 'forked' ? item.fork : r.title}</div>
            {item.type === 'forked' && <div style={{ fontFamily: 'Kalam', fontSize: 12.5, color: 'var(--terracotta)', marginTop: 2 }}>changed from {r.title} · {item.diff}</div>}
            {item.note && <div style={{ fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>“{item.note}”</div>}
            <div style={{ marginTop: 8 }}><Signal id={item.rid} /></div>
          </div>
        </div>
      }

      {item.type !== 'milestone' && <PostActions r={r} onGated={onGated} comments={item.comments} />}
    </article>);

}

// ── feed data per scope ───────────────────────────────────────────────────
// PUBLIC: anyone on the platform — what logged-out visitors see.
const FEED_PUBLIC = [
{ type: 'cooked', who: 'Wing', rid: 'chips', sub: 'trending · 12k cooks this week', note: 'air-fryer, 18 min, gone in 5', comments: 24 },
{ type: 'rec', rid: 'creamy', reason: 'TRENDING THIS WEEK' },
{ type: 'forked', who: 'Marco', rid: 'chorizo', fork: 'Halloumi Pasta Bake', diff: 'chicken → halloumi', sub: 'a popular fork · 41 cooks made it', note: 'veggie version, even better imo', comments: 12 },
{ type: 'milestone', who: 'Sam', badge: '🍴', title: 'Sam cooked their 50th meal', cap: 'a milestone on Robbie\'s recipes', rid: 'queso', when: '2d' },
{ type: 'cooked', who: 'Dana', rid: 'slowmex', sub: 'popular with batch-cookers', note: 'fed 6, leftovers for days', comments: 8 },
{ type: 'rec', rid: 'soup', reason: 'POPULAR WITH VEGGIE COOKS' }];


// FOLLOWING: people you follow.
const FEED_FOLLOWING = [
{ type: 'cooked', who: 'Ellie', rid: 'queso', note: 'would 100% make again — kids demolished it', when: '2h', comments: 6 },
{ type: 'rec', rid: 'creamy', reason: 'SUGGESTED · YOU COOK A LOT OF PASTA' },
{ type: 'forked', who: 'Marco', rid: 'chorizo', fork: 'Halloumi Pasta Bake', diff: 'chicken → halloumi', when: '5h', note: 'veggie version, even better imo', comments: 3 },
{ type: 'cooked', who: 'Dana', rid: 'slowmex', note: 'fed 6, leftovers for days', when: '8h', comments: 4 },
{ type: 'saved', who: 'Jess', count: 3, book: 'Batch cook', rid: 'cajun', when: '1d' },
{ type: 'milestone', who: 'Sam', badge: '🔥', title: 'Sam is on a 12-week streak', cap: 'cooked something new every week', rid: 'chips', when: '2d' }];


// HOUSEHOLD: the people you cook with — practical, shared.
const FEED_HOUSEHOLD = [
{ type: 'cooked', who: 'Sam', rid: 'queso', forWho: 'the house', note: 'dinner\'s sorted — there\'s a portion left for you', when: '1h', comments: 2 },
{ type: 'planned', who: 'Sam', rid: 'chorizo', book: 'this week\'s plan', sub: 'Thursday · just now' },
{ type: 'cooked', who: 'You', rid: 'soup', note: 'batch in the freezer, 4 portions', when: '1d' },
{ type: 'forked', who: 'Priya', rid: 'chorizo', fork: 'Low-FODMAP Pasta Bake', diff: 'no onion/garlic, garlic oil instead', sub: 'Mum · 2d ago', note: 'so we can all eat it 💛', comments: 1 }];


const FEED_BY_SCOPE = { public: FEED_PUBLIC, following: FEED_FOLLOWING, household: FEED_HOUSEHOLD };

// ── scope switcher — the social-feed tab control ──────────────────────────
function ScopeTabs({ scope, setScope, signedIn, onLocked, compact }) {
  const tabs = [['following', 'Following', '👥'], ['household', 'Household', '🏠'], ['public', 'Public', '🌍']];
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 999 }}>
      {tabs.map(([k, l, ic]) => {
        const locked = !signedIn && k !== 'public';
        const active = scope === k;
        return (
          <button key={k} onClick={() => locked ? onLocked() : setScope(k)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
            padding: compact ? '5px 11px' : '7px 16px', borderRadius: 999,
            background: active ? 'var(--ink)' : 'transparent',
            color: active ? 'var(--paper)' : locked ? 'var(--ink-4)' : 'var(--ink-2)',
            fontFamily: 'Kalam', fontWeight: 700, fontSize: compact ? 13 : 14.5
          }}>
            <span style={{ fontSize: compact ? 12 : 14 }}>{locked ? '🔒' : ic}</span>{l}
          </button>);

      })}
    </div>);

}

// ── right rail: stat-driven Top Cooks ranking ─────────────────────────────
const TOP_COOKS = [
['Wing', 32, 94, 'fast & spicy'],
['Ellie', 28, 71, 'weeknight veggie'],
['Marco', 24, 48, 'Italian, lots of forks'],
['Dana', 21, 63, 'batch & freeze']];


function DiscoverRail({ signedIn, onGated }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
      {!signedIn &&
      <div style={{ padding: 18, borderRadius: 14, background: 'var(--butter-soft)', border: '1.5px solid var(--terracotta)' }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta-deep)' }}>MAKE THIS FEED YOURS</div>
          <div className="mf-display" style={{ fontSize: 25, margin: '4px 0 8px', lineHeight: 0.98, color: 'var(--ink)' }} data-comment-anchor="b08ec86367-div-211-11">Follow cooks. Cook with your household.</div>
          <p style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', margin: '0 0 12px', lineHeight: 1.4 }}>Right now you're seeing public activity. Sign in to follow people and unlock a Following & Household feed.</p>
          <GoogleBtn wide label="Sign up with Google" />
        </div>
      }

      {/* TOP COOKS — explicitly ranked by a real stat */}
      <div className="mf-card" style={{ padding: 16, cursor: 'default' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>TOP COOKS THIS WEEK</div>
          <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>by meals cooked</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 12 }}>
          {TOP_COOKS.map(([n, meals, fed, tag], i) =>
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 18, textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: i === 0 ? 'var(--terracotta)' : 'var(--ink-4)' }}>{i + 1}</span>
              <FAvatar name={n} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Kalam', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>{n}</div>
                <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>🍳 {meals} meals · 🍴 fed {fed}</div>
              </div>
              <button className="mf-btn sm" onClick={() => onGated(RECIPES[0], 'follow')}>＋</button>
            </div>
          )}
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontFamily: 'Kalam', fontSize: 11.5, color: 'var(--ink-4)' }}>
          ranked by meals cooked this week · also try <span style={{ color: 'var(--terracotta)' }}>people fed</span> · <span style={{ color: 'var(--terracotta)' }}>new recipes tried</span>
        </div>
      </div>

      <div className="mf-card" style={{ padding: 16, cursor: 'default' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>BROWSE BY MOOD</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {['quick weeknight', 'one-pot', 'batch & freeze', 'spicy', 'veggie', 'comfort', 'under 30m'].map((c) => <span key={c} className="mf-tag soft">{c}</span>)}
        </div>
      </div>
    </div>);

}

// ════════════════════════════════════════════════════════════════════════
function MidDiscoverFeed({ signedIn }) {
  const [gate, setGate] = React.useState(null);
  const [scope, setScope] = React.useState(signedIn ? 'following' : 'public');
  const onGated = signedIn ? () => {} : (r, a) => setGate({ action: a === 'follow' ? 'save' : a, recipe: r });
  const onLocked = () => setGate({ action: 'follow', recipe: RECIPES[0] });
  const items = FEED_BY_SCOPE[signedIn ? scope : 'public'];
  const showFollow = (signedIn ? scope : 'public') === 'public';

  return (
    <div className="mf mf-page" style={{ position: 'relative' }}>
      {signedIn ? <Nav active="discover" /> : <PublicNav active="discover" onSignIn={() => setGate({ action: 'save', recipe: RECIPES[0] })} />}

      {/* hero band */}
      <div style={{ padding: '28px 48px 14px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>{signedIn ? 'DISCOVER · YOUR FEED' : 'DISCOVER · NO ACCOUNT NEEDED'}</div>
        <h1 className="mf-display" style={{ fontSize: 52, margin: '4px 0 0', lineHeight: 0.92 }}>
          {signedIn ? <>What people are <span style={{ color: 'var(--terracotta)' }}>cooking right now.</span></> : <>Cook what people <span style={{ color: 'var(--terracotta)' }}>actually cook again.</span></>}
        </h1>
        {!signedIn &&
        <p style={{ fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 600, lineHeight: 1.4 }}>
            A living feed of real home cooks — see what got made twice, what got tweaked, and what's trending. Honest counts of how often a recipe gets made, not star ratings.
          </p>
        }
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 10, marginTop: 10, letterSpacing: '0.03em' }}>
          3,100 HOME COOKS · 41,000 MEALS COOKED THIS MONTH
        </div>
      </div>

      {/* sticky scope switcher — the feed control */}
      <div style={{ padding: '6px 48px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 5, borderBottom: '1px solid var(--line)' }}>
        <ScopeTabs scope={signedIn ? scope : 'public'} setScope={setScope} signedIn={signedIn} onLocked={onLocked} />
        <span style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)' }}>
          {signedIn ?
          scope === 'following' ? 'people you follow' : scope === 'household' ? 'the people you cook with' : 'everyone on Robbie\'s recipes' :
          'public activity — sign in to follow people'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
          <span className="mf-tag soft">newest</span>
          <span className="mf-tag soft">most cooked</span>
        </span>
      </div>

      {/* body: feed + rail */}
      <div style={{ padding: '4px 48px 56px', display: 'grid', gridTemplateColumns: 'minmax(0, 600px) 320px', gap: 36, justifyContent: 'center', alignItems: 'start' }}>
        <div>
          {items.map((it, i) => <FeedPost key={scope + i} item={it} onGated={onGated} showFollow={showFollow} first={i === 0} />)}
          <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-3)' }}>· you're all caught up ·</div>
        </div>
        <DiscoverRail signedIn={signedIn} onGated={onGated} />
      </div>

      <JITOverlay gate={gate} setGate={setGate} />
    </div>);

}

// ── mobile feed ────────────────────────────────────────────────────────────
function MobileDiscoverFeed({ signedIn }) {
  const [gate, setGate] = React.useState(null);
  const [scope, setScope] = React.useState(signedIn ? 'following' : 'public');
  const onGated = signedIn ? () => {} : (r, a) => setGate({ action: a, recipe: r });
  const onLocked = () => setGate({ action: 'follow', recipe: RECIPES[0] });
  const items = FEED_BY_SCOPE[signedIn ? scope : 'public'];
  const showFollow = (signedIn ? scope : 'public') === 'public';

  return (
    <Phone>
      <div style={{ padding: '6px 16px 8px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>DISCOVER</div>
            <h2 className="mf-display" style={{ fontSize: 24, margin: '2px 0 0', lineHeight: 1 }}>{signedIn ? 'cooking now.' : 'cook it again.'}</h2>
          </div>
          {signedIn ? <MobileAvatar /> : <button className="mf-btn primary sm" onClick={() => setGate({ action: 'save', recipe: RECIPES[0] })}>sign up</button>}
        </div>
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <ScopeTabs scope={signedIn ? scope : 'public'} setScope={setScope} signedIn={signedIn} onLocked={onLocked} compact />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!signedIn &&
        <div style={{ margin: '12px 14px 0', padding: '10px 12px', borderRadius: 10, background: 'var(--butter-soft)', border: '1.5px solid var(--terracotta)' }}>
            <div style={{ fontFamily: 'Kalam', fontSize: 12.5, lineHeight: 1.3, color: 'var(--ink-2)' }}><b style={{ color: 'var(--ink)' }}>You're seeing public activity.</b> Sign in to follow people & unlock your household feed.</div>
            <button className="mf-btn primary sm" style={{ marginTop: 8 }} onClick={() => setGate({ action: 'follow', recipe: RECIPES[0] })}>sign up — free</button>
          </div>
        }
        <div style={{ padding: '0 14px' }}>
          {items.map((it, i) => {
            const r = recById(it.rid);
            const m = fmeta(it.rid);
            if (it.type === 'rec') {
              return (
                <div key={scope + i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)', padding: '12px 0' }}>
                  <div onClick={() => onGated(r, 'save')} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 12, background: 'var(--butter-soft)', border: '1px solid var(--butter)' }}>
                    <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 64, height: 64, borderRadius: 8, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mf-mono" style={{ color: 'var(--terracotta-deep)', fontSize: 8 }}>✨ {it.reason}</div>
                      <div className="mf-display" style={{ fontSize: 16, lineHeight: 1, marginTop: 2 }}>{r.title}</div>
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 3 }}>🍳 made {m.makes}× · {m.repeat}% again</div>
                    </div>
                  </div>
                </div>);

            }
            let line;
            if (it.type === 'cooked') line = <>cooked this{it.forWho ? ` for ${it.forWho}` : ''}</>;else
            if (it.type === 'forked') line = <>forked a recipe</>;else
            if (it.type === 'saved') line = <>saved {it.count} to {it.book}</>;else
            if (it.type === 'planned') line = <>added to {it.book}</>;else
            line = it.title;
            return (
              <div key={scope + i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)', padding: '14px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FAvatar name={it.who} size={30} />
                  <div style={{ flex: 1, minWidth: 0, fontFamily: 'Kalam', fontSize: 12.5, lineHeight: 1.15 }}>
                    <b>{it.who}</b> {line}
                    <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 8 }}>{it.sub || `${it.when} ago`}</div>
                  </div>
                  {showFollow && <button className="mf-btn sm" style={{ fontSize: 10 }} onClick={() => onGated(r, 'follow')}>＋ follow</button>}
                </div>
                {it.type === 'milestone' ?
                <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'rgba(143,166,119,0.14)', border: '1px solid var(--sage)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 26 }}>{it.badge}</div>
                    <div className="mf-display" style={{ fontSize: 16, lineHeight: 1 }}>{it.title}</div>
                  </div> :

                <div onClick={() => onGated(r, 'save')} style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
                    <div style={{ position: 'relative' }}>
                      <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 150 }} />
                      {it.type === 'forked' && <span style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 999, background: 'rgba(31,26,20,0.66)', color: '#FFF6E0', fontFamily: 'Caveat', fontWeight: 700, fontSize: 14 }}>🌱 {it.fork}</span>}
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--card)' }}>
                      <div className="mf-display" style={{ fontSize: 16, lineHeight: 1 }}>{it.type === 'forked' ? it.fork : r.title}</div>
                      {it.note && <div style={{ fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>“{it.note}”</div>}
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 4 }}>🍳 made {m.makes}× · {m.repeat}% make it again</div>
                    </div>
                  </div>
                }
                {it.type !== 'milestone' &&
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontFamily: 'Kalam', fontSize: 12.5, color: 'var(--ink-3)' }}>
                    <span onClick={() => onGated(r, 'save')}>♡ Save</span>
                    <span onClick={() => onGated(r, 'cook')}>🔥 Cook</span>
                    <span onClick={() => onGated(r, 'fork')}>🌱 Fork</span>
                    {it.comments && <span>💬 {it.comments}</span>}
                  </div>
                }
              </div>);

          })}
          <div style={{ textAlign: 'center', padding: '18px 0', fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-3)' }}>· all caught up ·</div>
        </div>
      </div>

      {gate &&
      <React.Fragment>
          <div onClick={() => setGate(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(31,26,20,0.45)', zIndex: 6 }}></div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--paper)', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '12px 18px 22px', zIndex: 7, boxShadow: '0 -8px 24px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--ink-4)', margin: '0 auto 12px' }}></div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>SIGN IN TO {gate.action === 'cook' ? 'COOK' : gate.action === 'follow' ? 'FOLLOW PEOPLE' : 'SAVE'}</div>
            <div className="mf-display" style={{ fontSize: 20, lineHeight: 1, margin: '2px 0 10px' }}>Make this feed yours.</div>
            <GoogleBtn wide />
            <button className="mf-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>continue with email</button>
            <div style={{ textAlign: 'center', marginTop: 10 }}><span onClick={() => setGate(null)} className="mf-mono" style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>keep browsing →</span></div>
          </div>
        </React.Fragment>
      }
      <TabBar active="discover" />
    </Phone>);

}

window.MidDiscoverFeed = MidDiscoverFeed;
window.MobileDiscoverFeed = MobileDiscoverFeed;