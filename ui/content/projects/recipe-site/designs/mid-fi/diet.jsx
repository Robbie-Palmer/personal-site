// mid-fi/diet.jsx — the persistent "Diet" profile settings page.

const DIET_PRESETS = [
  ['vegetarian', '🥬', 'no meat or fish'],
  ['vegan', '🌱', 'no animal products'],
  ['pescatarian', '🐟', 'no meat, fish OK'],
  ['gluten-free', '🌾', 'no gluten / wheat'],
  ['dairy-free', '🥛', 'no milk / cheese / yoghurt'],
  ['nut-free', '🥜', 'no peanuts or tree nuts'],
  ['low-carb', '🍞', 'minimise grains & sugar'],
  ['halal', '☪️', 'halal-friendly only'],
  ['kosher', '✡️', 'kosher-friendly only'],
];

function MidDiet() {
  const [presets, setPresets] = React.useState({ vegetarian: true });
  const [allergies, setAllergies] = React.useState(['egg', 'shellfish']);
  const [strict, setStrict] = React.useState('hide'); // hide | warn
  const toggle = (k) => setPresets(p => ({ ...p, [k]: !p[k] }));
  const removeAllergy = (a) => setAllergies(xs => xs.filter(x => x !== a));

  return (
    <div className="mf mf-page">
      <Nav active={null} />

      <div style={{ padding: '32px 48px 16px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>← ACCOUNT · YOUR DIET</div>
        <h1 className="mf-display" style={{ fontSize: 60, margin: '4px 0 0', lineHeight: 0.95 }}>
          set it once. <span style={{ color: 'var(--terracotta)' }}>follows you everywhere.</span>
        </h1>
        <p style={{ fontFamily: 'Kalam', fontSize: 16, color: 'var(--ink-2)', margin: '6px 0 0', maxWidth: 720 }}>
          Your diet is a permanent, profile-wide filter — separate from the per-search chips on the recipe list. Use it for things that never change: allergies, dietary choices, things you just don't eat.
        </p>
      </div>

      {/* preview banner */}
      <div style={{ margin: '8px 48px 24px', padding: '14px 18px', background: 'var(--butter-soft)', border: '1px solid var(--butter)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--sage)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18 }}>🥗</span>
        <div style={{ flex: 1 }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>YOU'LL SEE</div>
          <div style={{ fontFamily: 'Kalam', fontSize: 16, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            recipes that are
            <span className="mf-tag include" style={{ fontSize: 12 }}>vegetarian</span>
            <span style={{ color: 'var(--ink-3)' }}>and</span>
            <span className="mf-tag" style={{ fontSize: 12, color: 'var(--terracotta-deep)', borderColor: 'var(--terracotta-deep)', textDecoration: 'line-through' }}>⊘ egg</span>
            <span className="mf-tag" style={{ fontSize: 12, color: 'var(--terracotta-deep)', borderColor: 'var(--terracotta-deep)', textDecoration: 'line-through' }}>⊘ shellfish</span>
            <span style={{ color: 'var(--ink-3)' }}>— 31 of 47 recipes match.</span>
          </div>
        </div>
        <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>auto-saved</span>
      </div>

      <div style={{ padding: '0 48px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        {/* presets */}
        <div className="mf-card" style={{ padding: 22 }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>DIETARY PRESETS</div>
          <div className="mf-display" style={{ fontSize: 24, marginTop: 2 }}>What do you eat?</div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DIET_PRESETS.map(([k, e, desc]) => {
              const on = presets[k];
              return (
                <div key={k} onClick={() => toggle(k)} style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  border: '1.5px solid ' + (on ? 'var(--terracotta)' : 'var(--line)'),
                  background: on ? 'var(--butter-soft)' : 'var(--paper)',
                  display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 22 }}>{e}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Kalam', fontSize: 14, fontWeight: 700 }}>{k}</div>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{desc}</div>
                  </div>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--ink)', background: on ? 'var(--ink)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--butter)', fontSize: 10 }}>{on && '✓'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* always-avoid + strictness */}
        <div className="mf-card" style={{ padding: 22 }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta-deep)' }}>ALWAYS AVOID</div>
          <div className="mf-display" style={{ fontSize: 24, marginTop: 2 }}>Allergies & no-gos.</div>
          <p style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', margin: '4px 0 0' }}>add any specific ingredient. recipes containing it stay hidden by default.</p>

          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allergies.map(a => (
              <span key={a} className="mf-tag" style={{ color: 'var(--terracotta-deep)', borderColor: 'var(--terracotta-deep)', background: 'rgba(200,105,60,0.05)' }}>
                ⊘ {a}
                <span onClick={() => removeAllergy(a)} style={{ marginLeft: 6, cursor: 'pointer', color: 'var(--ink-3)' }}>×</span>
              </span>
            ))}
            <span className="mf-tag" style={{ borderStyle: 'dashed' }}>＋ add</span>
          </div>

          <div className="mf-search" style={{ marginTop: 10, padding: '6px 10px' }}>
            <span style={{ color: 'var(--ink-3)' }}>⌕</span>
            <input placeholder="e.g. peanut, sesame, soy…" style={{ fontSize: 13 }} />
          </div>

          <hr className="mf-rule dashed" style={{ margin: '20px 0' }} />

          <div className="mf-mono" style={{ color: 'var(--terracotta-deep)' }}>HOW STRICT?</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['hide', 'hide them', 'avoided recipes never show up. cleanest.'],
              ['warn', 'show with a warning', 'still shows them, but with ⚠ next to the title — useful for "i could swap that out".'],
            ].map(([k, l, sub]) => {
              const on = strict === k;
              return (
                <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: 8, cursor: 'pointer', background: on ? 'var(--paper-warm)' : 'transparent', border: '1px solid ' + (on ? 'var(--line-strong)' : 'transparent') }}>
                  <input type="radio" checked={on} onChange={() => setStrict(k)} />
                  <div>
                    <div style={{ fontFamily: 'Kalam', fontSize: 14, fontWeight: 700 }}>{l}</div>
                    <div style={{ fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-3)' }}>{sub}</div>
                  </div>
                </label>
              );
            })}
          </div>

          <hr className="mf-rule dashed" style={{ margin: '20px 0' }} />

          <div className="mf-mono" style={{ color: 'var(--terracotta-deep)' }}>ALSO APPLY TO</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontFamily: 'Kalam', fontSize: 14 }}>
            <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" defaultChecked /> shopping lists</label>
            <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" defaultChecked /> public recipes browsed</label>
            <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" /> recipes shared with me</label>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileDiet() {
  const [presets, setPresets] = React.useState({ vegetarian: true });
  const [allergies] = React.useState(['egg', 'shellfish']);
  const toggle = (k) => setPresets(p => ({ ...p, [k]: !p[k] }));
  return (
    <Phone>
      <div style={{ padding: '6px 18px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="mf-btn ghost sm" style={{ padding: '2px 6px' }}>← account</button>
          <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>YOUR DIET</span>
          <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>saved ✓</span>
        </div>
        <h2 className="mf-display" style={{ fontSize: 28, margin: '6px 0 0', lineHeight: 1 }}>set it once.</h2>
        <p style={{ fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 0' }}>follows you across every recipe, search and shopping list.</p>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px 18px' }}>
        {/* preview */}
        <div style={{ padding: 10, background: 'var(--butter-soft)', border: '1px solid var(--butter)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--sage)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14 }}>🥗</span>
          <div style={{ flex: 1, fontFamily: 'Kalam', fontSize: 12 }}>
            veggie · no egg · no shellfish<br/>
            <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>31 of 47 recipes match</span>
          </div>
        </div>

        <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 16 }}>DIETARY PRESETS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {DIET_PRESETS.slice(0, 6).map(([k, e, desc]) => {
            const on = presets[k];
            return (
              <div key={k} onClick={() => toggle(k)} style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                border: '1.5px solid ' + (on ? 'var(--terracotta)' : 'var(--line)'),
                background: on ? 'var(--butter-soft)' : 'var(--card)',
                display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <span style={{ fontSize: 18 }}>{e}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Kalam', fontSize: 13, fontWeight: 700 }}>{k}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{desc}</div>
                </div>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--ink)', background: on ? 'var(--ink)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--butter)', fontSize: 9 }}>{on && '✓'}</span>
              </div>
            );
          })}
        </div>

        <div className="mf-mono" style={{ color: 'var(--terracotta-deep)', marginTop: 16 }}>ALWAYS AVOID</div>
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {allergies.map(a => <span key={a} className="mf-tag" style={{ fontSize: 11, color: 'var(--terracotta-deep)', borderColor: 'var(--terracotta-deep)' }}>⊘ {a} ×</span>)}
          <span className="mf-tag" style={{ borderStyle: 'dashed', fontSize: 11 }}>＋ add</span>
        </div>

        <div className="mf-mono" style={{ color: 'var(--terracotta-deep)', marginTop: 16 }}>HOW STRICT?</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <span className="mf-tag include" style={{ fontSize: 11, flex: 1, textAlign: 'center' }}>hide them</span>
          <span className="mf-tag" style={{ fontSize: 11, flex: 1, textAlign: 'center' }}>warn ⚠</span>
        </div>
      </div>
      <TabBar active="profile" />
    </Phone>
  );
}

window.MidDiet = MidDiet;
window.MobileDiet = MobileDiet;
