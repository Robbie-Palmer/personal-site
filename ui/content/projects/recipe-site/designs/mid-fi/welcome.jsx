// mid-fi/welcome.jsx — the LOGGED-OUT, public, browsable home.
// Philosophy: browse everything free; an account is only needed to SAVE / COOK / PLAN.
// Sign-in is just-in-time (Google), surfaced the moment you reach for a gated action.

// ── public-recipe meta: provenance + honest-signal, keyed to RECIPES ───────
const PUB_META = {
  chorizo: { by: 'Robbie', handle: 'robbie', src: 'BBC Good Food', cooks: 341, repeat: 62, forks: 8 },
  queso:   { by: 'Ellie',  handle: 'elliecooks', src: 'family recipe', cooks: 128, repeat: 54, forks: 2 },
  chips:   { by: 'Wing',   handle: 'wingit', src: 'Instagram', cooks: 502, repeat: 71, forks: 14 },
  slowmex: { by: 'Dana',   handle: 'slowdana', src: 'Pinch of Nom', cooks: 274, repeat: 66, forks: 5 },
  pesto:   { by: 'Marco',  handle: 'marco_r', src: 'nonna', cooks: 96,  repeat: 49, forks: 1 },
  creamy:  { by: 'Sam',    handle: 'samtucks', src: 'TikTok', cooks: 410, repeat: 58, forks: 11 },
  soup:    { by: 'Robbie', handle: 'robbie', src: 'River Cottage', cooks: 73, repeat: 44, forks: 0 },
  cajun:   { by: 'Jess',   handle: 'jessfeeds', src: 'blog', cooks: 188, repeat: 60, forks: 3 },
  alfredo: { by: 'Marco',  handle: 'marco_r', src: 'BBC Good Food', cooks: 233, repeat: 51, forks: 6 },
};
const pubMeta = (id) => PUB_META[id] || { by: 'a home cook', handle: 'cook', src: 'the web', cooks: 50, repeat: 40, forks: 0 };

// ── the multi-colour Google "G" used on the sign-in button ─────────────────
function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.1-10 6.1-17.5z"/>
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6.1C.9 16.7 0 20.2 0 24s.9 7.3 2.6 10.4l7.8-6.1z"/>
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.5-5.8c-2 1.4-4.7 2.3-7.8 2.3-6.4 0-11.8-3.8-13.6-9.6l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}

function GoogleBtn({ label = 'Continue with Google', wide, onClick }) {
  return (
    <button onClick={onClick} className="mf-btn" style={{
      background: '#FFFEF8', border: '1.5px solid var(--ink)', borderRadius: 999,
      padding: wide ? '12px 18px' : '8px 14px', fontSize: wide ? 16 : 14,
      width: wide ? '100%' : 'auto', justifyContent: 'center', fontWeight: 700,
    }}>
      <GoogleG size={wide ? 20 : 17} /> {label}
    </button>
  );
}

// ── public top-nav: no avatar, no diet pill — a log in / sign up pair ──────
function PublicNav({ active = 'browse', onSignIn }) {
  const items = [['discover', 'Discover'], ['cooks', 'Cooks'], ['collections', 'Collections'], ['how', 'How it works']];
  return (
    <nav className="mf-nav">
      <div className="mf-logo">Robbie's <em style={{ fontStyle: 'italic', color: 'var(--terracotta)' }}>recipes</em></div>
      <div style={{ display: 'flex', gap: 18, marginLeft: 16 }}>
        {items.map(([k, l]) => <a key={k} href="#" className={active === k ? 'active' : ''}>{l}</a>)}
      </div>
      <div className="mf-nav-spacer"></div>
      <div className="mf-search" style={{ minWidth: 240 }}>
        <span style={{ color: 'var(--ink-3)' }}>⌕</span>
        <input placeholder="search 12,400 recipes…" />
        <span className="mf-mono" style={{ color: 'var(--ink-4)' }}>⌘K</span>
      </div>
      <button className="mf-btn ghost" onClick={onSignIn}>log in</button>
      <button className="mf-btn primary" onClick={onSignIn}>sign up — free</button>
    </nav>
  );
}

// ── a public recipe card: provenance chip + by-line + signal + gated save ──
function PublicRecipeCard({ r, onGated, compact }) {
  const m = pubMeta(r.id);
  const [hover, setHover] = React.useState(false);
  return (
    <div className="mf-card" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: compact ? 130 : 168 }} />
        {/* origin chip — the differentiator, always visible */}
        <span style={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(31,26,20,0.62)', color: '#FFF6E0', fontFamily: 'JetBrains Mono', fontSize: 9, letterSpacing: '0.03em' }}>
          🌐 via {m.src}
        </span>
        {/* gated save — appears on hover, triggers sign-in */}
        <button onClick={() => onGated && onGated(r, 'save')} title="save to your box"
          style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--ink)', background: 'var(--card)', cursor: 'pointer', fontSize: 14, opacity: hover ? 1 : 0, transform: hover ? 'translateY(0)' : 'translateY(-4px)', transition: 'all .15s' }}>♡</button>
      </div>
      <div style={{ padding: compact ? '10px 12px 12px' : '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="mf-display" style={{ fontSize: compact ? 21 : 25, color: 'var(--ink)', lineHeight: 1 }}>{r.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--butter)', border: '1px solid var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 12, color: 'var(--terracotta-deep)' }}>{m.by[0]}</span>
          <span style={{ fontFamily: 'Kalam', fontSize: 12.5, color: 'var(--ink-2)' }}>@{m.handle}</span>
          <span style={{ marginLeft: 'auto' }} className="mf-mono">{r.total}</span>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-3)' }}>
          <span>🍳 made <b style={{ color: 'var(--ink-2)' }}>{m.cooks}×</b></span>
          <span>·</span>
          <span><b style={{ color: 'var(--terracotta)' }}>{m.repeat}%</b> make it again</span>
          {m.forks > 0 && <><span>·</span><span>🌱 {m.forks}</span></>}
        </div>
      </div>
    </div>
  );
}

// ── the just-in-time sign-in card (used inline as a modal + as its own artboard)
function JITAuthCard({ action = 'save', recipe, onClose, embedded }) {
  const r = recipe || RECIPES[0];
  const verb = action === 'cook' ? 'cook' : action === 'plan' ? 'add to your plan' : 'save';
  const head = action === 'cook' ? 'Cook along, step by step.' : action === 'plan' ? 'Plan your whole week.' : 'Keep this in your box.';
  return (
    <div style={{ width: 400, background: 'var(--card)', borderRadius: 16, border: '1.5px solid var(--ink)', boxShadow: '0 20px 60px rgba(31,26,20,0.28)', overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 120 }} big />
        {!embedded && <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(31,26,20,0.5)', color: '#FFF6E0', cursor: 'pointer', fontSize: 14 }}>×</button>}
        <span style={{ position: 'absolute', bottom: 8, left: 12, color: '#FFF6E0', fontFamily: 'Caveat', fontWeight: 700, fontSize: 20, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{r.title}</span>
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>● TO {verb.toUpperCase()}, SIGN IN</div>
        <h3 className="mf-display" style={{ fontSize: 30, margin: '4px 0 0', lineHeight: 0.98 }}>{head}</h3>
        <p style={{ fontFamily: 'Kalam', fontSize: 13.5, color: 'var(--ink-2)', margin: '6px 0 14px', lineHeight: 1.4 }}>
          Browsing stays free, always. An account just gives you a place to keep recipes, track your kitchen, and plan meals.
        </p>
        <GoogleBtn wide />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }}></div>
          <span className="mf-mono" style={{ color: 'var(--ink-4)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }}></div>
        </div>
        <button className="mf-btn" style={{ width: '100%', justifyContent: 'center' }}>continue with email</button>
        {!embedded && <div style={{ textAlign: 'center', marginTop: 12 }}>
          <span onClick={onClose} className="mf-mono" style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>keep browsing →</span>
        </div>}
        <p style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: 'var(--ink-4)', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>
          no password · 10 seconds · we never post anything
        </p>
      </div>
    </div>
  );
}

// shared: dim overlay that hosts the JIT card
function JITOverlay({ gate, setGate }) {
  if (!gate) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(31,26,20,0.45)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setGate(null)}>
      <div onClick={(e) => e.stopPropagation()}>
        <JITAuthCard action={gate.action} recipe={gate.recipe} onClose={() => setGate(null)} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DIRECTION B — editorial / provenance-led. Leads with the story the product
// tells (every recipe has a lineage), then drops into the wall.
// ════════════════════════════════════════════════════════════════════════
function MidWelcomeEditorial() {
  const [gate, setGate] = React.useState(null);
  return (
    <div className="mf mf-page" style={{ position: 'relative' }}>
      <PublicNav active="browse" onSignIn={() => setGate({ action: 'save', recipe: RECIPES[0] })} />

      {/* hero */}
      <div style={{ padding: '44px 48px 30px', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 44, alignItems: 'center' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>WHAT 3,100 HOME COOKS ARE MAKING</div>
          <h1 className="mf-display" style={{ fontSize: 78, margin: '8px 0 0', lineHeight: 0.9 }}>
            Cook what people<br /><span style={{ color: 'var(--terracotta)' }}>actually cook again.</span>
          </h1>
          <p style={{ fontFamily: 'Kalam', fontSize: 17, color: 'var(--ink-2)', margin: '16px 0 0', maxWidth: 460, lineHeight: 1.5 }}>
            A living feed of real home cooks — see what other people made this week, what got cooked twice, what's trending right now. Honest counts of how often a recipe gets made, not star ratings. Browse it all free; sign in when you want to keep your own.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22, alignItems: 'center' }}>
            <GoogleBtn label="Sign up with Google" />
            <button className="mf-btn" onClick={() => { const el = document.querySelector('[data-welcome-wall]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>browse the feed — no account →</button>
          </div>
          <div style={{ marginTop: 16, fontFamily: 'JetBrains Mono', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.03em' }}>
            12,400 RECIPES · 3,100 HOME COOKS · 41,000 MEALS COOKED THIS MONTH
          </div>
        </div>

        {/* lineage showcase — the differentiator, made tangible */}
        <div className="mf-card" style={{ padding: 0, cursor: 'default', transform: 'rotate(-0.6deg)' }}>
          <div style={{ padding: '10px 16px', background: 'var(--paper-warm)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>LINEAGE · 1 RECIPE, 4 HANDS</span>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>live on every page</span>
          </div>
          <div style={{ padding: 20 }}>
            <FoodPhoto palette={RECIPES[0].palette} glyph={RECIPES[0].glyph} style={{ height: 140, borderRadius: 10 }} big />
            <div className="mf-display" style={{ fontSize: 28, marginTop: 12, lineHeight: 1 }}>Chicken & Chorizo Pasta Bake</div>
            {/* the chain */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                ['🌐', 'BBC Good Food', 'original source', 'var(--ink-3)'],
                ['👩', 'Mum', 'swapped in chorizo, more garlic', 'var(--terracotta)'],
                ['🧑\u200d🍳', 'Robbie · you', 'baked it, added mozzarella top', 'var(--ink)'],
                ['🌱', '8 forks downstream', 'halloumi · low-FODMAP · …', 'var(--sage)'],
              ].map(([ic, who, what, col], i, arr) => (
                <div key={who} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--paper-warm)', border: `1.5px solid ${col}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{ic}</span>
                    {i < arr.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 14, background: 'var(--line-strong)' }}></span>}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 10 : 0 }}>
                    <div style={{ fontFamily: 'Kalam', fontSize: 14, fontWeight: 700, color: col, lineHeight: 1.1 }}>{who}</div>
                    <div style={{ fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-3)' }}>{what}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* three honest value props (real differentiators, not filler) */}
      <div style={{ padding: '8px 48px 30px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {[
          ['📊', 'Honest signals', 'Real cook counts and repeat rates, not star ratings. See what people actually make twice.'],
          ['🏠', 'Cook together', 'Share a pantry, freezer and weekly plan with your household — everyone keeps their own diet.'],
          ['🧭', 'Provenance, kept', 'Every recipe remembers where it came from — the blog, the friend, the forks downstream.'],
        ].map(([ic, t, d]) => (
          <div key={t} className="mf-card" style={{ padding: '18px 20px', cursor: 'default' }}>
            <div style={{ fontSize: 26 }}>{ic}</div>
            <div className="mf-display" style={{ fontSize: 25, marginTop: 6 }}>{t}</div>
            <p style={{ fontFamily: 'Kalam', fontSize: 13.5, color: 'var(--ink-2)', margin: '4px 0 0', lineHeight: 1.45 }}>{d}</p>
          </div>
        ))}
      </div>

      {/* wall */}
      <div data-welcome-wall style={{ padding: '14px 48px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <h2 className="mf-display" style={{ fontSize: 40, margin: 0 }}>Trending this week</h2>
          <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>no account needed — tap ♡ on any card to save</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {RECIPES.slice(0, 6).map((r) => <PublicRecipeCard key={r.id} r={r} onGated={(rr, a) => setGate({ action: a, recipe: rr })} />)}
        </div>
      </div>

      <JITOverlay gate={gate} setGate={setGate} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MOBILE — public browse, with the JIT sheet as a half-sheet.
// ════════════════════════════════════════════════════════════════════════
function MobileWelcome() {
  const [gate, setGate] = React.useState(null);
  return (
    <Phone>
      {/* compact public header */}
      <div style={{ padding: '6px 18px 10px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="mf-logo" style={{ fontSize: 22 }}>Robbie's <em style={{ fontStyle: 'italic', color: 'var(--terracotta)' }}>recipes</em></div>
          <button className="mf-btn primary sm" onClick={() => setGate({ action: 'save', recipe: RECIPES[0] })}>sign up</button>
        </div>
        <div className="mf-search" style={{ padding: '6px 12px', marginTop: 8 }}>
          <span style={{ color: 'var(--ink-3)' }}>⌕</span>
          <input placeholder="search 12,400 recipes…" style={{ fontSize: 13 }} />
        </div>
        <div style={{ marginTop: 8, padding: '5px 9px', background: 'var(--butter-soft)', border: '1px solid var(--butter)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 15, height: 15, borderRadius: '50%', background: 'var(--sage)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>✓</span>
          <span>browse free · sign in only to <b>save</b> or <b>cook</b></span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="mf-display" style={{ fontSize: 22 }}>Trending</div>
          <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>this week</span>
        </div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8 }}>
          {['italian', 'mexican', 'quick', 'one-pot', 'veggie'].map((c, i) => <span key={c} className={'mf-tag' + (i === 0 ? ' include' : '')} style={{ fontSize: 11, flexShrink: 0 }}>{c}</span>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {RECIPES.slice(0, 6).map((r) => {
            const m = pubMeta(r.id);
            return (
              <div key={r.id} className="mf-card" onClick={() => setGate({ action: 'save', recipe: r })}>
                <div style={{ position: 'relative' }}>
                  <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 96 }} />
                  <span style={{ position: 'absolute', top: 5, left: 5, padding: '1px 6px', borderRadius: 999, background: 'rgba(31,26,20,0.6)', color: '#FFF6E0', fontFamily: 'JetBrains Mono', fontSize: 8 }}>🌐 {m.src}</span>
                </div>
                <div style={{ padding: '6px 8px 8px' }}>
                  <div className="mf-display" style={{ fontSize: 15, lineHeight: 1.05 }}>{r.title}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>🍳 made {m.cooks}× · {m.repeat}% again</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* JIT half-sheet */}
      {gate && (
        <React.Fragment>
          <div onClick={() => setGate(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(31,26,20,0.45)', zIndex: 6 }}></div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--paper)', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '12px 18px 22px', zIndex: 7, boxShadow: '0 -8px 24px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--ink-4)', margin: '0 auto 12px' }}></div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <FoodPhoto palette={gate.recipe.palette} glyph={gate.recipe.glyph} style={{ width: 52, height: 52, borderRadius: 10 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>TO SAVE, SIGN IN</div>
                <div className="mf-display" style={{ fontSize: 19, lineHeight: 1 }}>Keep this in your box.</div>
              </div>
            </div>
            <p style={{ fontFamily: 'Kalam', fontSize: 12.5, color: 'var(--ink-2)', margin: '10px 0 12px', lineHeight: 1.4 }}>
              Browsing stays free. An account just keeps your recipes, kitchen & plans in one place.
            </p>
            <GoogleBtn wide />
            <button className="mf-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>continue with email</button>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <span onClick={() => setGate(null)} className="mf-mono" style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>keep browsing →</span>
            </div>
          </div>
        </React.Fragment>
      )}
    </Phone>
  );
}

window.GoogleG = GoogleG;
window.GoogleBtn = GoogleBtn;
window.PublicNav = PublicNav;
window.PublicRecipeCard = PublicRecipeCard;
window.JITAuthCard = JITAuthCard;
window.JITOverlay = JITOverlay;
window.MidWelcomeEditorial = MidWelcomeEditorial;
window.MobileWelcome = MobileWelcome;
