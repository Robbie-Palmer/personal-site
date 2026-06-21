// mid-fi/recipe.jsx — recipe page A (read view) + B (cooking mode), with toggle.

function MidRecipeRead({ onCook, owned = true }) {
  const r = RECIPES[0];
  return (
    <div className="mf mf-page">
      <Nav active="recipes" />

      <div style={{ padding: '20px 48px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-3)' }}>
          {owned ? '← Recipe box · Italian · ' + r.title : '← Browsing public recipes · by @robbie'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {owned ? (
            <React.Fragment>
              <button className="mf-btn ghost sm">♡ favourite</button>
              <button className="mf-btn ghost sm">🌱 fork</button>
              <button className="mf-btn ghost sm">↗ suggest a fix</button>
              <button className="mf-btn ghost sm">📤 share</button>
              <button className="mf-btn ghost sm">✎ edit</button>
              <button className="mf-btn terra" onClick={onCook}>🔥 start cooking →</button>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <button className="mf-btn ghost sm">↗ suggest a fix</button>
              <button className="mf-btn ghost sm">📤 share</button>
              <button className="mf-btn">🌱 fork into my box</button>
              <button className="mf-btn primary">＋ add to my recipes</button>
              <button className="mf-btn terra" onClick={onCook}>🔥 cook from this →</button>
            </React.Fragment>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 48px 32px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 36 }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SUNDAY-NIGHT STAPLE · v1.2 BY ROBBIE</div>
          <h1 className="mf-display" style={{ fontSize: 72, margin: '6px 0 0', lineHeight: 0.92 }}>
            Chicken & Chorizo<br />
            <span style={{ color: 'var(--terracotta)' }}>Pasta Bake.</span>
          </h1>

          {/* lineage chip — text-only, no component deps */}
          <div style={{ marginTop: 10, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)' }}>
            <span style={{ color: 'var(--ink-3)' }}>lineage · </span>
            <b>Robbie v1.2</b>
            <span style={{ color: 'var(--ink-3)' }}> ← </span>
            Mum v1.1
            <span style={{ color: 'var(--ink-3)' }}> ← </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px 1px 4px', borderRadius: 999, background: 'var(--paper-warm)', border: '1px solid var(--line-strong)', fontSize: 12 }}>🌐 BBC Good Food</span>
            <span style={{ marginLeft: 8, color: 'var(--terracotta)', cursor: 'pointer' }}>see tree →</span>
          </div>

          <p className="mf-body" style={{ fontSize: 17, color: 'var(--ink-2)', marginTop: 14, maxWidth: 480 }}>
            Creamy with a smoky edge from the chorizo. A one-pan starter, then the oven does the rest. Mum's, learned 2019, written down today.
          </p>

          {/* social proof — full grid when browsing, compact one-liner when owned */}
          {owned ? (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(143,166,119,0.08)', border: '1px solid var(--line)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'Kalam', fontSize: 13, flexWrap: 'wrap' }}>
              <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>SIGNAL</span>
              <span><b>341</b> cooks</span>
              <span style={{ color: 'var(--ink-3)' }}>·</span>
              <span><b style={{ color: 'var(--terracotta)' }}>62%</b> repeat</span>
              <span style={{ color: 'var(--ink-3)' }}>·</span>
              <span style={{ color: 'var(--sage)' }}><b>+24</b> this week 📈</span>
              <span style={{ color: 'var(--ink-3)' }}>·</span>
              <span><b>8</b> forks · <b>65m</b> real</span>
              <span style={{ marginLeft: 'auto' }} className="mf-mono">show more ▾</span>
            </div>
          ) : (
            <div className="mf-card" style={{ marginTop: 16, padding: '10px 14px', borderLeft: '3px solid var(--sage)', background: 'rgba(143,166,119,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>HONEST SIGNAL · NO STARS</span>
                <span className="mf-mono" style={{ color: 'var(--ink-3)' }} title="we don't ask people to rate recipes. We tell you what people actually did with them.">why no stars? ⓘ</span>
              </div>
              <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  ['341', 'times cooked',   'across 7 tree versions',   'var(--ink)'],
                  ['62%', 'cooked again',   'repeat rate · 30d',        'var(--terracotta)'],
                  ['+24', 'this week',      'top 5% momentum',          'var(--sage)'],
                  ['8',   'forks downstream','active branches',         'var(--ink)'],
                  ['89',  'unique cooks',   'lifetime',                 'var(--ink)'],
                  ['65m', 'real cook time', 'vs 55m stated · median',   'var(--ink)'],
                  ['×34', 'frozen',         'leftover-friendly',        'var(--ink)'],
                  ['47',  'on plans',       'being shopped now',        'var(--terracotta-deep)'],
                ].map(([n, l, sub, tone]) => (
                  <div key={l} title={sub} style={{ padding: '6px 8px', background: 'var(--card)', borderRadius: 6, border: '1px solid var(--line)' }}>
                    <div className="mf-display" style={{ fontSize: 20, color: tone, lineHeight: 1 }}>{n}</div>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 1 }}>{l}</div>
                    <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 8, marginTop: 1, fontStyle: 'italic' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mf-tag include">italian</span>
            <span className="mf-tag soft" title="prep time"><span style={{ color: 'var(--ink-3)' }}>prep</span> &nbsp;15m</span>
            <span className="mf-tag soft" title="cook time"><span style={{ color: 'var(--ink-3)' }}>cook</span> &nbsp;40m</span>
            <span className="mf-tag" style={{ background: 'var(--paper-warm)', borderColor: 'var(--ink)' }} title="total time"><span style={{ color: 'var(--ink-3)' }}>total</span> &nbsp;<b style={{ color: 'var(--terracotta)' }}>55m</b></span>
          </div>

          <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--card)', border: '1px solid var(--line-strong)', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-2)' }}>serves</span>
            <button className="mf-btn sm" style={{ padding: '0 10px' }}>−</button>
            <span className="mf-display" style={{ fontSize: 32, color: 'var(--terracotta)' }}>4</span>
            <button className="mf-btn sm" style={{ padding: '0 10px' }}>＋</button>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>quantities scale automatically</span>
          </div>

          {/* SEO credit · outbound link */}
          <div style={{ marginTop: 16, padding: '8px 12px', background: 'var(--paper-warm)', border: '1px dashed var(--line-strong)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Kalam', fontSize: 12, maxWidth: 540 }}>
            <span style={{ fontSize: 16 }}>🌐</span>
            <span style={{ flex: 1, color: 'var(--ink-2)' }}>
              originally <b>BBC Good Food</b> · <a href="#" style={{ color: 'var(--terracotta-deep)', textDecoration: 'underline' }}>read the source recipe ↗</a>
            </span>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>1.2k clicks sent · this month</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'stretch' }}>
          <FoodPhoto palette={r.palette} glyph={r.glyph} big style={{ flex: 1, minHeight: 320, borderRadius: 16 }} />
          <div className="mf-card" style={{ padding: 12 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>FORKS DOWNSTREAM · WHAT PEOPLE CHANGED</div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { who: 'Ellie',  name: 'Halloumi Pasta Bake',     v: '2.0',   when: 'May',  cooks: 8,  diff: 'chicken → halloumi · veggie' },
                { who: 'Jamie',  name: 'Low-FODMAP Pasta Bake',   v: '1.2.1', when: 'Aug',  cooks: 4,  diff: 'garlic → garlic-infused oil' },
                { who: '@sarah', name: 'Halloumi · w/ courgette', v: '2.1',   when: 'Oct',  cooks: 3,  diff: '+courgette · public fork' },
              ].map((f, i) => (
                <div key={i} style={{ padding: '4px 0', borderBottom: i < 2 ? '1px dashed var(--line)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--terracotta)', flexShrink: 0 }}></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Kalam', fontSize: 12.5, lineHeight: 1.15 }}><b>{f.name}</b> <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>v{f.v}</span></div>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>by {f.who} · {f.when} · 🍴 {f.cooks} · <i style={{ color: 'var(--terracotta-deep)' }}>{f.diff}</i></div>
                  </div>
                  <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 10, cursor: 'pointer' }}>open ↗</span>
                </div>
              ))}
            </div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 6, cursor: 'pointer' }}>see the full lineage tree →</div>
          </div>

          <div className="mf-card" style={{ padding: 12 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>RECENTLY COOKED</div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                ['Ellie',  '2h ago · fresh for 3'],
                ['Jamie',  'yesterday · their fork · low-FODMAP'],
                ['@sarah', '2d ago · cooked from their fork · fed 5'],
                ['Robbie', '5d ago · v1.2 · froze 2 portions'],
              ].map(([who, what], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontFamily: 'Kalam', fontSize: 12 }}>
                  <b style={{ minWidth: 56 }}>{who}</b>
                  <span style={{ color: 'var(--ink-3)' }}>·</span>
                  <span style={{ flex: 1, color: 'var(--ink-2)' }}>{what}</span>
                </div>
              ))}
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: 9, fontStyle: 'italic' }}>pulled from the activity feed · no separate comments to maintain</div>
          </div>
        </div>
      </div>

      <hr className="mf-rule" style={{ margin: '0 48px' }} />

      <div style={{ padding: '32px 48px 80px', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 48 }}>
        <div>
          <h2 className="mf-display" style={{ fontSize: 36, color: 'var(--terracotta)', margin: 0 }}>Ingredients</h2>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 4 }}>11 items · for 4 servings</div>

          {/* Pantry-match banner */}
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(143,166,119,0.10)', border: '1px dashed var(--sage)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Kalam', fontSize: 13 }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--sage)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11 }}>🧂</span>
            <span style={{ flex: 1 }}>
              <b>8 of 11</b> already in your pantry · need: <b style={{ color: 'var(--terracotta-deep)' }}>chorizo, mozzarella, basil</b>
            </span>
            <span className="mf-mono" style={{ color: 'var(--terracotta)', cursor: 'pointer' }}>add to list ＋</span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0' }}>
            {INGREDIENTS.map((ing, i) => {
              // Mock: ingredients at indexes 2, 7-8, 9 are missing (chorizo, oregano-no wait — chorizo, basil-ish, mozzarella)
              // map specific items based on text match
              const missing = /chorizo|mozzarella|basil/i.test(ing);
              return (
                <li key={i} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Kalam', fontSize: 15 }}>
                  <span className="mf-check"></span>
                  <span style={{ flex: 1 }}>{ing}</span>
                  {missing ? (
                    <span className="mf-tag" style={{ fontSize: 10, color: 'var(--terracotta-deep)', borderColor: 'var(--terracotta-deep)' }}>need to buy</span>
                  ) : (
                    <span className="mf-mono" style={{ fontSize: 10, color: 'var(--sage)' }}>✓ in stock</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 14 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>EQUIPMENT</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {['oven', 'big saucepan', 'frying pan', 'casserole dish'].map((e) => <span key={e} className="mf-tag soft">{e}</span>)}
            </div>
          </div>
        </div>
        <div>
          <h2 className="mf-display" style={{ fontSize: 36, color: 'var(--terracotta)', margin: 0 }}>Method</h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', counterReset: 'step' }}>
            {STEPS.map((s, i) =>
            <li key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px dashed var(--line)' }}>
                <span className="mf-display" style={{ fontSize: 30, color: 'var(--terracotta)', minWidth: 32, lineHeight: 1 }}>{i + 1}.</span>
                <div style={{ flex: 1 }}>
                  <div className="mf-body" style={{ fontSize: 16, color: 'var(--ink)' }}>{s.text}</div>
                  {s.timer && <span className="mf-tag" style={{ marginTop: 6, background: 'var(--butter-soft)', borderColor: 'var(--ink)', fontSize: 12 }}>⏱ {s.timer} min</span>}
                </div>
              </li>
            )}
          </ol>
          <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--butter-soft)', borderRadius: 12, fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-2)' }}>
            <span className="mf-display" style={{ fontSize: 22, color: 'var(--terracotta-deep)' }}>tip —</span>
            <span> smush a few cherry tomatoes with the back of the spoon for a richer sauce. Swap mozzarella for cheddar in a pinch.</span>
          </div>
        </div>
      </div>
    </div>);

}

function Stat({ label, v, emphasis }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
      <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span className="mf-display" style={{ fontSize: emphasis ? 28 : 22, color: emphasis ? 'var(--terracotta)' : 'var(--ink)', marginTop: 2 }}>{v}</span>
    </span>);

}

// Cooking mode B
function MidRecipeCook({ onExit }) {
  const [step, setStep] = React.useState(4); // 0-indexed
  const [running, setRunning] = React.useState(true);
  const [secs, setSecs] = React.useState(9 * 60 + 42);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0'),ss = String(secs % 60).padStart(2, '0');
  const cur = STEPS[step];
  const r = RECIPES[0];

  return (
    <div className="mf mf-page" style={{ background: 'var(--paper-warm)', display: 'flex', flexDirection: 'column' }}>
      {/* slim cooking-mode chrome */}
      <div style={{ padding: '14px 32px', borderBottom: '1px solid var(--line-strong)', background: 'var(--butter-soft)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 18 }}>
        <button className="mf-btn ghost sm" onClick={onExit}>← exit</button>
        <span className="mf-display" style={{ fontSize: 24, color: 'var(--terracotta-deep)' }}>{r.title}</span>
        <span className="mf-tag" style={{ background: 'var(--terracotta)', borderColor: 'var(--terracotta-deep)', color: '#fff', fontSize: 11 }}>cooking mode</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', fontFamily: 'Kalam', fontSize: 14 }}>
          <span title="screen stays on while cooking" style={{ color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>👁 awake</span>
          <button className="mf-btn ghost sm" title="Stream this recipe to a Chromecast / AirPlay / smart TV on your network">📺 cast</button>
          <span style={{ color: 'var(--ink-2)' }}>serves 4</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '0.8fr 1.4fr', minHeight: 0 }}>
        {/* ingredients reference */}
        <aside style={{ padding: '24px 28px', borderRight: '1px solid var(--line-strong)', background: 'var(--paper)', overflow: 'auto' }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>INGREDIENTS · REFERENCE</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
            {INGREDIENTS.map((ing, i) => {
              const inThisStep = step === 4 && i >= 3 && i <= 7;
              return (
                <li key={i} style={{
                  padding: '6px 10px', borderRadius: 6, marginBottom: 2,
                  background: inThisStep ? 'var(--butter-soft)' : 'transparent',
                  fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink)',
                  display: 'flex', gap: 8, alignItems: 'center'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: inThisStep ? 'var(--terracotta)' : 'var(--ink-4)' }}></span>
                  {ing}
                </li>);

            })}
          </ul>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 10 }}>highlighted = used in this step</div>
        </aside>

        {/* the step */}
        <main style={{ padding: '40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>STEP {String(step + 1).padStart(2, '0')} OF {STEPS.length}</div>
            <h1 className="mf-display" style={{ fontSize: 56, margin: '8px 0 0', lineHeight: 1, color: 'var(--ink)' }}>
              {cur.text}
            </h1>

            {cur.timer &&
            <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ width: 130, height: 130, borderRadius: '50%', background: running ? 'var(--butter)' : 'var(--card)', border: '3px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <span className="mf-display" style={{ fontSize: 42, color: 'var(--ink)' }}>{m}:{ss}</span>
                </div>
                <div>
                  <div style={{ fontFamily: 'Kalam', fontSize: 16, color: 'var(--ink-2)' }}>simmer the sauce</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>started 18s ago · {running ? 'running' : 'paused'}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="mf-btn sm" onClick={() => setRunning((r) => !r)}>{running ? 'pause' : 'resume'}</button>
                    <button className="mf-btn sm" onClick={() => setSecs((s) => s + 60)}>+1 min</button>
                    <button className="mf-btn sm" onClick={() => setSecs(cur.timer * 60)}>reset</button>
                  </div>
                </div>
              </div>
            }
          </div>

          {/* nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 24, borderTop: '1px dashed var(--line-strong)' }}>
            <button className="mf-btn" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>← prev</button>
            <div style={{ flex: 1, display: 'flex', gap: 6 }}>
              {STEPS.map((_, i) =>
              <div key={i} onClick={() => setStep(i)} style={{ flex: 1, height: i === step ? 8 : 4, borderRadius: 3, background: i < step ? 'var(--terracotta)' : i === step ? 'var(--butter)' : 'var(--ink-4)', cursor: 'pointer' }}></div>
              )}
            </div>
            <button className="mf-btn primary" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>next →</button>
          </div>

          {/* multi-timer dock — draggable */}
          <DraggableDock data-comment-anchor="349b9483f9-div-187-11">
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 11, color: 'var(--butter)' }}>● simmer</span>
              <span className="mf-display" style={{ fontSize: 20 }}>{m}:{ss}</span>
            </span>
            <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.2)' }}></span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 11, color: 'var(--terracotta)' }}>● bake</span>
              <span className="mf-display" style={{ fontSize: 20 }}>17:08</span>
            </span>
            <span className="mf-mono" style={{ color: 'var(--ink-4)', cursor: 'pointer' }}>＋ add</span>
          </DraggableDock>
        </main>
      </div>
    </div>);

}

function DraggableDock({ children, ...rest }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ x: 24, y: 24 });
  const drag = React.useRef(null);
  const onDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
    e.preventDefault();
  };
  React.useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return;
      setPos({ x: Math.max(0, drag.current.x + (drag.current.sx - e.clientX)), y: Math.max(0, drag.current.y + (drag.current.sy - e.clientY)) });
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);
  return (
    <div ref={ref} className="mf-dock" {...rest}
      onMouseDown={onDown}
      style={{ right: pos.x, bottom: pos.y, cursor: 'grab', userSelect: 'none' }}
      title="drag to move">
      <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 10, marginRight: 4 }}>⋮⋮</span>
      {children}
    </div>
  );
}

function MidRecipeWithToggle() {
  const [cooking, setCooking] = React.useState(false);
  const [afterCook, setAfterCook] = React.useState(false);
  const onExit = () => { setCooking(false); setAfterCook(true); };
  return (
    <React.Fragment>
      {cooking ? <MidRecipeCook onExit={onExit} /> : <MidRecipeRead onCook={() => setCooking(true)} />}
      {afterCook && <AfterCookSheet onClose={() => setAfterCook(false)} />}
    </React.Fragment>
  );
}

window.MidRecipeRead = MidRecipeRead;
window.MidRecipeCook = MidRecipeCook;
window.MidRecipeWithToggle = MidRecipeWithToggle;

// "browsing someone else's recipe" — same component, owned=false
function MidRecipeBrowsing() {
  return <MidRecipeRead owned={false} />;
}
window.MidRecipeBrowsing = MidRecipeBrowsing;