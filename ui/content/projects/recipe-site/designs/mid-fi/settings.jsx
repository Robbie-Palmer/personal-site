// mid-fi/settings.jsx — the unified Settings hub + the avatar dropdown that reaches it.
// Left sidebar nav + content pane. Absorbs the pages that already existed (Diet §9,
// Notification prefs §16, Household §10b) as sections, and adds the new ones:
// Account, Units & measurements (the star), Default visibility, Cooking, Privacy, Data.

// ── the avatar dropdown — the way IN, on every page ───────────────────────────
const AVATAR_MENU = [
  ['profile', '👤', 'Your profile', '@robbie'],
  ['settings', '⚙', 'Settings', 'units · diet · privacy'],
  ['diet', '🥗', 'Your diet', 'veggie · no egg'],
  ['household', '🏠', 'Park Road kitchen', '4 members'],
];
function AvatarMenu({ open: openProp = false }) {
  const [open, setOpen] = React.useState(openProp);
  return (
    <div style={{ position: 'relative' }}>
      <div className="mf-avatar" onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer', outline: open ? '2px solid var(--terracotta)' : 'none', outlineOffset: 2 }}>R</div>
      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, width: 248, background: 'var(--card)', border: '1.25px solid var(--line-strong)', borderRadius: 14, boxShadow: 'var(--shadow)', overflow: 'hidden', zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', background: 'var(--paper-warm)', borderBottom: '1px solid var(--line)' }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--butter)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 24, color: 'var(--terracotta-deep)' }}>R</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: 20, lineHeight: 1 }}>Robbie</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>@robbie · Liverpool</div>
            </div>
          </div>
          <div style={{ padding: 6 }}>
            {AVATAR_MENU.map(([k, ic, label, sub]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', background: k === 'settings' ? 'rgba(200,105,60,0.08)' : 'transparent' }}>
                <span style={{ fontSize: 17, width: 22, textAlign: 'center' }}>{ic}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Kalam', fontSize: 14.5, color: 'var(--ink)' }}>{label}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>{sub}</div>
                </div>
                {k === 'settings' && <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>↵</span>}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', fontFamily: 'Kalam', fontSize: 14.5, color: 'var(--ink-2)' }}><span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>⎋</span>Log out</div>
          </div>
        </div>
      )}
    </div>);
}

// ── small shared controls ─────────────────────────────────────────────────────
const VIS = { private: ['🔒', 'Private', 'only you'], household: ['🏠', 'Household', 'Park Road'], friends: ['👥', 'Friends', 'people you follow back'], public: ['🌍', 'Public', 'anyone'] };
function VisPicker({ value, onChange, levels = ['private', 'household', 'friends', 'public'] }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {levels.map((k) => {
        const [ic, label, sub] = VIS[k]; const on = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{ flex: 1, minWidth: 96, textAlign: 'left', padding: '9px 12px', borderRadius: 11, cursor: 'pointer',
            border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--line-strong)'), background: on ? 'var(--ink)' : 'var(--card)', color: on ? 'var(--paper)' : 'var(--ink)' }}>
            <div style={{ fontFamily: 'Kalam', fontSize: 14 }}>{ic} {label}</div>
            <div className="mf-mono" style={{ fontSize: 9, color: on ? 'var(--butter)' : 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
          </button>);
      })}
    </div>);
}
function ToggleRow({ label, sub, on, onClick, children }) {
  const [s, setS] = React.useState(on);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px dashed var(--line)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Kalam', fontSize: 15 }}>{label}</div>
        {sub && <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 1 }}>{sub}</div>}
      </div>
      {children}
      {!children && <span onClick={() => setS((x) => !x)} style={{ cursor: 'pointer' }}><Switch on={s} /></span>}
    </div>);
}
function Seg({ value, opts, onChange }) {
  const [v, setV] = React.useState(value);
  return (
    <span style={{ display: 'inline-flex', gap: 3, padding: 3, background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 999 }}>
      {opts.map(([k, l]) => { const on = v === k; return (
        <button key={k} onClick={() => { setV(k); onChange && onChange(k); }} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'Kalam', fontSize: 13, fontWeight: on ? 700 : 400, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--paper)' : 'var(--ink-2)' }}>{l}</button>); })}
    </span>);
}
function PanelHead({ kicker, title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>{kicker}</div>
      <h2 className="mf-display" style={{ fontSize: 40, margin: '2px 0 0', lineHeight: 0.95 }}>{title}</h2>
      {sub && <p style={{ fontFamily: 'Kalam', fontSize: 14.5, color: 'var(--ink-2)', margin: '5px 0 0', maxWidth: 560 }}>{sub}</p>}
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// CONTENT PANELS
// ════════════════════════════════════════════════════════════════════════════
function P_Account() {
  return (
    <div>
      <PanelHead kicker="ACCOUNT" title="Who you are." sub="Your public face on every recipe, fork and follow." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0', borderBottom: '1px dashed var(--line)' }}>
        <span style={{ width: 66, height: 66, borderRadius: '50%', background: 'var(--butter)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 38, color: 'var(--terracotta-deep)', flexShrink: 0 }}>R</span>
        <div><button className="mf-btn sm">change photo</button><div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, marginTop: 5 }}>JPG / PNG · square looks best</div></div>
      </div>
      <KV label="Display name">
        <input defaultValue="Robbie" style={{ width: '100%', maxWidth: 340, padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 8, fontFamily: 'Caveat', fontSize: 18, background: 'var(--card)', color: 'var(--ink)' }} />
      </KV>
      <KV label="Username">
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: 'var(--ink)' }}>@robbie</span>
        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>· chosen when you joined · permanent</span>
      </KV>
      <KV label="Location">
        <input defaultValue="Liverpool, UK" placeholder="optional" style={{ width: '100%', maxWidth: 340, padding: '6px 10px', border: '1px solid var(--line-strong)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 14, background: 'var(--card)', color: 'var(--ink)' }} />
        <div className="mf-mono" style={{ width: '100%', color: 'var(--ink-4)', fontSize: 9, marginTop: 2 }}>optional — only used to surface recipes popular near you. leave blank to skip.</div>
      </KV>
      <KV label="Bio">
        <textarea defaultValue="Cook, taster, leftover-fan. Mostly weeknight pasta and slow-cooker miracles." rows={2} style={{ width: '100%', maxWidth: 420, padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 14, background: 'var(--card)', color: 'var(--ink)', resize: 'none' }} />
      </KV>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)' }}></span>
        <span className="mf-mono" style={{ color: 'var(--sage)' }}>changes save automatically</span>
      </div>
    </div>);
}

function P_Signin() {
  const linked = [['Google', 'robbie@gmail.com', true], ['Apple', 'robbie@icloud.com', false]];
  return (
    <div>
      <PanelHead kicker="SIGN-IN" title="How you log in." sub="You sign in with a linked account — there's no password to set or forget. Link more than one so you're never locked out." />
      <div className="mf-mono" style={{ color: 'var(--terracotta)', marginBottom: 8 }}>LINKED ACCOUNTS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {linked.map(([name, id, primary]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: '1.25px solid var(--line-strong)', borderRadius: 14, background: 'var(--card)' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--paper-warm)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 22 }}>{name[0]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Kalam', fontSize: 15 }}>{name} {primary && <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginLeft: 6 }}>· primary</span>}</div>
              <div className="mf-mono" style={{ color: 'var(--sage)', fontSize: 9, marginTop: 1 }}>✓ {id}</div>
            </div>
            {primary
              ? <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>can't unlink your only sign-in</span>
              : <button className="mf-btn ghost sm" style={{ fontSize: 11, color: 'var(--terracotta-deep)' }}>unlink</button>}
          </div>))}
      </div>
      <div className="mf-mono" style={{ color: 'var(--ink-3)', margin: '14px 0 8px' }}>LINK ANOTHER</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['Microsoft', 'GitHub'].map((p) => <button key={p} className="mf-btn">＋ {p}</button>)}
      </div>
      <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 22, marginBottom: 8 }}>WHERE YOU'RE SIGNED IN</div>
      {[['iPhone 15 · Liverpool', 'this device · now', true], ['Chrome · MacBook Air', 'last active 2h ago', false], ['iPad · kitchen', 'last active 3d ago', false]].map(([d, t, here]) => (
        <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px dashed var(--line)' }}>
          <span style={{ fontSize: 16 }}>{here ? '📱' : d.includes('iPad') ? '📲' : '💻'}</span>
          <div style={{ flex: 1 }}><div style={{ fontFamily: 'Kalam', fontSize: 14 }}>{d}</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{t}</div></div>
          {!here && <button className="mf-btn ghost sm" style={{ fontSize: 11, color: 'var(--terracotta-deep)' }}>sign out</button>}
          {here && <span className="mf-mono" style={{ color: 'var(--sage)', fontSize: 9 }}>● this device</span>}
        </div>))}
    </div>);
}

function P_Units() {
  const t = (typeof useHH === 'function' ? useHH() : {});
  const [cfg, setCfg] = React.useState(() => (window.loadCfg ? window.loadCfg((window.U_PRESETS && window.U_PRESETS[t.unitPreset]) || window.U_DEFAULT) : JSON.parse(JSON.stringify((window.U_PRESETS && window.U_PRESETS[t.unitPreset]) || window.U_DEFAULT))));
  React.useEffect(() => {
    if (window.U_PRESETS && window.U_PRESETS[t.unitPreset]) setCfg(window.loadCfg ? window.loadCfg(window.U_PRESETS[t.unitPreset]) : JSON.parse(JSON.stringify(window.U_PRESETS[t.unitPreset])));
  }, [t.unitPreset]);
  const variant = t.unitsStyle || 'workshop';
  return (
    <div>
      <PanelHead kicker="UNITS & MEASUREMENTS" title="Cook in your units." sub="Pick a starting system, then build your ladder — add the units you actually use (tsp, tbsp, ml, litres…) and drag where each one hands off to the next. We re-express every recipe on the fly; your preferences only change what you see, never the original." />
      <div style={{ marginBottom: 18 }}><UnitPresetRow cfg={cfg} setCfg={setCfg} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>
        <UnitsControl cfg={cfg} setCfg={setCfg} />
        <div style={{ position: 'sticky', top: 12 }}><UnitsPreview cfg={cfg} /></div>
      </div>
    </div>);
}

function P_Visibility() {
  const t = (typeof useHH === 'function' ? useHH() : {});
  const [rec, setRec] = React.useState(t.defaultVisibility || 'private');
  const [book, setBook] = React.useState('friends');
  React.useEffect(() => { if (t.defaultVisibility) setRec(t.defaultVisibility); }, [t.defaultVisibility]);
  return (
    <div>
      <PanelHead kicker="DEFAULT VISIBILITY" title="Who sees new things." sub="The level a new recipe, cookbook or your household card starts at. You can always change any single item later." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div><div style={{ fontFamily: 'Kalam', fontSize: 15, marginBottom: 8 }}>📖 New recipes start as</div><VisPicker value={rec} onChange={setRec} /></div>
        <div><div style={{ fontFamily: 'Kalam', fontSize: 15, marginBottom: 8 }}>📚 New cookbooks start as</div><VisPicker value={book} onChange={setBook} /></div>
        <div><div style={{ fontFamily: 'Kalam', fontSize: 15, marginBottom: 8 }}>👤 Your household card on your profile</div><VisPicker value={'private'} onChange={() => {}} levels={['private', 'public']} /><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 6 }}>members always see each other; this controls outsiders only.</div></div>
      </div>
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--butter-soft)', border: '1px solid var(--butter)', borderRadius: 12 }}>
        <span style={{ fontSize: 20 }}>💡</span>
        <div style={{ flex: 1, fontFamily: 'Kalam', fontSize: 13.5, color: 'var(--ink-2)' }}>Defaults keep you from over-sharing by accident. Most people set recipes to <b>Private</b> and publish deliberately.</div>
      </div>
    </div>);
}

function P_Diet() {
  const presets = (window.DIET_PRESETS || []).slice(0, 6);
  const [on, setOn] = React.useState({ vegetarian: true });
  const [strict, setStrict] = React.useState('hide');
  return (
    <div>
      <PanelHead kicker="YOUR DIET" title="Set once, filters everywhere." sub="A permanent, profile-wide filter — separate from the per-search chips on the recipe list." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--butter-soft)', border: '1px solid var(--butter)', borderRadius: 12, marginBottom: 16 }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>🥗</span>
        <div style={{ fontFamily: 'Kalam', fontSize: 14 }}>veggie · no egg · no shellfish <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>· applied to 47 recipes</span></div>
      </div>
      <div className="mf-mono" style={{ color: 'var(--terracotta)', marginBottom: 8 }}>DIETARY CHOICES</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {(presets.length ? presets : [['vegetarian', '🥬', 'no meat or fish'], ['vegan', '🌱', 'no animal products'], ['pescatarian', '🐟', 'no meat, fish OK'], ['dairy-free', '🥛', 'no milk / cheese'], ['gluten-free', '🌾', 'no gluten / wheat'], ['low-carb', '🍞', 'minimise grains']]).map((p) => {
          const k = Array.isArray(p) ? p[0] : p.key; const ic = Array.isArray(p) ? p[1] : p.icon; const sub = Array.isArray(p) ? p[2] : p.sub;
          const l = k.charAt(0).toUpperCase() + k.slice(1);
          const active = !!on[k];
          return (
            <div key={k} onClick={() => setOn((s) => ({ ...s, [k]: !s[k] }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid ' + (active ? 'var(--terracotta)' : 'var(--line)'), background: active ? 'var(--butter-soft)' : 'var(--card)' }}>
              <span className={'mf-check' + (active ? ' done' : '')}></span>
              <span style={{ fontSize: 16 }}>{ic}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Kalam', fontSize: 14.5, lineHeight: 1.1 }}>{l}</div>
                {sub && <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 8.5 }}>{sub}</div>}
              </div>
            </div>);
        })}
      </div>
      <div className="mf-mono" style={{ color: 'var(--terracotta)', marginBottom: 8 }}>ALLERGIES & AVOID</div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
        {['egg', 'shellfish'].map((a) => <span key={a} className="mf-tag exclude">{a} ✕</span>)}
        <span className="mf-tag soft">＋ add</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)', marginBottom: 8 }}>WHEN A RECIPE BREAKS YOUR DIET</div>
        <Seg value={strict} opts={[['hide', 'Hide it'], ['warn', 'Show with ⚠ warning']]} onChange={setStrict} />
      </div>
    </div>);
}

function P_Cooking() {
  return (
    <div>
      <PanelHead kicker="COOKING MODE" title="At the hob." sub="How the recipe behaves while you're actually cooking." />
      <ToggleRow label="Keep screen awake while cooking" sub="screen won't dim or lock in cooking mode" on={true} />
      <ToggleRow label="Timer sounds" sub="chime when a step timer finishes" on={true} />
      <ToggleRow label="Read steps aloud" sub="hands-free voice for each step" on={false} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px dashed var(--line)' }}>
        <div style={{ flex: 1 }}><div style={{ fontFamily: 'Kalam', fontSize: 15 }}>Default step view</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 1 }}>how cooking mode opens</div></div>
        <Seg value="oneStep" opts={[['oneStep', 'One step at a time'], ['fullList', 'Full list']]} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
        <div style={{ flex: 1 }}><div style={{ fontFamily: 'Kalam', fontSize: 15 }}>Auto-log to your cook log</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 1 }}>finished cooking → adds to your log</div></div>
        <Seg value="ask" opts={[['always', 'Always'], ['ask', 'Ask'], ['never', 'Never']]} />
      </div>
    </div>);
}

function P_Household() {
  const t = (typeof useHH === 'function' ? useHH() : {});
  const n = t.householdSize || 4;
  const people = ['E', 'J', 'M', 'A', 'S', 'P'].slice(0, n);
  const cols = ['var(--sage)', 'var(--terracotta)', 'var(--berry)', '#506B3F', 'var(--butter)', '#8FA677'];
  return (
    <div>
      <PanelHead kicker="HOUSEHOLD" title="Park Road kitchen." sub="Shared pantry, freezer, plan & shopping. Full management lives on the household settings page." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1.25px solid var(--line-strong)', borderRadius: 14, background: 'var(--card)' }}>
        <div style={{ display: 'flex' }}>{people.map((p, i) => <span key={i} style={{ width: 34, height: 34, borderRadius: '50%', background: cols[i], border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, color: '#fff', marginLeft: i ? -8 : 0 }}>{p}</span>)}</div>
        <div style={{ flex: 1 }}><div style={{ fontFamily: 'Kalam', fontSize: 15 }}>{n} {n === 1 ? 'member' : 'members'} · you're the owner</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>created Apr 2025</div></div>
        <button className="mf-btn">manage household →</button>
      </div>
      <div className="mf-mono" style={{ color: 'var(--terracotta)', margin: '20px 0 8px' }}>YOUR DEFAULTS IN THIS HOUSEHOLD</div>
      <ToggleRow label="Show me in the household card on my profile" sub="outsiders can see you cook here" on={true} />
      <ToggleRow label="Include me in this week's plan by default" sub="opt out per slot anytime" on={true} />
      <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 10 }}>activity alerts (instant / daily digest / off) are set under <span style={{ color: 'var(--terracotta)' }}>Notifications</span>.</div>
    </div>);
}

function P_Privacy() {
  return (
    <div>
      <PanelHead kicker="PRIVACY & DISCOVERABILITY" title="How findable you are." sub="Separate from per-item visibility — this is about you as a person on the platform." />
      <ToggleRow label="Let people find me by email" sub="match robbie@gmail.com to this account" on={true} />
      <ToggleRow label="Let people find me by username" sub="@robbie shows in search" on={true} />
      <ToggleRow label="Suggest me to people I might know" sub="appear in 'cooks you may know'" on={false} />
      <ToggleRow label="Show my cooking activity to followers" sub="what you cooked & when, on your profile" on={true} />
      <ToggleRow label="Show 'meals fed' & badges publicly" sub="your headline stats on your public profile" on={true} />
      <ToggleRow label="Allow forks of my public recipes" sub="others can branch & adapt them (with credit)" on={true} />
      <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 14 }}>blocked accounts · 0 · <span style={{ color: 'var(--terracotta)', cursor: 'pointer' }}>manage</span></div>
    </div>);
}

function P_Data() {
  return (
    <div>
      <PanelHead kicker="YOUR DATA & ACCOUNT" title="Your stuff is yours." sub="Take it with you any time. Closing the account is reversible for 30 days." />
      <div className="mf-mono" style={{ color: 'var(--terracotta)', marginBottom: 8 }}>EXPORT</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[['📖', 'Recipe box', 'all your recipes + forks · JSON or PDF cookbook'], ['📚', 'Cookbooks', 'each collection as a printable PDF'], ['🗂', 'Everything', 'full archive · recipes, plan, kitchen, log']].map(([ic, l, sub]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', border: '1px solid var(--line-strong)', borderRadius: 12, background: 'var(--card)' }}>
            <span style={{ fontSize: 18 }}>{ic}</span>
            <div style={{ flex: 1 }}><div style={{ fontFamily: 'Kalam', fontSize: 14.5 }}>{l}</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{sub}</div></div>
            <button className="mf-btn sm">export</button>
          </div>))}
      </div>
      <div style={{ marginTop: 22, padding: '16px 18px', border: '1.5px solid var(--terracotta-deep)', borderRadius: 14, background: 'rgba(200,105,60,0.05)' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta-deep)', marginBottom: 4 }}>⚠ DANGER ZONE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}><div style={{ fontFamily: 'Kalam', fontSize: 14.5 }}>Deactivate account</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>hides your profile & recipes · reversible anytime</div></div>
            <button className="mf-btn" style={{ borderColor: 'var(--terracotta-deep)', color: 'var(--terracotta-deep)' }}>deactivate</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
            <div style={{ flex: 1 }}><div style={{ fontFamily: 'Kalam', fontSize: 14.5 }}>Delete account</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>permanent after 30 days · forks others made stay, crediting "a deleted cook"</div></div>
            <button className="mf-btn" style={{ background: 'var(--terracotta-deep)', color: '#fff', borderColor: 'var(--terracotta-deep)' }}>delete…</button>
          </div>
        </div>
      </div>
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// THE HUB — sidebar + content pane
// ════════════════════════════════════════════════════════════════════════════
const SETTINGS_NAV = [
  ['Account', [['account', '👤', 'Account'], ['signin', '🔑', 'Sign-in & security']]],
  ['Cooking', [['units', '⚖', 'Units & measurements'], ['diet', '🥗', 'Your diet'], ['cooking', '🍳', 'Cooking mode']]],
  ['Sharing', [['visibility', '👁', 'Default visibility'], ['household', '🏠', 'Household'], ['notifications', '🔔', 'Notifications'], ['privacy', '🔒', 'Privacy']]],
  ['Your data', [['data', '🗂', 'Data & account']]],
];
const SETTINGS_PANELS = {
  account: P_Account, signin: P_Signin, units: P_Units, diet: P_Diet, cooking: P_Cooking,
  visibility: P_Visibility, household: P_Household, privacy: P_Privacy, data: P_Data,
  notifications: () => (typeof NotifPrefs === 'function' ? <div style={{ margin: '-32px -40px' }}><NotifPrefs /></div> : <div>Notifications</div>),
};
function SettingsHub({ start = 'units' }) {
  const [sec, setSec] = React.useState(start);
  const Panel = SETTINGS_PANELS[sec] || P_Account;
  return (
    <div className="mf mf-page">
      <Nav active={null} />
      <div style={{ display: 'grid', gridTemplateColumns: '252px 1fr', minHeight: 0 }}>
        {/* sidebar */}
        <aside style={{ borderRight: '1px solid var(--line)', padding: '26px 16px 40px', background: 'rgba(244,236,214,0.4)' }}>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', padding: '0 10px 10px' }}>⚙ SETTINGS</div>
          {SETTINGS_NAV.map(([group, items]) => (
            <div key={group} style={{ marginBottom: 18 }}>
              <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, padding: '0 10px 6px' }}>{group.toUpperCase()}</div>
              {items.map(([k, ic, label]) => {
                const on = sec === k;
                return (
                  <button key={k} onClick={() => setSec(k)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', marginBottom: 2,
                    background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--paper)' : 'var(--ink-2)' }}>
                    <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{ic}</span>
                    <span style={{ fontFamily: 'Kalam', fontSize: 14.5, fontWeight: on ? 700 : 400 }}>{label}</span>
                  </button>);
              })}
            </div>
          ))}
        </aside>
        {/* content */}
        <div style={{ padding: '32px 40px 56px', overflow: 'auto', maxWidth: 920 }}><Panel /></div>
      </div>
    </div>);
}

// ════════════════════════════════════════════════════════════════════════════
// MOBILE — index list that drills into a section
// ════════════════════════════════════════════════════════════════════════════
const M_NAV = [
  ['Account', [['account', '👤', 'Account', '@robbie'], ['signin', '🔑', 'Sign-in & security', 'Google']]],
  ['Cooking', [['units', '⚖', 'Units & measurements', 'Metric'], ['diet', '🥗', 'Your diet', 'veggie · no egg'], ['cooking', '🍳', 'Cooking mode', 'screen awake on']]],
  ['Sharing', [['visibility', '👁', 'Default visibility', 'recipes: private'], ['household', '🏠', 'Household', 'Park Road · 4'], ['notifications', '🔔', 'Notifications', ''], ['privacy', '🔒', 'Privacy', '']]],
  ['Your data', [['data', '🗂', 'Data & account', 'export · delete']]],
];
const M_TITLES = { account: 'Account', signin: 'Sign-in & security', units: 'Units & measurements', diet: 'Your diet', cooking: 'Cooking mode', visibility: 'Default visibility', household: 'Household', notifications: 'Notifications', privacy: 'Privacy', data: 'Data & account' };
function MobileSettings({ start = 'index' }) {
  const [screen, setScreen] = React.useState(start);
  const t = (typeof useHH === 'function' ? useHH() : {});
  if (screen !== 'index') {
    const Panel = SETTINGS_PANELS[screen] || P_Account;
    return (
      <Phone>
        <div style={{ padding: '8px 14px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: 'var(--paper)' }}>
          <button onClick={() => setScreen('index')} className="mf-btn ghost sm" style={{ padding: '2px 6px' }}>← settings</button>
          <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9, marginLeft: 'auto' }}>{(M_TITLES[screen] || '').toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 24px', background: 'var(--paper)' }}><Panel /></div>
      </Phone>);
  }
  return (
    <Phone>
      <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>⚙ SETTINGS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--butter)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 26, color: 'var(--terracotta-deep)' }}>R</span>
          <div><div className="mf-display" style={{ fontSize: 26, lineHeight: 1 }}>Robbie</div><div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>@robbie · Liverpool</div></div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 20px', background: 'var(--paper)' }}>
        {M_NAV.map(([group, items]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, padding: '0 4px 6px' }}>{group.toUpperCase()}</div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--line-strong)', borderRadius: 12, overflow: 'hidden' }}>
              {items.map(([k, ic, label, val], i) => (
                <button key={k} onClick={() => setScreen(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', background: 'transparent', cursor: 'pointer' }}>
                  <span style={{ fontSize: 17, width: 22, textAlign: 'center' }}>{ic}</span>
                  <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: 15, color: 'var(--ink)' }}>{label}</span>
                  {val && <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, maxWidth: 110, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>}
                  <span style={{ color: 'var(--ink-3)' }}>›</span>
                </button>))}
            </div>
          </div>))}
        <button className="mf-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>⎋ log out</button>
      </div>
    </Phone>);
}

Object.assign(window, { AvatarMenu, SettingsHub, MobileSettings, VisPicker });
