// mid-fi/kitchen.jsx — Kitchen tab: pantry + freezer + "what can I make"

// Mock binary pantry — what user has on hand.
const PANTRY = {
  fridge: [
    ['milk', true], ['butter', true], ['eggs', false], ['mozzarella', false],
    ['parmesan', true], ['soft cheese', false], ['yoghurt', true],
  ],
  pantry: [
    ['pasta · farfalle', true], ['pasta · penne', true], ['rice · basmati', true],
    ['tinned cherry tomatoes', false], ['tinned chopped tomatoes', true], ['tinned chickpeas', true],
    ['olive oil', true], ['salt', true], ['black pepper', true],
    ['oregano (dried)', true], ['cumin', true], ['paprika', true],
  ],
  fresh: [
    ['onion', true], ['garlic', true], ['basil', false], ['parsley', false],
    ['lemon', true], ['chilli', true],
  ],
};

const FREEZER = [
  { name: 'Chorizo Pasta Bake', portions: 2, frozen: '14 days ago', eatBy: 5, kind: 'cooked', palette: ['#D67C42','#7E2D1F'], glyph: 'pasta' },
  { name: 'Slow Cooker Mexican Chicken', portions: 4, frozen: '8 days ago', eatBy: 11, kind: 'cooked', palette: ['#B5462E','#5C1A0F'], glyph: 'pot' },
  { name: 'Mince (beef)', qty: '500g', frozen: '32 days ago', eatBy: 28, kind: 'ingredient', palette: ['#7E2D1F','#3E140C'] },
  { name: 'Peas', qty: '~bag', frozen: '60 days ago', eatBy: 120, kind: 'ingredient', palette: ['#9DAE7A','#506B3F'] },
  { name: 'Salmon fillets', qty: '×2', frozen: '4 days ago', eatBy: 60, kind: 'ingredient', palette: ['#E59B7D','#A8523B'] },
  { name: 'Cajun Sausage Pasta', portions: 2, frozen: '21 days ago', eatBy: -2, kind: 'cooked', palette: ['#C8693C','#742A18'], glyph: 'pasta' },
];

function MidKitchen() {
  const [tab, setTab] = React.useState('pantry'); // pantry | freezer
  const [addOpen, setAddOpen] = React.useState(false);
  const [addFreezerOpen, setAddFreezerOpen] = React.useState(false);
  const [stock, setStock] = React.useState(() => {
    const m = {};
    Object.entries(PANTRY).forEach(([sec, items]) => items.forEach(([n, on]) => m[n] = on));
    return m;
  });
  const toggle = (n) => setStock(s => ({ ...s, [n]: !s[n] }));
  const haveCount = Object.values(stock).filter(Boolean).length;
  const totalCount = Object.values(stock).length;

  return (
    <div className="mf mf-page">
      <Nav active="kitchen" />

      <div style={{ padding: '32px 48px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>KITCHEN · WHAT'S IN STOCK</div>
          <h1 className="mf-display" style={{ fontSize: 56, margin: '4px 0 0', lineHeight: 0.95 }}>your <span style={{ color: 'var(--terracotta)' }}>{tab}</span>.</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mf-btn primary" onClick={() => tab === 'pantry' ? setAddOpen(true) : setAddFreezerOpen(true)}>＋ add to {tab}</button>
        </div>
      </div>

      {/* tab strip */}
      <div style={{ padding: '12px 48px 0', display: 'flex', gap: 0, alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
        {[['pantry','🧂 Pantry · ' + haveCount + '/' + totalCount],['freezer','❄️ Freezer · ' + FREEZER.length + ' items']].map(([k, l]) => {
          const active = tab === k;
          return (
            <span key={k} onClick={() => setTab(k)} style={{
              padding: '10px 14px', fontFamily: 'Kalam', fontSize: 15,
              color: active ? 'var(--ink)' : 'var(--ink-3)',
              borderBottom: active ? '2px solid var(--terracotta)' : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer', fontWeight: active ? 700 : 400,
            }}>{l}</span>
          );
        })}
      </div>

      <div style={{ padding: '20px 48px 40px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 28 }}>
        <div>
          {tab === 'pantry' ? (
            <PantryGrid stock={stock} toggle={toggle} openAdd={() => setAddOpen(true)} />
          ) : (
            <FreezerList openAdd={() => setAddFreezerOpen(true)} />
          )}
        </div>

        {/* RIGHT: "What can I make?" + Use-it-up */}
        <div>
          <WhatCanIMake />
          {tab === 'freezer' && <EatSoon />}
        </div>
      </div>

      {addOpen && <AddItemSheet onClose={() => setAddOpen(false)} />}
      {addFreezerOpen && <AddFreezerSheet onClose={() => setAddFreezerOpen(false)} />}
    </div>
  );
}

function PantryGrid({ stock, toggle, openAdd }) {
  // Pantry shows only what's IN STOCK — chip × removes it. Adding pulls from canonical catalog via AddItemSheet.
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div className="mf-search" style={{ flex: 1, padding: '6px 12px' }}>
          <span style={{ color: 'var(--ink-3)' }}>⌕</span>
          <input placeholder="search your pantry…" style={{ fontSize: 13 }} />
        </div>
        <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>tap × to remove</span>
      </div>

      {Object.entries(PANTRY).map(([section, items]) => {
        const inStock = items.filter(([n]) => stock[n]);
        return (
          <div key={section} style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
              <div className="mf-display" style={{ fontSize: 22, color: 'var(--terracotta)' }}>· {section}</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>{inStock.length} items</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {inStock.map(([n]) => (
                <span key={n} className="mf-tag include" style={{ fontSize: 13, padding: '4px 6px 4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {n}
                  <span onClick={() => toggle(n)} style={{ cursor: 'pointer', opacity: 0.7, padding: '0 4px' }} title="remove from pantry">×</span>
                </span>
              ))}
              <span onClick={() => openAdd && openAdd(section)} className="mf-tag" style={{ borderStyle: 'dashed', fontSize: 13, color: 'var(--terracotta)', cursor: 'pointer' }}>＋ add to {section}</span>
            </div>
            {inStock.length === 0 && (
              <div style={{ marginTop: 6, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)' }}>nothing here yet — tap "＋ add to {section}" to search from the catalog.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FreezerList({ openAdd }) {
  const [sort, setSort] = React.useState('date');
  const [filter, setFilter] = React.useState('all');
  const sorted = [...FREEZER]
    .filter(f => filter === 'all' || f.kind === filter)
    .sort((a, b) => sort === 'date' ? a.eatBy - b.eatBy : a.name.localeCompare(b.name));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="mf-search" style={{ flex: '1 1 200px', padding: '6px 12px' }}>
          <span style={{ color: 'var(--ink-3)' }}>⌕</span>
          <input placeholder="search your freezer…" style={{ fontSize: 13 }} />
        </div>
        <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>sort</span>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '4px 6px', fontFamily: 'Kalam', fontSize: 12, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'white' }}>
          <option value="date">by eat-by date</option>
          <option value="name">by name</option>
        </select>
        <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>show</span>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '4px 6px', fontFamily: 'Kalam', fontSize: 12, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'white' }}>
          <option value="all">everything</option>
          <option value="cooked">cooked meals</option>
          <option value="ingredient">ingredients only</option>
        </select>
        <button onClick={() => openAdd && openAdd()} className="mf-btn primary sm">＋ add to freezer</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {sorted.map((f, i) => {
          const expired = f.eatBy < 0;
          const urgent = f.eatBy >= 0 && f.eatBy <= 7;
          const ok = f.eatBy > 7;
          const tone = expired ? 'var(--terracotta-deep)' : urgent ? 'var(--terracotta)' : 'var(--sage)';
          const dateLabel = expired ? `expired ${-f.eatBy}d ago` : urgent ? `use within ${f.eatBy}d` : `keeps ~${f.eatBy}d`;
          return (
            <div key={i} className="mf-card" style={{ padding: 12, borderLeft: `3px solid ${tone}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 44, height: 44, borderRadius: 6, background: `linear-gradient(135deg, ${f.palette[0]}, ${f.palette[1]})`, position: 'relative', flexShrink: 0 }}>
                  {f.kind === 'cooked' && <FoodGlyph kind={f.glyph} size={36} />}
                  {f.kind === 'ingredient' && (
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF6E0', fontSize: 18 }}>❄</span>
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mf-display" style={{ fontSize: 18, lineHeight: 1 }}>{f.name}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>
                    {f.kind === 'cooked' ? `${f.portions} portions · cooked` : `${f.qty} · ingredient`}
                  </div>
                  <div className="mf-mono" style={{ fontSize: 10, color: tone, marginTop: 6 }}>
                    {expired && '⚠ '}{dateLabel}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <button className="mf-btn sm" style={{ flex: 1, fontSize: 11 }} title={f.kind === 'cooked' ? 'mark a portion as eaten and remove it from your freezer' : 'mark this ingredient as used and remove from your freezer'}>
                  {f.kind === 'cooked' ? '🍴 ate a portion' : '✓ used it up'}
                </button>
                <button className="mf-btn ghost sm" style={{ fontSize: 11 }} title="edit name, dates, portions">✎</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WhatCanIMake() {
  const cookNow = [
    { id: 'soup',  title: 'Potato, Leek & Rosemary Soup', cuisine: 'British', total: '45m', missing: [], palette: ['#9DAE7A','#506B3F'], glyph: 'bowl' },
    { id: 'cajun', title: 'Cajun Sausage Pasta',          cuisine: 'Cajun',   total: '35m', missing: [], palette: ['#C8693C','#742A18'], glyph: 'pasta' },
  ];
  const justNeeds = [
    { id: 'chorizo', title: 'Chicken & Chorizo Pasta Bake', cuisine: 'Italian', total: '55m', missing: ['cherry tomatoes', 'mozzarella', 'basil'], palette: ['#D67C42','#7E2D1F'], glyph: 'pasta' },
    { id: 'queso',   title: 'Chicken Quesadillas',          cuisine: 'Mexican', total: '50m', missing: ['mozzarella'], palette: ['#E2A040','#8B4A1E'], glyph: 'tortilla' },
  ];
  return (
    <div className="mf-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mf-display" style={{ fontSize: 24 }}>what can I make?</div>
        <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>open recipes →</span>
      </div>

      <div className="mf-mono" style={{ color: 'var(--sage)', marginTop: 14 }}>✓ COOK NOW · 100% STOCKED</div>
      <div style={{ marginTop: 6 }}>
        {cookNow.map(r => (
          <div key={r.id} className="mf-card" style={{ padding: 8, marginBottom: 6, display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ width: 40, height: 40, borderRadius: 5, background: `linear-gradient(135deg, ${r.palette[0]}, ${r.palette[1]})`, flexShrink: 0, position: 'relative' }}><FoodGlyph kind={r.glyph} size={28} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.1 }}>{r.title}</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{r.cuisine.toLowerCase()} · {r.total}</div>
            </div>
            <span className="mf-tag include" style={{ fontSize: 10 }}>cook</span>
          </div>
        ))}
      </div>

      <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 14 }}>↗ JUST NEED A FEW MORE</div>
      <div style={{ marginTop: 6 }}>
        {justNeeds.map(r => (
          <div key={r.id} className="mf-card" style={{ padding: 8, marginBottom: 6, display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ width: 40, height: 40, borderRadius: 5, background: `linear-gradient(135deg, ${r.palette[0]}, ${r.palette[1]})`, flexShrink: 0, position: 'relative' }}><FoodGlyph kind={r.glyph} size={28} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.1 }}>{r.title}</div>
              <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>need: {r.missing.join(', ')}</div>
            </div>
            <span className="mf-tag" style={{ fontSize: 10 }}>＋{r.missing.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EatSoon() {
  const items = [
    { name: 'Cajun Sausage Pasta', detail: 'expired 2d ago · 2 portions', tone: 'var(--terracotta-deep)' },
    { name: 'Chorizo Pasta Bake',  detail: 'eat within 5d · 2 portions', tone: 'var(--terracotta)' },
    { name: 'Salmon fillets',      detail: '× 2 · use this week', tone: 'var(--terracotta)' },
  ];
  return (
    <div className="mf-card" style={{ padding: 18, marginTop: 18, borderLeft: '3px solid var(--terracotta)' }}>
      <div className="mf-display" style={{ fontSize: 22 }}>eat soon ⏳</div>
      <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>freezer items expiring or aging</div>
      <div style={{ marginTop: 10 }}>
        {items.map((it, i) => (
          <div key={i} style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.tone, flexShrink: 0 }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Kalam', fontSize: 14 }}>{it.name}</div>
              <div className="mf-mono" style={{ color: it.tone, fontSize: 9 }}>{it.detail}</div>
            </div>
            <button className="mf-btn ghost sm" style={{ fontSize: 11 }}>plan</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Add-item sheet (overlays the page) ─────────────────────────
function AddItemSheet({ onClose }) {
  const [method, setMethod] = React.useState('search');
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 4 }}></div>
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 520, background: 'var(--paper)', borderRadius: 16, padding: 22, zIndex: 5, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="mf-display" style={{ fontSize: 26, margin: 0 }}>add to your kitchen</h3>
          <button className="mf-btn ghost sm" onClick={onClose}>close ×</button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {[['search','⌕ search'],['barcode','▥ barcode'],['photo','📷 photo'],['receipt','🧾 receipt']].map(([k, l]) => (
            <span key={k} onClick={() => setMethod(k)} className={'mf-tag ' + (method === k ? 'include' : '')} style={{ fontSize: 12, cursor: 'pointer', flex: 1, textAlign: 'center' }}>{l}</span>
          ))}
        </div>

        {method === 'search' && (
          <div style={{ marginTop: 14 }}>
            <div className="mf-search" style={{ padding: '8px 12px' }}>
              <span style={{ color: 'var(--ink-3)' }}>⌕</span>
              <input placeholder="type an ingredient — pasta, milk, basil…" style={{ fontSize: 14 }} autoFocus />
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 10 }}>SUGGESTIONS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {['pasta · penne','rice · basmati','olive oil','cherry tomatoes','garlic','onion','milk','eggs','butter'].map(s => (
                <span key={s} className="mf-tag" style={{ fontSize: 12, cursor: 'pointer' }}>＋ {s}</span>
              ))}
            </div>
          </div>
        )}
        {method === 'barcode' && (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <div style={{ height: 220, background: '#2a2520', borderRadius: 12, position: 'relative', overflow: 'hidden', backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 8px, rgba(255,255,255,0.04) 8px 9px)' }}>
              <div style={{ position: 'absolute', top: '50%', left: 30, right: 30, height: 2, background: 'var(--butter)', boxShadow: '0 0 12px var(--butter)' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: 30, right: 30, height: 90, transform: 'translateY(-50%)', border: '2px dashed var(--butter)', borderRadius: 8 }}></div>
              <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', color: 'var(--butter)', fontFamily: 'Caveat', fontSize: 16 }}>line up the barcode</div>
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 10 }}>looks up product · adds the matching pantry item</div>
          </div>
        )}
        {method === 'photo' && (
          <div style={{ marginTop: 14, padding: 16, background: 'var(--paper-warm)', borderRadius: 10, textAlign: 'center', border: '2px dashed var(--line-strong)' }}>
            <div style={{ fontSize: 40 }}>📸</div>
            <div className="mf-display" style={{ fontSize: 20, marginTop: 4 }}>snap your fridge or cupboard</div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 4 }}>ML detects items · you confirm what to add</div>
            <button className="mf-btn primary" style={{ marginTop: 12 }}>take a photo</button>
          </div>
        )}
        {method === 'receipt' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ padding: 16, background: 'var(--paper-warm)', borderRadius: 10, border: '2px dashed var(--line-strong)', textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>🧾</div>
              <div className="mf-display" style={{ fontSize: 20, marginTop: 4 }}>scan a receipt</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 4 }}>matches food items · skips non-grocery</div>
              <button className="mf-btn primary" style={{ marginTop: 12 }}>upload receipt</button>
            </div>
          </div>
        )}

        {/* persistent footer · same for every method · explains the passive sources */}
        <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(143,166,119,0.10)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)' }}>
          ✓ items also auto-flow into your pantry as you tick them off the <b>shopping list</b>.
        </div>
      </div>
    </React.Fragment>
  );
}

// ─── Add to freezer · with dates ───────────────────────────────
function AddFreezerSheet({ onClose }) {
  const [kind, setKind] = React.useState('cooked');
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 5 }}></div>
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 520, background: 'var(--paper)', borderRadius: 16, padding: 22, zIndex: 6, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="mf-display" style={{ fontSize: 26, margin: 0 }}>add to freezer ❄️</h3>
          <button className="mf-btn ghost sm" onClick={onClose}>close ×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <span onClick={() => setKind('cooked')} className={'mf-tag ' + (kind === 'cooked' ? 'include' : '')} style={{ fontSize: 12, cursor: 'pointer', flex: 1, textAlign: 'center' }}>🍝 cooked portion</span>
          <span onClick={() => setKind('ingredient')} className={'mf-tag ' + (kind === 'ingredient' ? 'include' : '')} style={{ fontSize: 12, cursor: 'pointer', flex: 1, textAlign: 'center' }}>🥩 ingredient</span>
        </div>

        {kind === 'cooked' ? (
          <div style={{ marginTop: 12 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>WHICH RECIPE?</div>
            <div className="mf-search" style={{ padding: '6px 10px', marginTop: 4 }}>
              <span style={{ color: 'var(--ink-3)' }}>⌕</span>
              <input defaultValue="Chicken & Chorizo Pasta Bake" style={{ fontSize: 13 }} />
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: 9 }}>pulled from your recipe list</div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>WHAT IS IT?</div>
            <div className="mf-search" style={{ padding: '6px 10px', marginTop: 4 }}>
              <span style={{ color: 'var(--ink-3)' }}>⌕</span>
              <input placeholder="beef mince · salmon · peas…" style={{ fontSize: 13 }} />
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: 9 }}>from canonical ingredient catalog</div>
          </div>
        )}

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>QUANTITY</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <button className="mf-btn sm" style={{ padding: '0 8px' }}>−</button>
              <span className="mf-display" style={{ fontSize: 22, color: 'var(--terracotta)' }}>2</span>
              <button className="mf-btn sm" style={{ padding: '0 8px' }}>＋</button>
              <span style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)' }}>
                {kind === 'cooked' ? 'portions' : (
                  <select style={{ padding: '2px 4px', fontFamily: 'Kalam', fontSize: 13, border: '1px solid var(--line-strong)', borderRadius: 4, background: 'white' }}>
                    <option>× units</option><option>g</option><option>kg</option><option>ml</option><option>l</option>
                  </select>
                )}
              </span>
            </div>
          </div>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>FROZEN ON</div>
            <input type="date" defaultValue="2026-05-19" style={{ marginTop: 4, padding: '5px 8px', fontFamily: 'Kalam', fontSize: 14, border: '1px solid var(--line-strong)', borderRadius: 6, width: '100%' }} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>BEST EATEN BY</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {[['7d','in a week'],['14d','2 weeks'],['1m','1 month'],['3m','3 months'],['6m','6 months']].map(([k, l]) => (
              <span key={k} className={'mf-tag ' + (k === (kind === 'cooked' ? '14d' : '3m') ? 'include' : '')} style={{ fontSize: 12, cursor: 'pointer' }}>{l}</span>
            ))}
            <span className="mf-tag" style={{ fontSize: 12, borderStyle: 'dashed' }}>pick a date…</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>OR EXACT</span>
            <input type="date" defaultValue="2026-06-02" style={{ padding: '5px 8px', fontFamily: 'Kalam', fontSize: 14, border: '1px solid var(--line-strong)', borderRadius: 6 }} />
            <span className="mf-mono" style={{ color: 'var(--sage)', marginLeft: 'auto' }}>auto-suggested from {kind === 'cooked' ? 'recipe type' : 'item shelf-life'}</span>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>NOTES (OPTIONAL)</div>
          <input placeholder="e.g. labelled tub, top shelf…" style={{ marginTop: 4, padding: '6px 10px', fontFamily: 'Kalam', fontSize: 13, border: '1px solid var(--line-strong)', borderRadius: 6, width: '100%', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>after-cook flow also adds leftovers automatically.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mf-btn ghost" onClick={onClose}>cancel</button>
            <button className="mf-btn primary" onClick={onClose}>save ✓</button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ─── After-cook deduct prompt (overlay) ────────────────────────
function AfterCookSheet({ onClose }) {
  return (
    <React.Fragment>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 5 }}></div>
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 480, background: 'var(--paper)', borderRadius: 16, padding: 22, zIndex: 6, boxShadow: 'var(--shadow)' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>YOU JUST COOKED</div>
        <h3 className="mf-display" style={{ fontSize: 30, margin: '4px 0 0' }}>Chicken & Chorizo Pasta Bake</h3>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 4 }}>let's keep your kitchen up to date.</div>

        <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 14 }}>USED FROM PANTRY · UNTICK ANY YOU SKIPPED</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {[
            ['farfalle (300g)', true],
            ['chopped tomatoes', true],
            ['garlic', true],
            ['oregano', true],
            ['parmesan', true],
            ['fresh basil', false], // wasn't in stock, no deduct
          ].map(([n, on]) => (
            <label key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Kalam', fontSize: 14, padding: '3px 0' }}>
              <Checkbox on={on} />
              <span style={{ flex: 1, color: on ? 'var(--ink)' : 'var(--ink-3)' }}>{n}</span>
              {!on && <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>wasn't in stock</span>}
            </label>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: 12, background: 'var(--paper-warm)', borderRadius: 8 }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>LEFTOVERS?</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ fontFamily: 'Kalam', fontSize: 14 }}>save</span>
            <button className="mf-btn sm" style={{ padding: '0 8px' }}>−</button>
            <span className="mf-display" style={{ fontSize: 22, color: 'var(--terracotta)' }}>2</span>
            <button className="mf-btn sm" style={{ padding: '0 8px' }}>＋</button>
            <span style={{ fontFamily: 'Kalam', fontSize: 14 }}>portions to freezer</span>
            <span className="mf-mono" style={{ color: 'var(--ink-3)', marginLeft: 'auto', fontSize: 9 }}>eat-by: 14 days</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <button className="mf-btn ghost" onClick={onClose}>skip</button>
          <button className="mf-btn primary" onClick={onClose}>save changes ✓</button>
        </div>
      </div>
    </React.Fragment>
  );
}

window.MidKitchen = MidKitchen;
window.AfterCookSheet = AfterCookSheet;
window.AddFreezerSheet = AddFreezerSheet;
window.PANTRY = PANTRY;
window.FREEZER = FREEZER;
