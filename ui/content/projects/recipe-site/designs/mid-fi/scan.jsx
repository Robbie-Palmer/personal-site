// mid-fi/scan.jsx — scan + URL import + live preview

function MidScan() {
  const [tab, setTab] = React.useState('upload');
  const r = RECIPES[0];
  return (
    <div className="mf mf-page">
      <Nav active="scan" />
      <div style={{ padding: '36px 48px 12px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>ADD A RECIPE</div>
        <h1 className="mf-display" style={{ fontSize: 60, margin: '4px 0 0' }}>scan, snap, or paste a link.</h1>
        <p style={{ fontFamily: 'Kalam', fontSize: 16, color: 'var(--ink-2)', margin: '6px 0 0' }}>cookbook page, instagram screenshot, or any blog URL — i'll do the rest.</p>
      </div>

      <div style={{ padding: '8px 48px 0', display: 'flex', gap: 6 }}>
        {[['upload','📷 photo / upload'],['url','🔗 URL'],['paste','📝 paste text']].map(([k,l]) => (
          <span key={k} onClick={() => setTab(k)} className={'mf-tag ' + (tab === k ? 'include' : '')} style={{ cursor: 'pointer' }}>{l}</span>
        ))}
      </div>

      <div style={{ padding: '20px 48px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        {/* left: input panel */}
        <div className="mf-card" style={{ padding: 24, minHeight: 540 }}>
          {tab === 'upload' && (
            <div>
              <div style={{ height: 280, border: '2px dashed var(--line-strong)', borderRadius: 12, background: 'var(--paper-warm)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ fontSize: 48 }}>📷</div>
                <div className="mf-display" style={{ fontSize: 26 }}>drop a photo</div>
                <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>JPG · PNG · HEIC · multi-page OK</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="mf-btn primary sm">choose file</button>
                  <button className="mf-btn sm">📱 use camera</button>
                </div>
              </div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 18 }}>RECENT</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {RECIPES.slice(1, 4).map(rr => (
                  <div key={rr.id} className="mf-card" style={{ flex: 1, padding: 8 }}>
                    <FoodPhoto palette={rr.palette} glyph={rr.glyph} style={{ height: 60 }} />
                    <div style={{ fontFamily: 'Kalam', fontSize: 13, marginTop: 6, lineHeight: 1.1 }}>{rr.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'url' && (
            <div>
              <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>PASTE A LINK</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input defaultValue="https://bbcgoodfood.com/recipes/chicken-chorizo-pasta-bake" style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--line-strong)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                <button className="mf-btn primary">fetch →</button>
              </div>
              <div style={{ marginTop: 18, padding: 16, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper-warm)' }}>
                <div className="mf-mono" style={{ color: 'var(--sage)' }}>● FOUND · BBCGOODFOOD.COM</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, marginTop: 10 }}>
                  <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 90, height: 90 }} />
                  <div>
                    <div className="mf-display" style={{ fontSize: 22, lineHeight: 1 }}>{r.title}</div>
                    <div style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>creamy, smoky, sunday-night staple.</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span className="mf-tag">11 ingredients</span>
                      <span className="mf-tag">7 steps</span>
                      <span className="mf-tag">55m</span>
                    </div>
                  </div>
                </div>
                <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 10 }}>credit kept · linked back to source</div>
              </div>
              <p style={{ fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-3)', marginTop: 14 }}>structured site → instant. messy site → falls back to a screenshot scan.</p>
            </div>
          )}
          {tab === 'paste' && (
            <div>
              <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>PASTE THE RECIPE</div>
              <textarea rows={14} placeholder="Chicken &amp; Chorizo Pasta Bake&#10;Serves 4&#10;&#10;Ingredients&#10;300g pasta&#10;..." style={{ width: '100%', marginTop: 8, padding: 12, border: '1px solid var(--line-strong)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}></textarea>
              <button className="mf-btn primary" style={{ marginTop: 8 }}>parse →</button>
            </div>
          )}
        </div>

        {/* right: live preview-as-real-recipe */}
        <div className="mf-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--paper-warm)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>LIVE PREVIEW · AS A REAL RECIPE</span>
            <span className="mf-tag include" style={{ fontSize: 10 }}>● 93% confident</span>
          </div>
          <div style={{ padding: 22 }}>
            <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 160 }} big />
            <h2 className="mf-display" style={{ fontSize: 36, lineHeight: 1, margin: '14px 0 0' }}>{r.title}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <span className="mf-tag include">italian</span>
              <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>⏱ 15m</span>
              <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>🔥 40m</span>
              <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>· serves 4</span>
            </div>
            <h3 className="mf-display" style={{ fontSize: 22, color: 'var(--terracotta)', margin: '18px 0 6px' }}>Ingredients</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: 'Kalam', fontSize: 14 }}>
              {INGREDIENTS.slice(0, 5).map((ing, i) => (
                <li key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: '1.5px solid var(--ink-3)', borderRadius: 3 }}></span>
                  {ing}
                  {i === 2 && <span className="mf-tag" style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--butter-soft)' }}>?</span>}
                </li>
              ))}
              <li style={{ padding: '4px 0', fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-3)' }}>+ 6 more…</li>
            </ul>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--paper)' }}>
            <button className="mf-btn ghost sm">discard</button>
            <button className="mf-btn primary sm">looks good · save →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.MidScan = MidScan;
