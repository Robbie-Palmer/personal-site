// mid-fi/list.jsx — recipe box list page

function MidList() {
  const [filters, setFilters] = React.useState({
    italian: 'include', chinese: 'exclude',
    egg: 'exclude',
    quick: 'include',
  });
  const cycle = (k) => setFilters(f => {
    const cur = f[k] || 'off';
    const next = cur === 'off' ? 'include' : cur === 'include' ? 'exclude' : 'off';
    return { ...f, [k]: next };
  });

  const filterGroups = [
    { label: 'cuisine', items: ['italian','mexican','chinese','british','cajun'] },
    { label: 'ingredient', items: ['chicken','egg','dairy','gluten','peanut'] },
    { label: 'equipment', items: ['oven','slow cooker','blender'] },
    { label: 'time', items: ['quick','under 30m'] },
    { label: 'tag', items: ['one-pot','sweet','savoury','dinner','lunch'] },
  ];

  return (
    <div className="mf mf-page">
      <Nav active="recipes" />

      {/* hero */}
      <div style={{ padding: '36px 48px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32 }}>
          <div>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>YOUR RECIPE BOX</div>
            <h1 className="mf-display" style={{ fontSize: 76, margin: '6px 0 0' }}>
              what's cooking, <span style={{ color: 'var(--terracotta)' }}>Robbie?</span>
            </h1>
            <div style={{ marginTop: 8, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Kalam', fontSize: 16, color: 'var(--ink-2)' }}>47 recipes · 8 cuisines · last cooked 2 days ago</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mf-btn">＋ new</button>
            <button className="mf-btn butter">📷 scan</button>
          </div>
        </div>
      </div>

      {/* filter rail */}
      <div style={{ padding: '8px 48px 24px', borderBottom: '1px solid var(--line)' }}>
        {/* diet banner — explains what's already being filtered out before chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginTop: 4, background: 'rgba(143,166,119,0.12)', border: '1px dashed var(--sage)', borderRadius: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--sage)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>🥗</span>
          <span style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)' }}>
            <b>your diet</b> is filtering this list — vegetarian, no egg, no shellfish.
            <span style={{ color: 'var(--ink-3)' }}> Hides 16 recipes.</span>
          </span>
          <span className="mf-mono" style={{ marginLeft: 'auto', color: 'var(--sage)', cursor: 'pointer' }}>edit diet →</span>
          <span className="mf-mono" style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>show anyway</span>
        </div>

        {filterGroups.map(g => (
          <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span className="mf-mono" style={{ width: 60, color: 'var(--ink-3)' }}>{g.label}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {g.items.map(i => {
                const st = filters[i] || 'off';
                return (
                  <span key={i} className={'mf-tag ' + (st === 'include' ? 'include' : st === 'exclude' ? 'exclude' : '')} onClick={() => cycle(i)}>
                    {st === 'exclude' && <span>⊘</span>}{i}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-3)' }}>tap once to include · twice to avoid · third to clear</span>
          <span className="mf-mono" style={{ marginLeft: 'auto', color: 'var(--terracotta)' }}>14 recipes match</span>
        </div>
      </div>

      {/* grid */}
      <div style={{ padding: '24px 48px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {RECIPES.map((r, i) => (
            <div key={r.id} className="mf-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 180 }} />
              <div style={{ padding: '14px 16px 16px' }}>
                <div className="mf-display" style={{ fontSize: 26, color: 'var(--ink)' }}>{r.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
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

window.MidList = MidList;
