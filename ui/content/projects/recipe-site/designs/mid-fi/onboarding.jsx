// mid-fi/onboarding.jsx — first-run onboarding whose JOB is to populate content,
// so a brand-new account never opens onto an empty box.
// Flow: Google sign-in → your diet (skippable) → FILL YOUR BOX (4 levers) → first-run home.

const STARTER_BOOKS = [
  ['Weeknight dinners', '30-min, low-effort', 7, ['#C8693C', '#7E2D1F'], 'pasta'],
  ['Batch-cook & freeze', 'cook once, eat thrice', 6, ['#9DAE7A', '#506B3F'], 'pot'],
  ['5-ingredient', 'minimal shopping', 5, ['#E2A040', '#8B4A1E'], 'bowl'],
  ['Slow cooker', 'set it and forget it', 7, ['#B5462E', '#5C1A0F'], 'pot'],
];

const ONB_STEPS = ['sign in', 'your diet', 'fill your box', 'ready'];

function StepRail({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {ONB_STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              border: '1.5px solid ' + (i <= step ? 'var(--ink)' : 'var(--line-strong)'),
              background: i < step ? 'var(--ink)' : i === step ? 'var(--butter)' : 'transparent',
              color: i < step ? 'var(--butter)' : 'var(--ink)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700,
            }}>{i < step ? '✓' : i + 1}</span>
            <span style={{ fontFamily: 'Kalam', fontSize: 13, color: i === step ? 'var(--ink)' : 'var(--ink-3)', fontWeight: i === step ? 700 : 400 }}>{label}</span>
          </div>
          {i < ONB_STEPS.length - 1 && <span style={{ width: 24, height: 1.5, background: i < step ? 'var(--ink)' : 'var(--line)' }}></span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── the live "your box" tray — visible from the seed step on; the whole point ──
function BoxTray({ count, chips }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: count ? 'rgba(143,166,119,0.12)' : 'var(--paper-warm)', border: '1px dashed ' + (count ? 'var(--sage)' : 'var(--line-strong)'), borderRadius: 12 }}>
      <span style={{ fontSize: 20 }}>📖</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mf-mono" style={{ color: count ? 'var(--sage)' : 'var(--ink-3)' }}>YOUR BOX · {count} {count === 1 ? 'RECIPE' : 'RECIPES'}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
          {count === 0 && <span style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)' }}>add a few and it starts filling up…</span>}
          {chips.slice(0, 5).map((c, i) => <span key={i} className="mf-tag include" style={{ fontSize: 11 }}>{c}</span>)}
          {count > 5 && <span className="mf-tag" style={{ fontSize: 11 }}>+{count - 5} more</span>}
        </div>
      </div>
      {count >= 3 && <span className="mf-display" style={{ fontSize: 20, color: 'var(--sage)' }}>looking good! ✨</span>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// THE INTERACTIVE FLOW (desktop). Click through it on the artboard.
// ════════════════════════════════════════════════════════════════════════
function MidOnboarding() {
  const [step, setStep] = React.useState(0);
  const [diet, setDiet] = React.useState({ vegetarian: true });
  const [picked, setPicked] = React.useState({}); // recipe id -> true
  const [seedTab, setSeedTab] = React.useState('starters');
  const [bookAdds, setBookAdds] = React.useState({}); // book index -> count

  const toggleDiet = (k) => setDiet((d) => ({ ...d, [k]: !d[k] }));
  const togglePick = (id) => setPicked((p) => ({ ...p, [id]: !p[id] }));
  const addBook = (i, n) => setBookAdds((b) => ({ ...b, [i]: b[i] ? 0 : n }));

  const pickedIds = Object.keys(picked).filter((k) => picked[k]);
  const bookCount = Object.values(bookAdds).reduce((a, b) => a + b, 0);
  const boxCount = pickedIds.length + bookCount;
  const chips = [
    ...pickedIds.map((id) => (RECIPES.find((r) => r.id === id) || {}).title).filter(Boolean),
    ...Object.entries(bookAdds).filter(([, n]) => n).map(([i, n]) => `${STARTER_BOOKS[i][0]} (${n})`),
  ];

  return (
    <div className="mf mf-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* top bar: logo + rail */}
      <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 28, flexShrink: 0 }}>
        <div className="mf-logo">Robbie's <em style={{ fontStyle: 'italic', color: 'var(--terracotta)' }}>recipes</em></div>
        <div style={{ marginLeft: 'auto' }}><StepRail step={step} /></div>
      </div>

      {/* content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 32px' }}>
        {step === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxWidth: 460, textAlign: 'center' }}>
              <div style={{ fontSize: 44 }}>🍳</div>
              <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 8 }}>WELCOME — LET'S SET UP YOUR BOX</div>
              <h1 className="mf-display" style={{ fontSize: 56, margin: '6px 0 0', lineHeight: 0.92 }}>
                Two minutes to a box that <span style={{ color: 'var(--terracotta)' }}>feels lived-in.</span>
              </h1>
              <p style={{ fontFamily: 'Kalam', fontSize: 15.5, color: 'var(--ink-2)', margin: '12px 0 22px', lineHeight: 1.45 }}>
                We'll set your diet and seed a handful of recipes, so you land on a kitchen that already has something cooking — not a blank page.
              </p>
              <GoogleBtn wide label="Continue with Google" onClick={() => setStep(1)} />
              <button className="mf-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => setStep(1)}>continue with email</button>
              <p style={{ fontFamily: 'JetBrains Mono', fontSize: 9.5, color: 'var(--ink-4)', marginTop: 14 }}>no password · your box stays yours · cancel anytime</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 24 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>STEP 2 · SET ONCE, FILTERS EVERYWHERE</div>
            <h1 className="mf-display" style={{ fontSize: 46, margin: '4px 0 0', lineHeight: 0.95 }}>Anything you don't eat?</h1>
            <p style={{ fontFamily: 'Kalam', fontSize: 14.5, color: 'var(--ink-2)', margin: '6px 0 0', maxWidth: 620 }}>
              This quietly filters every list, search and plan from here on. You can change it any time — skip it if you'd rather.
            </p>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {DIET_PRESETS.map(([k, e, desc]) => {
                const on = diet[k];
                return (
                  <div key={k} onClick={() => toggleDiet(k)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid ' + (on ? 'var(--terracotta)' : 'var(--line)'), background: on ? 'var(--butter-soft)' : 'var(--card)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 20 }}>{e}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Kalam', fontSize: 14, fontWeight: 700 }}>{k}</div>
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{desc}</div>
                    </div>
                    <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--ink)', background: on ? 'var(--ink)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--butter)', fontSize: 10 }}>{on && '✓'}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mf-mono" style={{ color: 'var(--terracotta-deep)' }}>ALWAYS AVOID</span>
              <span className="mf-tag" style={{ color: 'var(--terracotta-deep)', borderColor: 'var(--terracotta-deep)' }}>⊘ egg ×</span>
              <span className="mf-tag" style={{ color: 'var(--terracotta-deep)', borderColor: 'var(--terracotta-deep)' }}>⊘ shellfish ×</span>
              <span className="mf-tag" style={{ borderStyle: 'dashed' }}>＋ add an allergy</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 20 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>STEP 3 · THE WHOLE POINT</div>
            <h1 className="mf-display" style={{ fontSize: 44, margin: '4px 0 0', lineHeight: 0.95 }}>Let's put a few recipes in.</h1>
            <p style={{ fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-2)', margin: '4px 0 0' }}>Bring your own or grab some of ours — pick any mix. Add at least three and your kitchen comes alive.</p>

            {/* lever tabs */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              {[['starters', '✨ pick starters'], ['url', '🔗 paste a link'], ['scan', '📷 scan a photo'], ['books', '📚 starter cookbooks']].map(([k, l]) => (
                <span key={k} onClick={() => setSeedTab(k)} className={'mf-tag ' + (seedTab === k ? 'include' : '')} style={{ cursor: 'pointer', fontSize: 13 }}>{l}</span>
              ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', marginTop: 12, paddingRight: 4 }}>
              {seedTab === 'starters' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {RECIPES.map((r) => {
                    const on = picked[r.id];
                    return (
                      <div key={r.id} onClick={() => togglePick(r.id)} className="mf-card" style={{ display: 'flex', gap: 10, padding: 8, alignItems: 'center', outline: on ? '2px solid var(--terracotta)' : 'none', cursor: 'pointer' }}>
                        <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 52, height: 52, borderRadius: 8 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mf-display" style={{ fontSize: 17, lineHeight: 1 }}>{r.title}</div>
                          <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>{r.cuisine.toLowerCase()} · {r.total}</div>
                        </div>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--ink)', background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--butter)' : 'var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{on ? '✓' : '＋'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {seedTab === 'url' && (
                <div style={{ maxWidth: 620 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input defaultValue="https://bbcgoodfood.com/recipes/chicken-chorizo-pasta-bake" style={{ flex: 1, padding: '11px 12px', border: '1.5px solid var(--line-strong)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                    <button className="mf-btn primary">fetch →</button>
                  </div>
                  <div style={{ marginTop: 14, padding: 16, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper-warm)', display: 'flex', gap: 14, alignItems: 'center' }}>
                    <FoodPhoto palette={RECIPES[0].palette} glyph={RECIPES[0].glyph} style={{ width: 70, height: 70, borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div className="mf-mono" style={{ color: 'var(--sage)' }}>● FOUND · BBCGOODFOOD.COM · credit kept</div>
                      <div className="mf-display" style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>{RECIPES[0].title}</div>
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 3 }}>11 ingredients · 7 steps · 55m</div>
                    </div>
                    <button onClick={() => togglePick(RECIPES[0].id)} className={'mf-btn ' + (picked[RECIPES[0].id] ? 'butter' : 'primary')}>{picked[RECIPES[0].id] ? '✓ added' : '＋ add to box'}</button>
                  </div>
                  <p style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)', marginTop: 12 }}>paste any blog or recipe link — we keep the original source and credit. Messy sites fall back to a photo scan.</p>
                </div>
              )}
              {seedTab === 'scan' && (
                <div style={{ maxWidth: 620 }}>
                  <div style={{ height: 240, border: '2px dashed var(--line-strong)', borderRadius: 12, background: 'var(--paper-warm)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <div style={{ fontSize: 44 }}>📷</div>
                    <div className="mf-display" style={{ fontSize: 24 }}>drop a cookbook page or screenshot</div>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>JPG · PNG · HEIC · multi-page OK</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button className="mf-btn primary sm">choose file</button>
                      <button onClick={() => togglePick(RECIPES[1].id)} className="mf-btn sm">📱 use camera</button>
                    </div>
                  </div>
                  <p style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)', marginTop: 12 }}>handwritten cards, granny's book, an Instagram screenshot — we read them all into a real, editable recipe.</p>
                </div>
              )}
              {seedTab === 'books' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  {STARTER_BOOKS.map(([n, sub, count, palette, glyph], i) => {
                    const added = bookAdds[i];
                    return (
                      <div key={n} className="mf-card" style={{ padding: 0, display: 'flex', cursor: 'default', outline: added ? '2px solid var(--terracotta)' : 'none' }}>
                        <div style={{ width: 92, flexShrink: 0, position: 'relative', background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` }}>
                          <FoodGlyph kind={glyph} size={70} />
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 6, background: 'rgba(0,0,0,0.18)' }}></div>
                        </div>
                        <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
                          <div className="mf-display" style={{ fontSize: 22, lineHeight: 1 }}>{n}</div>
                          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2 }}>{count} recipes · {sub}</div>
                          <button onClick={() => addBook(i, count)} className={'mf-btn sm ' + (added ? 'butter' : 'primary')} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>{added ? `✓ added ${count}` : `＋ add all ${count}`}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxWidth: 540, textAlign: 'center' }}>
              <div style={{ fontSize: 46 }}>🎉</div>
              <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 8 }}>YOU'RE ALL SET</div>
              <h1 className="mf-display" style={{ fontSize: 54, margin: '6px 0 0', lineHeight: 0.92 }}>
                Your box has <span style={{ color: 'var(--terracotta)' }}>{boxCount || 5} recipes</span> already.
              </h1>
              <p style={{ fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-2)', margin: '12px 0 18px', lineHeight: 1.45 }}>
                No empty page waiting for you. We've left a few gentle prompts on your home — stock your kitchen, plan a week, invite your household — for whenever you fancy them.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div className="mf-tag include">✓ diet set</div>
                <div className="mf-tag include">✓ {boxCount || 5} recipes in</div>
                <div className="mf-tag soft">kitchen · later</div>
                <div className="mf-tag soft">household · later</div>
              </div>
              <button className="mf-btn terra" style={{ marginTop: 22, padding: '12px 24px', fontSize: 16 }}>take me to my kitchen →</button>
            </div>
          </div>
        )}
      </div>

      {/* footer: tray + nav */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--card)' }}>
        {step >= 2 && <div style={{ flex: 1, maxWidth: 540 }}><BoxTray count={boxCount} chips={chips} /></div>}
        {step < 2 && <div style={{ flex: 1, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)' }}>{step === 0 ? 'step 1 of 4' : 'takes about 90 seconds'}</div>}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {step > 0 && step < 3 && <button className="mf-btn ghost" onClick={() => setStep((s) => s - 1)}>← back</button>}
          {(step === 1 || step === 2) && <button className="mf-btn" onClick={() => setStep((s) => s + 1)}>skip</button>}
          {step === 1 && <button className="mf-btn primary" onClick={() => setStep(2)}>continue →</button>}
          {step === 2 && <button className="mf-btn terra" onClick={() => setStep(3)} disabled={boxCount === 0} style={{ opacity: boxCount === 0 ? 0.5 : 1 }}>{boxCount >= 3 ? 'looks great — finish →' : boxCount > 0 ? `add ${3 - boxCount} more or finish →` : 'add a few to continue'}</button>}
          {step === 3 && <button className="mf-btn ghost" onClick={() => setStep(0)}>↻ replay flow</button>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// THE PAYOFF — first-run home. NOT empty: seeded recipes + dismissible prompts.
// ════════════════════════════════════════════════════════════════════════
function FirstRunHome() {
  const prompts = [
    { ic: '🧂', t: 'Stock your kitchen', d: 'Tick what you have — we\'ll show what you can cook now.', cta: 'open pantry', tone: 'butter', done: false },
    { ic: '📅', t: 'Plan your first week', d: 'Drop a few of your new recipes onto days.', cta: 'plan week', tone: 'terra', done: false },
    { ic: '🏠', t: 'Invite your household', d: 'Share a pantry, plan & shopping list.', cta: 'invite', tone: 'sage', done: false },
    { ic: '🥗', t: 'Diet set', d: 'Vegetarian · no egg, shellfish.', cta: 'edit', tone: 'done', done: true },
  ];
  const seeded = RECIPES.slice(0, 6);
  return (
    <div className="mf mf-page">
      <Nav active="recipes" />
      <div style={{ padding: '32px 48px 16px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>DAY ONE · WELCOME IN</div>
        <h1 className="mf-display" style={{ fontSize: 70, margin: '6px 0 0', lineHeight: 0.92 }}>
          what's cooking, <span style={{ color: 'var(--terracotta)' }}>Robbie?</span>
        </h1>
        <div style={{ marginTop: 8, fontFamily: 'Kalam', fontSize: 16, color: 'var(--ink-2)' }}>6 recipes in your box · diet set · <span style={{ color: 'var(--ink-3)' }}>let's get the rest going</span></div>
      </div>

      {/* setup prompts — sticky-note cards, dismiss as you go */}
      <div style={{ padding: '6px 48px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>FINISH SETTING UP · 1 OF 4 DONE</span>
          <span className="mf-mono" style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>dismiss all ×</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {prompts.map((p, i) => {
            const bg = { butter: 'var(--butter-soft)', terra: 'rgba(200,105,60,0.10)', sage: 'rgba(143,166,119,0.14)', done: 'var(--paper-warm)' }[p.tone];
            const bd = { butter: 'var(--butter)', terra: 'var(--terracotta)', sage: 'var(--sage)', done: 'var(--line-strong)' }[p.tone];
            return (
              <div key={p.t} style={{ position: 'relative', padding: '14px 16px', borderRadius: 12, background: bg, border: `1.5px solid ${bd}`, transform: `rotate(${i % 2 ? -0.6 : 0.5}deg)`, opacity: p.done ? 0.72 : 1 }}>
                {!p.done && <span style={{ position: 'absolute', top: 8, right: 10, color: 'var(--ink-3)', cursor: 'pointer', fontSize: 14 }}>×</span>}
                <div style={{ fontSize: 24 }}>{p.ic}</div>
                <div className="mf-display" style={{ fontSize: 22, marginTop: 4, lineHeight: 1 }}>{p.t} {p.done && <span style={{ color: 'var(--sage)' }}>✓</span>}</div>
                <p style={{ fontFamily: 'Kalam', fontSize: 12.5, color: 'var(--ink-2)', margin: '4px 0 10px', lineHeight: 1.35 }}>{p.d}</p>
                <button className={'mf-btn sm ' + (p.done ? 'ghost' : 'primary')}>{p.cta} {!p.done && '→'}</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* the seeded recipes — the box is already full */}
      <div style={{ padding: '20px 48px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h2 className="mf-display" style={{ fontSize: 34, margin: 0 }}>The 6 you just added</h2>
          <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>fresh in your box — cook, plan, or fork any of them</span>
          <span className="mf-mono" style={{ marginLeft: 'auto', color: 'var(--terracotta)', cursor: 'pointer' }}>＋ add more</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {seeded.map((r) => (
            <div key={r.id} className="mf-card" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 168 }} />
              <span style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 999, background: 'var(--sage)', color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 9 }}>NEW</span>
              <div style={{ padding: '14px 16px 16px' }}>
                <div className="mf-display" style={{ fontSize: 25 }}>{r.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--terracotta)' }}>· {r.cuisine.toLowerCase()}</span>
                  <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>{r.total}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── the trap we're avoiding — the naive empty state, for contrast ──────────
function EmptyTrap() {
  return (
    <div className="mf mf-page" style={{ height: '100%' }}>
      <Nav active="recipes" />
      <div style={{ height: 'calc(100% - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
        <div style={{ width: 120, height: 120, borderRadius: 16, border: '2px dashed var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, opacity: 0.5 }}>🍽️</div>
        <h1 className="mf-display" style={{ fontSize: 40, margin: '20px 0 0', color: 'var(--ink-3)' }}>No recipes yet.</h1>
        <p style={{ fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-4)', margin: '8px 0 18px', maxWidth: 320 }}>Your box is empty. Add your first recipe to get started.</p>
        <button className="mf-btn primary">＋ add a recipe</button>
        <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--berry)' }}>✗ THE TRAP — a cold, lonely first impression. This is what onboarding exists to prevent.</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MOBILE — condensed stepper + first-run home.
// ════════════════════════════════════════════════════════════════════════
function MobileOnboarding() {
  const [step, setStep] = React.useState(2); // open on the seed step — the interesting one
  const [picked, setPicked] = React.useState({ chorizo: true, queso: true });
  const [seedTab, setSeedTab] = React.useState('starters');
  const togglePick = (id) => setPicked((p) => ({ ...p, [id]: !p[id] }));
  const boxCount = Object.values(picked).filter(Boolean).length;

  return (
    <Phone>
      {/* progress */}
      <div style={{ padding: '8px 18px 10px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {ONB_STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i < step ? 'var(--terracotta)' : i === step ? 'var(--butter)' : 'var(--ink-4)' }}></div>)}
        </div>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 6 }}>STEP {step + 1} OF 4 · {ONB_STEPS[step].toUpperCase()}</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
        {step === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 30 }}>
            <div style={{ fontSize: 40 }}>🍳</div>
            <h2 className="mf-display" style={{ fontSize: 30, margin: '8px 0 0', lineHeight: 1 }}>a box that feels lived-in.</h2>
            <p style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', margin: '8px 0 18px' }}>set your diet, seed a few recipes — no blank page.</p>
            <GoogleBtn wide label="Continue with Google" onClick={() => setStep(1)} />
          </div>
        )}
        {step === 1 && (
          <div>
            <h2 className="mf-display" style={{ fontSize: 26, margin: 0, lineHeight: 1 }}>anything you don't eat?</h2>
            <p style={{ fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 0' }}>filters every list & plan. change it anytime.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {DIET_PRESETS.slice(0, 6).map(([k, e, desc]) => (
                <div key={k} className="mf-card" style={{ padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>{e}</span>
                  <div style={{ flex: 1 }}><div style={{ fontFamily: 'Kalam', fontSize: 13, fontWeight: 700 }}>{k}</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{desc}</div></div>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--ink)', background: k === 'vegetarian' ? 'var(--ink)' : 'transparent', color: 'var(--butter)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{k === 'vegetarian' && '✓'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 className="mf-display" style={{ fontSize: 26, margin: 0, lineHeight: 1 }}>put a few recipes in.</h2>
            <p style={{ fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 0' }}>yours or ours — add 3 and your kitchen comes alive.</p>
            <div style={{ display: 'flex', gap: 4, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {[['starters', '✨ starters'], ['url', '🔗 link'], ['scan', '📷 scan'], ['books', '📚 books']].map(([k, l]) => (
                <span key={k} onClick={() => setSeedTab(k)} className={'mf-tag ' + (seedTab === k ? 'include' : '')} style={{ fontSize: 11, flexShrink: 0, cursor: 'pointer' }}>{l}</span>
              ))}
            </div>
            {seedTab === 'starters' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {RECIPES.slice(0, 7).map((r) => {
                  const on = picked[r.id];
                  return (
                    <div key={r.id} onClick={() => togglePick(r.id)} className="mf-card" style={{ padding: 6, display: 'flex', gap: 8, alignItems: 'center', outline: on ? '2px solid var(--terracotta)' : 'none' }}>
                      <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 40, height: 40, borderRadius: 6 }} />
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: 'Kalam', fontSize: 12, lineHeight: 1.05 }}>{r.title}</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{r.total}</div></div>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid var(--ink)', background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--butter)' : 'var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{on ? '✓' : '＋'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {seedTab === 'url' && (
              <div style={{ marginTop: 10 }}>
                <div style={{ padding: 9, background: 'var(--card)', border: '1px solid var(--line-strong)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 10 }}>bbcgoodfood.com/recipes/<b>chicken-chorizo…</b></div>
                <button className="mf-btn primary" style={{ width: '100%', marginTop: 8 }}>fetch →</button>
                <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper-warm)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <FoodPhoto palette={RECIPES[0].palette} glyph={RECIPES[0].glyph} style={{ width: 46, height: 46, borderRadius: 6 }} />
                  <div style={{ flex: 1, minWidth: 0 }}><div className="mf-mono" style={{ color: 'var(--sage)', fontSize: 9 }}>● FOUND · credit kept</div><div style={{ fontFamily: 'Kalam', fontSize: 12 }}>{RECIPES[0].title}</div></div>
                  <button className="mf-btn primary sm">＋ add</button>
                </div>
              </div>
            )}
            {seedTab === 'scan' && (
              <div style={{ marginTop: 10, height: 180, border: '2px dashed var(--line-strong)', borderRadius: 12, background: 'var(--paper-warm)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div style={{ fontSize: 34 }}>📷</div>
                <div className="mf-display" style={{ fontSize: 18 }}>snap a cookbook page</div>
                <button className="mf-btn primary sm" style={{ marginTop: 4 }}>use camera</button>
              </div>
            )}
            {seedTab === 'books' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {STARTER_BOOKS.map(([n, sub, count, palette, glyph], i) => (
                  <div key={n} className="mf-card" style={{ padding: 0, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: 56, flexShrink: 0, position: 'relative', background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` }}><FoodGlyph kind={glyph} size={44} /></div>
                    <div style={{ flex: 1, padding: '8px 10px' }}><div className="mf-display" style={{ fontSize: 17, lineHeight: 1 }}>{n}</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{count} · {sub}</div></div>
                    <button className="mf-btn primary sm" style={{ alignSelf: 'center', marginRight: 8 }}>＋ {count}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {step === 3 && (
          <div style={{ textAlign: 'center', paddingTop: 24 }}>
            <div style={{ fontSize: 42 }}>🎉</div>
            <h2 className="mf-display" style={{ fontSize: 28, margin: '8px 0 0', lineHeight: 1 }}>your box has <span style={{ color: 'var(--terracotta)' }}>{boxCount} recipes</span>.</h2>
            <p style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', margin: '8px 16px 16px' }}>no empty page — just a few prompts left on your home for later.</p>
            <button className="mf-btn terra" style={{ width: '100%', padding: 12, fontSize: 15, borderRadius: 12 }}>take me to my kitchen →</button>
          </div>
        )}
      </div>

      {/* sticky footer */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '10px 18px', background: 'var(--card)' }}>
        {step === 2 && <div className="mf-mono" style={{ color: boxCount ? 'var(--sage)' : 'var(--ink-3)', fontSize: 9, marginBottom: 8 }}>📖 YOUR BOX · {boxCount} {boxCount === 1 ? 'RECIPE' : 'RECIPES'}{boxCount >= 3 ? ' · looking good ✨' : ''}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && step < 3 && <button className="mf-btn ghost sm" onClick={() => setStep((s) => s - 1)}>← back</button>}
          {(step === 1 || step === 2) && <button className="mf-btn sm" onClick={() => setStep((s) => s + 1)}>skip</button>}
          {step === 1 && <button className="mf-btn primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>continue →</button>}
          {step === 2 && <button className="mf-btn terra" style={{ flex: 1, justifyContent: 'center', opacity: boxCount ? 1 : 0.5 }} onClick={() => boxCount && setStep(3)}>{boxCount >= 3 ? 'finish →' : boxCount ? `add ${3 - boxCount} more or finish` : 'add a few first'}</button>}
          {step === 0 && <button className="mf-btn sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>continue with email</button>}
          {step === 3 && <button className="mf-btn ghost sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>↻ replay</button>}
        </div>
      </div>
    </Phone>
  );
}

function MobileFirstRun() {
  const prompts = [
    { ic: '🧂', t: 'Stock your kitchen', tone: 'butter' },
    { ic: '📅', t: 'Plan a week', tone: 'terra' },
    { ic: '🏠', t: 'Invite household', tone: 'sage' },
  ];
  return (
    <Phone>
      <div style={{ padding: '6px 18px 10px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>DAY ONE · WELCOME IN</div>
            <h2 className="mf-display" style={{ fontSize: 28, margin: '2px 0 0', lineHeight: 1 }}>what's cooking, <span style={{ color: 'var(--terracotta)' }}>R?</span></h2>
          </div>
          <MobileAvatar />
        </div>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 4 }}>6 RECIPES IN · DIET SET</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
        {/* prompt cards */}
        <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9, marginBottom: 6 }}>FINISH SETTING UP · 1/4</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {prompts.map((p, i) => {
            const bg = { butter: 'var(--butter-soft)', terra: 'rgba(200,105,60,0.10)', sage: 'rgba(143,166,119,0.14)' }[p.tone];
            const bd = { butter: 'var(--butter)', terra: 'var(--terracotta)', sage: 'var(--sage)' }[p.tone];
            return (
              <div key={p.t} style={{ flex: '0 0 130px', padding: '10px 12px', borderRadius: 10, background: bg, border: `1.5px solid ${bd}`, transform: `rotate(${i % 2 ? -0.6 : 0.5}deg)` }}>
                <div style={{ fontSize: 20 }}>{p.ic}</div>
                <div className="mf-display" style={{ fontSize: 16, marginTop: 2, lineHeight: 1 }}>{p.t}</div>
                <button className="mf-btn primary sm" style={{ marginTop: 8, fontSize: 10 }}>start →</button>
              </div>
            );
          })}
        </div>
        {/* seeded recipes */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '6px 0 8px' }}>
          <div className="mf-display" style={{ fontSize: 18 }}>The 6 you added</div>
          <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>＋ more</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {RECIPES.slice(0, 6).map((r) => (
            <div key={r.id} className="mf-card" style={{ position: 'relative' }}>
              <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 92 }} />
              <span style={{ position: 'absolute', top: 5, left: 5, padding: '1px 6px', borderRadius: 999, background: 'var(--sage)', color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 8 }}>NEW</span>
              <div style={{ padding: '6px 8px' }}><div className="mf-display" style={{ fontSize: 15, lineHeight: 1.05 }}>{r.title}</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{r.total}</div></div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="recipes" />
    </Phone>
  );
}

window.MidOnboarding = MidOnboarding;
window.FirstRunHome = FirstRunHome;
window.EmptyTrap = EmptyTrap;
window.MobileOnboarding = MobileOnboarding;
window.MobileFirstRun = MobileFirstRun;
