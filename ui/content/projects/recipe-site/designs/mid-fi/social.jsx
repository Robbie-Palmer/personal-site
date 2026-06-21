// mid-fi/social.jsx — share, cookbooks, public profile

function MidShare() {
  const r = RECIPES[0];
  return (
    <div className="mf mf-page">
      <Nav active="recipes" />
      <div style={{ padding: '40px 48px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48 }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SHARE A RECIPE</div>
          <h1 className="mf-display" style={{ fontSize: 64, margin: '6px 0 0', lineHeight: 0.95 }}>
            send it to <span style={{ color: 'var(--terracotta)' }}>someone.</span>
          </h1>
          <p className="mf-body" style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 8, maxWidth: 460 }}>
            A pretty link, the way it'd look on a phone, and a list of folks you cook with often.
          </p>

          <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--card)', border: '1px solid var(--line-strong)', borderRadius: 12 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>LINK</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{ flex: 1, padding: '8px 12px', background: 'var(--paper-warm)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 13 }}>
                robbiesrecipes.com/r/<b>chorizo-pasta-bake</b>
              </code>
              <button className="mf-btn primary sm">copy</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <span className="mf-tag include">link only</span>
              <span className="mf-tag">specific people</span>
              <span className="mf-tag">public on profile</span>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SEND TO</div>
            <div className="mf-search" style={{ marginTop: 6 }}>
              <span style={{ color: 'var(--ink-3)' }}>⌕</span>
              <input placeholder="name or email…"/>
            </div>
            <div style={{ marginTop: 10 }}>
              {[['M','mum','3 recipes shared'],['D','dave','pasta lord'],['S','aunt sarah','baker']].map(([i,n,sub]) => (
                <div key={n} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="mf-avatar" style={{ width: 28, height: 28, fontSize: 16 }}>{i}</span>
                  <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: 15 }}>
                    {n} <span className="mf-mono" style={{ color: 'var(--ink-3)', marginLeft: 6 }}>{sub}</span>
                  </span>
                  <button className="mf-btn sm">send →</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <span className="mf-tag soft">📥 PDF</span>
              <span className="mf-tag soft">🖨 print</span>
              <span className="mf-tag soft">📧 email</span>
              <span className="mf-tag soft">💬 whatsapp</span>
              <span className="mf-tag soft">⊞ QR code</span>
            </div>
          </div>
        </div>

        {/* OG preview cluster */}
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>HOW IT LOOKS</div>
          <div style={{ marginTop: 8, padding: 16, background: '#dde0e6', borderRadius: 16 }}>
            <div className="mf-mono" style={{ color: '#5a6172', marginBottom: 6 }}>iMessage preview</div>
            <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 160 }} big />
              <div style={{ padding: '10px 14px' }}>
                <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>ROBBIESRECIPES.COM</div>
                <div className="mf-display" style={{ fontSize: 22, marginTop: 2 }}>{r.title}</div>
                <div style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>Creamy, smoky, sunday-night staple. 55m · serves 4.</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 14, background: '#FFF8F2', borderRadius: 14, border: '1px solid var(--line)' }}>
            <div className="mf-mono" style={{ color: '#3a8aef' }}>twitter / X card</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'stretch' }}>
              <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ width: 90, borderRadius: 8 }}/>
              <div style={{ flex: 1 }}>
                <div className="mf-display" style={{ fontSize: 18 }}>{r.title}</div>
                <div style={{ fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>by @robbie · ⏱ 55m · 🔥 Italian</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--butter-soft)', borderRadius: 12, fontFamily: 'Kalam', fontSize: 14, color: 'var(--ink-2)' }}>
            <span className="mf-display" style={{ fontSize: 20, color: 'var(--terracotta-deep)' }}>good to know —</span>
            <span> the photo, title and description above are auto-generated. Override them in <i>edit recipe</i>.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MidCookbooks() {
  const books = [
    { name: "Weeknight dinners", count: 18, vis: 'private', palette: ['#C8693C','#7E2D1F'], glyph: 'pasta' },
    { name: "From mum",          count: 9,  vis: 'friends', palette: ['#9DAE7A','#506B3F'], glyph: 'bowl' },
    { name: "Baking",            count: 14, vis: 'public',  palette: ['#E2A040','#8B4A1E'], glyph: 'tortilla' },
    { name: "Slow cooker",       count: 7,  vis: 'private', palette: ['#B5462E','#5C1A0F'], glyph: 'pot' },
    { name: "Robbie's greatest hits", count: 22, vis: 'public', palette: ['#C8553D','#7E3326'], glyph: 'risotto' },
    { name: "Christmas",         count: 11, vis: 'friends', palette: ['#99394A','#5A1E2A'], glyph: 'pasta' },
  ];
  return (
    <div className="mf mf-page">
      <Nav active="cookbooks" />
      <div style={{ padding: '36px 48px 16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>COOKBOOKS</div>
          <h1 className="mf-display" style={{ fontSize: 64, margin: '4px 0 0', lineHeight: 0.95 }}>
            collections, with a <span style={{ color: 'var(--terracotta)' }}>spine.</span>
          </h1>
          <div style={{ fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink-2)', marginTop: 6 }}>
            6 cookbooks · 81 recipes · each has its own visibility.
          </div>
        </div>
        <button className="mf-btn primary">＋ new cookbook</button>
      </div>

      <div style={{ padding: '24px 48px 60px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
        {books.map((b, i) => (
          <div key={i} className="mf-card" style={{ padding: 0, position: 'relative', background: 'transparent', border: 'none', overflow: 'visible' }}>
            {/* book spine illusion */}
            <div style={{ position: 'relative', height: 240, transform: i % 2 ? 'rotate(-0.6deg)' : 'rotate(0.4deg)' }}>
              {/* back cover shadow */}
              <div style={{ position: 'absolute', inset: '4px -4px -4px 4px', background: 'var(--ink-4)', borderRadius: 6, opacity: 0.35 }}></div>
              {/* cover */}
              <div style={{ position: 'relative', height: '100%', borderRadius: 6, overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', background: `linear-gradient(135deg, ${b.palette[0]}, ${b.palette[1]})` }}>
                <FoodGlyph kind={b.glyph} size={140} />
                <div style={{ position: 'absolute', inset: 0, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div className="mf-mono" style={{ color: 'rgba(255,246,224,0.8)' }}>cookbook · {b.count} recipes</div>
                  <div>
                    <div className="mf-display" style={{ fontSize: 36, color: '#FFF6E0', lineHeight: 0.95, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{b.name}</div>
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: 999, color: '#FFF6E0', fontFamily: 'Kalam', fontSize: 12 }}>
                      {b.vis === 'public' ? '🌐 public' : b.vis === 'friends' ? '👥 friends' : '🔒 private'}
                    </div>
                  </div>
                </div>
                {/* spine */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 14, background: 'rgba(0,0,0,0.18)', boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.15)' }}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MidProfile() {
  const stats = [
    ['47', 'recipes'],
    ['238', 'cooked'],
    ['12', 'shared'],
    ['8', 'cuisines'],
  ];
  return (
    <div className="mf mf-page">
      <Nav active={null} />
      <div style={{ padding: '40px 48px 24px', display: 'flex', gap: 28, alignItems: 'flex-end' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--butter)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)' }}>
          <span className="mf-display" style={{ fontSize: 64, color: 'var(--terracotta-deep)' }}>R</span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>@ROBBIE · LIVERPOOL</div>
          <h1 className="mf-display" style={{ fontSize: 64, margin: '4px 0 0', lineHeight: 0.95 }}>
            Robbie's <span style={{ color: 'var(--terracotta)' }}>kitchen.</span>
          </h1>
          <p className="mf-body" style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 6, maxWidth: 540 }}>
            Cook, taster, leftover-fan. Mostly weeknight pasta and slow-cooker miracles. Following 18 · followed by 142.
          </p>
        </div>
        <button className="mf-btn">edit profile</button>
        <button className="mf-btn primary">＋ follow</button>
      </div>

      {/* stats row */}
      <div style={{ padding: '0 48px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {stats.map(([n,l]) => (
          <div key={l} style={{ padding: '16px 18px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <div className="mf-display" style={{ fontSize: 40, color: 'var(--terracotta)', lineHeight: 1 }}>{n}</div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div style={{ padding: '24px 48px 12px', display: 'flex', gap: 18, borderBottom: '1px solid var(--line)' }}>
        {['Public recipes', 'Public cookbooks', 'Recently cooked'].map((t, i) => (
          <span key={t} style={{ paddingBottom: 10, fontFamily: 'Kalam', fontSize: 16, color: i === 0 ? 'var(--ink)' : 'var(--ink-3)', borderBottom: i === 0 ? '2px solid var(--terracotta)' : '2px solid transparent', cursor: 'pointer' }}>{t}</span>
        ))}
      </div>

      {/* recipe grid (smaller) */}
      <div style={{ padding: '24px 48px 60px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {RECIPES.slice(0, 8).map((r) => (
          <div key={r.id} className="mf-card">
            <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 130 }} />
            <div style={{ padding: '10px 12px' }}>
              <div className="mf-display" style={{ fontSize: 20 }}>{r.title}</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2 }}>{r.cuisine.toLowerCase()} · {r.total}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.MidShare = MidShare;
window.MidCookbooks = MidCookbooks;
window.MidProfile = MidProfile;
