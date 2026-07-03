// mid-fi/shopping.jsx — meal plan + smart-merged list, with desktop & mobile.

const SHOP_AISLES = [
  { name: 'produce', items: [
    ['cherry tomatoes', '2 tins', ['chorizo bake','cajun pasta'], true],
    ['garlic', '5 cloves', ['chorizo bake','quesadillas'], true],
    ['fresh basil', '1 bunch', ['chorizo bake'], false] ]},
  { name: 'dairy', items: [
    ['mozzarella', '150g', ['chorizo bake'], false],
    ['parmesan', 'small block', ['chorizo bake','cajun pasta'], false] ]},
  { name: 'meat', items: [
    ['chicken breast', '1.2kg', ['chorizo bake','quesadillas'], true],
    ['chorizo', '1', ['chorizo bake'], false] ]},
  { name: 'pantry', items: [
    ['farfalle / pasta', '600g', ['chorizo bake','cajun pasta'], true],
    ['oregano (dried)', '2 tsp', ['chorizo bake'], false] ]},
];

function Checkbox({ on }) {
  return <span style={{ width: 16, height: 16, borderRadius: 3, border: '1.5px solid var(--ink)', background: on ? 'var(--ink)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, flexShrink: 0 }}>{on && '✓'}</span>;
}

function ShoppingItems({ view, ticked, tick }) {
  // view: 'aisle' | 'recipe' | 'flat'
  if (view === 'flat') {
    const flat = SHOP_AISLES.flatMap(a => a.items.map(it => [...it, a.name])).sort((a, b) => a[0].localeCompare(b[0]));
    return (
      <div style={{ marginTop: 10 }}>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', marginBottom: 4 }}>JUST INGREDIENTS · A-Z</div>
        {flat.map(([n, qty, , merged, aisle]) => {
          const on = ticked[n];
          return (
            <div key={n} onClick={() => tick(n)} style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderBottom: '1px dashed var(--line)' }}>
              <Checkbox on={on} />
              <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: 14, textDecoration: on ? 'line-through' : 'none', color: on ? 'var(--ink-3)' : 'var(--ink)' }}>
                <b>{qty}</b> {n}
                {merged && <span className="mf-tag" style={{ marginLeft: 6, fontSize: 9, background: 'var(--butter-soft)', borderColor: 'var(--butter)' }}>↻</span>}
              </span>
              <span className="mf-mono" style={{ fontSize: 9, color: 'var(--ink-4)' }}>{aisle}</span>
            </div>);
        })}
      </div>
    );
  }
  if (view === 'recipe') {
    const byRecipe = {};
    SHOP_AISLES.forEach(a => a.items.forEach(([n, qty, recipes]) => recipes.forEach(r => {
      (byRecipe[r] = byRecipe[r] || []).push([n, qty]);
    })));
    return (
      <div>{Object.entries(byRecipe).map(([rname, items]) => (
        <div key={rname} style={{ marginTop: 14 }}>
          <div className="mf-display" style={{ fontSize: 20, color: 'var(--terracotta)', borderBottom: '1px solid var(--line)', paddingBottom: 2 }}>· {rname}</div>
          {items.map(([n, qty]) => {
            const on = ticked[n];
            return (
              <div key={n} onClick={() => tick(n)} style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Checkbox on={on} />
                <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: 14, textDecoration: on ? 'line-through' : 'none', color: on ? 'var(--ink-3)' : 'var(--ink)' }}><b>{qty}</b> {n}</span>
              </div>);
          })}
        </div>
      ))}</div>
    );
  }
  return (
    <div>{SHOP_AISLES.map(a => (
      <div key={a.name} style={{ marginTop: 14 }}>
        <div className="mf-display" style={{ fontSize: 20, color: 'var(--terracotta)', borderBottom: '1px solid var(--line)', paddingBottom: 2 }}>· {a.name}</div>
        {a.items.map(([n, qty, recipes, merged]) => {
          const on = ticked[n];
          return (
            <div key={n} onClick={() => tick(n)} style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Checkbox on={on} />
              <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: 14, textDecoration: on ? 'line-through' : 'none', color: on ? 'var(--ink-3)' : 'var(--ink)' }}>
                <b>{qty}</b> {n}
                {merged && <span className="mf-tag" style={{ marginLeft: 6, fontSize: 9, background: 'var(--butter-soft)', borderColor: 'var(--butter)' }}>↻ merged</span>}
              </span>
              <span className="mf-mono" style={{ fontSize: 9, color: 'var(--ink-3)' }}>{recipes.join(' · ')}</span>
            </div>);
        })}
      </div>
    ))}</div>
  );
}

function EatingInsights({ compact, expanded, onToggle }) {
  // Mock signal — in real product this is computed from cook history.
  const stale = [
    { id: 'pesto',   label: 'Chicken Risotto',     days: 43, palette: ['#C8553D','#7E3326'], glyph: 'risotto' },
    { id: 'soup',    label: 'Potato Leek Soup',    days: 31, palette: ['#9DAE7A','#506B3F'], glyph: 'bowl' },
    { id: 'alfredo', label: 'Chicken Alfredo',     days: 26, palette: ['#E5C892','#9C7740'], glyph: 'pasta' },
  ];
  const heavy = [
    { id: 'chorizo', label: 'Chorizo Pasta Bake', count: 4, palette: ['#D67C42','#7E2D1F'], glyph: 'pasta' },
    { id: 'queso',   label: 'Quesadillas',        count: 3, palette: ['#E2A040','#8B4A1E'], glyph: 'tortilla' },
  ];
  const cuisines = [
    { name: 'italian', pct: 50, avg: 38, color: '#C8693C' },
    { name: 'mexican', pct: 17, avg: 22, color: '#E2A040' },
    { name: 'british', pct: 17, avg: 14, color: '#9DAE7A' },
    { name: 'cajun',   pct: 16, avg: 8,  color: '#B5462E' },
  ];

  // Collapsed: one-line summary. Click to expand.
  if (!expanded) {
    return (
      <div onClick={onToggle} style={{
        padding: '10px 16px', background: 'var(--paper-warm)', borderRadius: 10, border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', flexWrap: 'wrap',
      }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--butter)', border: '1px solid var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>📊</span>
        <span style={{ fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-2)' }}>
          mostly italian this week ·
          <span style={{ color: 'var(--sage)' }}> haven't had risotto in 43d</span> ·
          <span style={{ color: 'var(--terracotta-deep)' }}> chorizo bake ×4 this month</span>
        </span>
        <span className="mf-mono" style={{ marginLeft: 'auto', color: 'var(--terracotta)' }}>show details ▾</span>
      </div>
    );
  }

  return (
    <div className="mf-card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>EATING INSIGHTS</span>
        <span onClick={onToggle} className="mf-mono" style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>hide ▴</span>
      </div>
      {/* compact cuisines mix bar across the top */}
      <div style={{ marginBottom: 14 }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>THIS WEEK'S CUISINES</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', border: '1px solid var(--line)', flex: 1 }}>
            {cuisines.map(c => <div key={c.name} style={{ width: c.pct + '%', background: c.color }} title={c.name + ': ' + c.pct + '%'}></div>)}
          </div>
          <div style={{ display: 'flex', gap: 10, fontFamily: 'Kalam', fontSize: 12 }}>
            {cuisines.map(c => (
              <span key={c.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }}></span>
                {c.name} {c.pct}%
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, 1fr)', gap: 22 }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>HAVEN'T HAD IN A WHILE</div>
          <div style={{ marginTop: 6 }}>
            {stale.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }} title="click to add to a slot">
                <span style={{ width: 22, height: 22, borderRadius: 4, background: `linear-gradient(135deg, ${s.palette[0]}, ${s.palette[1]})`, flexShrink: 0 }}></span>
                <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.1 }}>{s.label}</span>
                <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 10 }}>{s.days}d ago</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>FROM YOUR FREEZER · EAT SOON ❄️</div>
          <div style={{ marginTop: 6 }}>
            {[
              ['Cajun Sausage Pasta', '2 portions', 'expired 2d ago', 'var(--terracotta-deep)', ['#C8693C','#742A18']],
              ['Chorizo Pasta Bake',  '2 portions', '5d left',        'var(--terracotta)',      ['#D67C42','#7E2D1F']],
              ['Salmon fillets',      '× 2',        'use this week',  'var(--terracotta)',      ['#E59B7D','#A8523B']],
            ].map(([n, qty, when, tone, palette]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                <span style={{ width: 22, height: 22, borderRadius: 4, background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`, position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF6E0', fontSize: 11 }}>❄</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.1 }}>{n}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{qty}</div>
                </div>
                <span className="mf-mono" style={{ color: tone, fontSize: 10 }}>{when}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 6, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>drop these into a slot to use them up.</div>
        </div>

        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>COOKED OFTEN LATELY</div>
          <div style={{ marginTop: 6 }}>
            {heavy.map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ width: 22, height: 22, borderRadius: 4, background: `linear-gradient(135deg, ${h.palette[0]}, ${h.palette[1]})`, flexShrink: 0 }}></span>
                <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.1 }}>{h.label}</span>
                <span className="mf-mono" style={{ color: 'var(--terracotta-deep)', fontSize: 10 }}>×{h.count} this mo</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 6, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>maybe rest these this week?</div>
        </div>
      </div>
    </div>
  );
}

window.EatingInsights = EatingInsights;

function MidShopping() {
  const [step, setStep] = React.useState('plan'); // plan | shop
  const [mode, setMode] = React.useState('plan'); // plan | quick (planning sub-mode)
  const [view, setView] = React.useState('aisle'); // aisle | recipe | flat
  const [insightsOpen, setInsightsOpen] = React.useState(false);
  const [ticked, setTicked] = React.useState({ 'fresh basil': true, 'chorizo': true });
  const tick = (n) => setTicked(t => ({ ...t, [n]: !t[n] }));
  const slots = [['breakfast','B'],['lunch','L'],['dinner','D']];
  const days = ['mon','tue','wed','thu','fri','sat','sun'];
  const planned = { mon: { dinner: 0 }, wed: { lunch: 5, dinner: 1 }, fri: { dinner: 2 }, tue: { breakfast: 3 } };
  const [picked, setPicked] = React.useState({ 0: true, 1: true, 5: true });

  return (
    <div className="mf mf-page">
      <Nav active="shop" />

      <div style={{ padding: '28px 48px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SHOPPING · WEEK OF 27 APR</div>
          <h1 className="mf-display" style={{ fontSize: 52, margin: '4px 0 0' }}>{step === 'plan' ? "what's the plan?" : 'shopping list.'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {step === 'shop' && <button className="mf-btn" onClick={() => setStep('plan')}>← back to plan</button>}
          {step === 'shop' && <button className="mf-btn">📤 share</button>}
          {step === 'shop' && <button className="mf-btn">🖨 print</button>}
        </div>
      </div>

      {/* step indicator */}
      <div style={{ padding: '0 48px 14px', display: 'flex', gap: 0, alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
        {[['plan','1 · Plan the week'],['shop','2 · Shopping list']].map(([k, l], i) => {
          const active = step === k;
          return (
            <span key={k} onClick={() => setStep(k)} style={{
              padding: '10px 14px', fontFamily: 'Kalam', fontSize: 15,
              color: active ? 'var(--ink)' : 'var(--ink-3)',
              borderBottom: active ? '2px solid var(--terracotta)' : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer', fontWeight: active ? 700 : 400,
            }}>{l}</span>
          );
        })}
      </div>

      {step === 'plan' ? (
        <div style={{ padding: '20px 48px 32px' }}>
          {/* insights — collapsed by default */}
          <EatingInsights expanded={insightsOpen} onToggle={() => setInsightsOpen(o => !o)} />

          {/* sub-mode + summary — one bag of recipes, two ways to look at it */}
          <div style={{ display: 'flex', gap: 6, marginTop: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <span onClick={() => setMode('plan')} className={'mf-tag ' + (mode === 'plan' ? 'include' : '')} style={{ cursor: 'pointer' }}>📅 with calendar</span>
            <span onClick={() => setMode('quick')} className={'mf-tag ' + (mode === 'quick' ? 'include' : '')} style={{ cursor: 'pointer' }}>✓ just recipes</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)' }}>
              <b style={{ color: 'var(--ink)' }}>5 recipes</b> · 7 meals · 2 ↩ leftover · 1 unscheduled
            </span>
          </div>
          <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--paper-warm)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
            both views share <b style={{ color: 'var(--ink-2)' }}>one set of recipes</b>. <b style={{ color: 'var(--ink-2)' }}>Click any meal</b> to bump servings + pick which upcoming slots its leftovers should fill — they can be any combination (e.g. Tue lunch + Thu lunch).
          </div>

          {mode === 'plan' ? (
            <div style={{ marginTop: 14 }}>
              {/* unscheduled rail — recipes added but no day/slot yet */}
              <div style={{ padding: '10px 12px', background: 'var(--paper-warm)', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mf-mono" style={{ color: 'var(--terracotta)', flexShrink: 0 }}>UNSCHEDULED · 1</span>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
                  <div style={{ flex: '0 0 auto', padding: '4px 8px', borderRadius: 6, background: 'var(--card)', border: '1px solid var(--line-strong)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, background: 'linear-gradient(135deg, #C8553D, #7E3326)' }}></span>
                    <span style={{ fontFamily: 'Kalam', fontSize: 12 }}>Chicken Risotto</span>
                    <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>drag to a slot</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(7, 1fr)', gap: 4, position: 'relative' }}>
                <div></div>
                {days.map(d => <div key={d} className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 10, textAlign: 'center', padding: '4px 0' }}>{d.toUpperCase()}</div>)}
                {slots.map(([slot]) => (
                  <React.Fragment key={slot}>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 10, alignSelf: 'center', textAlign: 'right', paddingRight: 6 }}>{slot}</div>
                    {days.map(d => {
                      const cellKey = d + '-' + slot;
                      // Cook sessions: { day-slot: { recipe, leftover (true/false), from (orig day-slot) } }
                      // Mon dinner (chorizo) cooks once and fills Tue lunch as leftover.
                      // Wed dinner (alfredo) cooks once and fills Thu lunch as leftover.
                      const cells = {
                        'mon-dinner': { r: RECIPES[0] },                                    // cook session
                        'tue-lunch':  { r: RECIPES[0], leftover: true, from: 'mon dinner' }, // leftover
                        'tue-breakfast': { r: RECIPES[3] },
                        'wed-lunch':  { r: RECIPES[5] },
                        'wed-dinner': { r: RECIPES[1] },
                        'thu-lunch':  { r: RECIPES[1], leftover: true, from: 'wed dinner' },
                        'fri-dinner': { r: RECIPES[2] },
                      };
                      const cell = cells[cellKey];
                      const r = cell?.r;
                      const isLeftover = cell?.leftover;
                      return (
                        <div key={cellKey} className="mf-card" style={{
                          padding: 6, minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isLeftover ? 'transparent' : 'var(--card)',
                          border: isLeftover ? '1.5px dashed var(--line-strong)' : '1.25px solid var(--line-strong)',
                          opacity: isLeftover ? 0.85 : 1,
                          position: 'relative',
                        }}>
                          {r ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                              <span style={{ width: 22, height: 22, borderRadius: 4, background: `linear-gradient(135deg, ${r.palette[0]}, ${r.palette[1]})`, flexShrink: 0, opacity: isLeftover ? 0.55 : 1 }}></span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'Caveat', fontSize: 14, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.title.split(' ').slice(0, 2).join(' ')}
                                </div>
                                {isLeftover && (
                                  <div className="mf-mono" style={{ color: 'var(--sage)', fontSize: 8, marginTop: 1 }}>↩ {cell.from} leftovers</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontFamily: 'Caveat', fontSize: 14, color: 'var(--ink-4)' }}>＋</span>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* mock leftover-config popover anchored to Mon dinner cell */}
              <div style={{ position: 'relative', marginTop: 0 }}>
                <div style={{
                  position: 'absolute', top: -78, left: 50,
                  width: 260, background: 'var(--card)', border: '1.5px solid var(--ink)', borderRadius: 10,
                  boxShadow: 'var(--shadow)', padding: 12, zIndex: 10,
                }}>
                  {/* arrow */}
                  <div style={{ position: 'absolute', top: -8, left: 30, width: 14, height: 14, background: 'var(--card)', borderTop: '1.5px solid var(--ink)', borderLeft: '1.5px solid var(--ink)', transform: 'rotate(45deg)' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 4, background: 'linear-gradient(135deg, #D67C42, #7E2D1F)' }}></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mf-display" style={{ fontSize: 16, lineHeight: 1 }}>Chorizo Pasta Bake</div>
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>Mon · dinner · cook session</div>
                    </div>
                    <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 11, cursor: 'pointer' }}>×</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '6px 8px', background: 'var(--paper-warm)', borderRadius: 6 }}>
                    <span style={{ fontFamily: 'Kalam', fontSize: 12 }}>serves</span>
                    <button className="mf-btn sm" style={{ padding: '0 6px', fontSize: 11 }}>−</button>
                    <span className="mf-display" style={{ fontSize: 18, color: 'var(--terracotta)' }}>6</span>
                    <button className="mf-btn sm" style={{ padding: '0 6px', fontSize: 11 }}>＋</button>
                    <span className="mf-mono" style={{ color: 'var(--ink-3)', marginLeft: 'auto', fontSize: 9 }}>2 base · 4 leftover</span>
                  </div>
                  <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>FILLS THESE MEALS · TICK ANY</span>
                    <span style={{ color: 'var(--ink-3)' }}>scroll for more</span>
                  </div>
                  <div style={{ marginTop: 4, maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 4 }}>
                    {[
                      ['Tue · lunch',    true,  true,  false],
                      ['Tue · dinner',   false, false, false],
                      ['Wed · lunch',    false, false, true],   // already has another meal
                      ['Wed · dinner',   false, false, true],
                      ['Thu · lunch',    true,  false, false],
                      ['Thu · dinner',   false, false, false],
                      ['Fri · lunch',    false, false, false],
                      ['Fri · dinner',   false, false, true],
                      ['Sat · lunch',    false, false, false],
                      ['Sat · dinner',   false, false, false],
                      ['Sun · lunch',    false, false, false],
                    ].map(([slot, on, suggested, occupied]) => (
                      <label key={slot} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Kalam', fontSize: 12, cursor: occupied ? 'not-allowed' : 'pointer', opacity: occupied ? 0.45 : 1 }}>
                        <Checkbox on={on} />
                        <span style={{ flex: 1 }}>{slot}</span>
                        {occupied && <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 8 }}>OTHER MEAL</span>}
                        {suggested && !occupied && <span className="mf-mono" style={{ color: 'var(--sage)', fontSize: 8 }}>SUGGESTED</span>}
                      </label>
                    ))}
                    <div style={{ padding: '4px 0', fontFamily: 'Kalam', fontSize: 12, color: 'var(--terracotta)', cursor: 'pointer' }}>＋ extend into next week →</div>
                  </div>
                  <div style={{ marginTop: 10, padding: '6px 8px', background: 'rgba(143,166,119,0.10)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-2)' }}>
                    cooking for <b>6 servings</b> · ingredients auto-scale in the shopping list.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>open by clicking any meal</span>
                    <button className="mf-btn primary sm" style={{ fontSize: 11 }}>done</button>
                  </div>
                </div>
              </div>

              {/* leftovers explainer */}
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(143,166,119,0.10)', border: '1px dashed var(--sage)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Kalam', fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>↩</span>
                <span style={{ flex: 1, color: 'var(--ink-2)' }}>
                  <b>2 leftover meals</b> this week — Mon dinner fills Tue lunch · Wed dinner fills Thu lunch.
                  <span style={{ color: 'var(--ink-3)' }}> Saves shopping for 2 extra meals.</span>
                </span>
                <span className="mf-mono" style={{ color: 'var(--sage)', cursor: 'pointer' }}>how it works ⓘ</span>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>ADD A RECIPE</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input placeholder="search 47 recipes…" style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 13 }} />
                  <span className="mf-tag" style={{ fontSize: 10 }}>recent</span>
                  <span className="mf-tag" style={{ fontSize: 10 }}>quick</span>
                  <span className="mf-tag" style={{ fontSize: 10 }}>veggie</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto' }}>
                  {RECIPES.slice(0, 8).map((rr, i) => (
                    <div key={rr.id} className="mf-card" style={{ flex: '0 0 120px', padding: 6, cursor: 'grab' }}>
                      <FoodPhoto palette={rr.palette} glyph={rr.glyph} style={{ height: 50 }} />
                      <div style={{ fontFamily: 'Kalam', fontSize: 12, marginTop: 4, lineHeight: 1.05 }}>{rr.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>TAP TO ADD / REMOVE FROM THIS WEEK</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input placeholder="search 47 recipes…" style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 13 }} />
                <span className="mf-tag" style={{ fontSize: 10 }}>quick</span>
                <span className="mf-tag" style={{ fontSize: 10 }}>veggie</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
                {RECIPES.map((rr, i) => {
                  const on = picked[i];
                  // mock: which of these are already scheduled to a day?
                  const scheduledTo = { 0: 'Mon dinner ↩ Tue lunch', 1: 'Wed dinner ↩ Thu lunch', 5: 'Wed lunch' }[i];
                  return (
                    <div key={rr.id} onClick={() => setPicked(p => ({ ...p, [i]: !p[i] }))} className="mf-card" style={{ padding: 8, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', outline: on ? '2px solid var(--terracotta)' : 'none' }}>
                      <Checkbox on={on} />
                      <FoodPhoto palette={rr.palette} glyph={rr.glyph} style={{ width: 44, height: 44 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Kalam', fontSize: 12, lineHeight: 1.1 }}>{rr.title}</div>
                        <div className="mf-mono" style={{ color: scheduledTo ? 'var(--terracotta)' : 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>
                          {scheduledTo ? '📅 ' + scheduledTo : rr.cuisine.toLowerCase() + ' · ' + rr.total}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '20px 48px 32px', maxWidth: 720, margin: '0 auto' }}>
          <div className="mf-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>3 recipes · 11 items · 2 ticked</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['aisle','by aisle'],['recipe','by recipe'],['flat','just ingredients']].map(([k,l]) => (
                  <span key={k} onClick={() => setView(k)} className={'mf-tag ' + (view === k ? 'include' : '')} style={{ fontSize: 10, cursor: 'pointer' }}>{l}</span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(143,166,119,0.10)', border: '1px dashed var(--sage)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--sage)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10 }}>🧂</span>
              <span style={{ fontFamily: 'Kalam', fontSize: 13 }}><b>from pantry · 5 items skipped</b></span>
              {['olive oil','salt','pepper','garlic','farfalle'].map(t => <span key={t} className="mf-tag" style={{ fontSize: 10, textDecoration: 'line-through', color: 'var(--ink-3)' }}>{t}</span>)}
              <span className="mf-tag" style={{ fontSize: 10, borderStyle: 'dashed', marginLeft: 'auto' }}>＋ mark have</span>
            </div>

            <ShoppingItems view={view} ticked={ticked} tick={tick} />

            <div style={{ marginTop: 14, padding: '8px 10px', border: '1.5px dashed var(--line-strong)', borderRadius: 8, textAlign: 'center', fontFamily: 'Caveat', color: 'var(--terracotta)' }}>＋ add an extra (milk, bread…)</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MOBILE: notes-app style, just the list. ───────────────────
function MidShoppingMobile() {
  const [view, setView] = React.useState('aisle');
  const [ticked, setTicked] = React.useState({ 'fresh basil': true, 'chorizo': true });
  const tick = (n) => setTicked(t => ({ ...t, [n]: !t[n] }));
  return (
    <div style={{ background: '#1a1410', height: '100%', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
      <div style={{ width: 360, height: '100%', maxHeight: 760, background: '#000', borderRadius: 36, padding: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
        <div className="mf" style={{ width: '100%', height: '100%', borderRadius: 28, overflow: 'hidden', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
          {/* status bar */}
          <div style={{ padding: '12px 18px 6px', display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-2)' }}>
            <span>9:41</span><span>● ● ●</span><span>100%</span>
          </div>
          {/* header */}
          <div style={{ padding: '8px 18px 12px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="mf-btn ghost sm" style={{ padding: '4px 8px' }}>← plan</button>
              <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>WEEK · 27 APR</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="mf-btn ghost sm" style={{ padding: '4px 8px', fontSize: 11 }} title="share this shopping list">📤 share</button>
                <MobileAvatar />
              </div>
            </div>
            <h2 className="mf-display" style={{ fontSize: 32, margin: '6px 0 0', lineHeight: 1 }}>shopping</h2>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 10, marginTop: 2 }}>3 recipes · 11 items · 2 ticked</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {[['aisle','aisle'],['recipe','recipe'],['flat','flat']].map(([k,l]) => (
                <span key={k} onClick={() => setView(k)} className={'mf-tag ' + (view === k ? 'include' : '')} style={{ fontSize: 10, cursor: 'pointer', flex: 1, textAlign: 'center' }}>{l}</span>
              ))}
            </div>
          </div>
          {/* list — fills the screen, like a notes app */}
          <div style={{ flex: 1, overflow: 'auto', padding: '6px 18px 18px' }}>
            <ShoppingItems view={view} ticked={ticked} tick={tick} />
            <div style={{ marginTop: 14, padding: '6px 10px', border: '1.5px dashed var(--line-strong)', borderRadius: 8, textAlign: 'center', fontFamily: 'Caveat', color: 'var(--terracotta)', fontSize: 16 }}>＋ add extra</div>
          </div>
          {/* tab bar — use the shared mobile TabBar for consistency */}
          <TabBar active="shop" />
        </div>
      </div>
    </div>
  );
}

window.MidShopping = MidShopping;
window.MidShoppingMobile = MidShoppingMobile;
