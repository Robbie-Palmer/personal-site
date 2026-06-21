// mid-fi/household.jsx — shared household. Setup, settings, profile, diet variations.
// Companion file `household-shared.jsx` adds Pantry-shared, Shopping-shared, Activity feed, and mobile artboards.

// ── DATA ───────────────────────────────────────────────────────
// Full roster — Tweaks "household size" picks the first N. Robbie is always 'you' (owner).
// `householdPublic` controls whether THIS person allows their household membership
// to appear on their public profile (and, transitively, on others' household cards
// to non-members).
const HH_ALL_MEMBERS = [
  { id: 'r', initial: 'R', name: 'Robbie',  color: '#F5C764', ink: '#A04F26', role: 'owner',  diet: 'veggie · no egg',  you: true, householdPublic: true },
  { id: 'e', initial: 'E', name: 'Ellie',   color: '#8FA677', ink: '#FFFEF8', role: 'member', diet: 'no shellfish',              householdPublic: true },
  { id: 'j', initial: 'J', name: 'Jamie',   color: '#C8693C', ink: '#FFFEF8', role: 'member', diet: 'low-FODMAP',                householdPublic: false },
  { id: 'n', initial: 'N', name: 'Nana',    color: '#B8AED1', ink: '#3A2E58', role: 'guest',  diet: 'no chilli', guestNote: 'guesting · keeps own household "Nana\'s pantry"', householdPublic: false },
  { id: 'm', initial: 'M', name: 'Mac',     color: '#99394A', ink: '#FFFEF8', role: 'member', diet: 'omnivore',                  householdPublic: true },
  { id: 'a', initial: 'A', name: 'Ash',     color: '#506B3F', ink: '#FFFEF8', role: 'member', diet: 'gluten-free',               householdPublic: false },
];

function getMembers(size) {
  // size 1 → just Robbie · 2 → +Ellie · 4 → +Jamie +Nana (guest) · 6 → +Mac +Ash
  if (size <= 1) return HH_ALL_MEMBERS.slice(0, 1);
  if (size <= 2) return HH_ALL_MEMBERS.slice(0, 2);
  if (size <= 4) return HH_ALL_MEMBERS.slice(0, 4);
  return HH_ALL_MEMBERS.slice(0, 6);
}

const HH_NAME = "Park Road kitchen";

// ── Tweaks context — single source of truth so every household screen reacts together
const HHContext = React.createContext(window.HH_TWEAK_DEFAULTS);
function useHH() { return React.useContext(HHContext); }

// ── small atoms ────────────────────────────────────────────────
function MemberDot({ m, size = 22, ring, you, dim }) {
  return (
    <span title={m.name + (m.role !== 'member' ? ' · ' + m.role : '') + (m.diet ? ' · ' + m.diet : '')}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: m.color, color: m.ink,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Caveat', fontWeight: 700, fontSize: size * 0.6,
        border: ring ? '1.5px solid var(--ink)' : '1.25px solid rgba(31,26,20,0.35)',
        boxShadow: you ? '0 0 0 2px var(--paper), 0 0 0 3.5px var(--terracotta)' : 'none',
        opacity: dim ? 0.35 : 1, flexShrink: 0,
      }}>{m.initial}</span>
  );
}

function MemberStack({ members, size = 24, max = 6, overlap = 7 }) {
  const shown = members.slice(0, max);
  const more = Math.max(0, members.length - max);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((m, i) => (
        <span key={m.id} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: 10 - i }}>
          <MemberDot m={m} size={size} ring you={m.you} />
        </span>
      ))}
      {more > 0 && <span style={{ marginLeft: -overlap, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-3)', paddingLeft: 4 }}>+{more}</span>}
    </span>
  );
}

function HouseholdBadge({ compact }) {
  const t = useHH();
  const members = getMembers(t.householdSize);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '3px 10px 3px 4px', borderRadius: 999, background: 'var(--paper-warm)', border: '1px solid var(--line-strong)', fontFamily: 'Kalam', fontSize: 12 }}>
      <MemberStack members={members} size={20} max={4} />
      {!compact && <span style={{ color: 'var(--ink-2)' }}>{HH_NAME}</span>}
      <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>· {members.length}</span>
    </div>
  );
}
window.MemberDot = MemberDot; window.MemberStack = MemberStack; window.HouseholdBadge = HouseholdBadge;
window.HH_ALL_MEMBERS = HH_ALL_MEMBERS; window.getMembers = getMembers; window.HH_NAME = HH_NAME; window.HHContext = HHContext; window.useHH = useHH;

// ──────────────────────────────────────────────────────────────
// 1 · SETUP FLOW (desktop) — three steps in one canvas, with the
// "you got invited" path running across the bottom.
// ──────────────────────────────────────────────────────────────
function HouseholdSetup() {
  return (
    <div className="mf mf-page">
      <Nav active={null} />
      <div style={{ padding: '24px 48px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SETUP · NEW HOUSEHOLD</div>
          <h1 className="mf-display" style={{ fontSize: 52, margin: '4px 0 0' }}>
            cook with the <span style={{ color: 'var(--terracotta)' }}>people you cook for.</span>
          </h1>
          <div className="mf-body" style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>
            three steps · the link + QR are live the moment you finish step 2.
          </div>
        </div>
        <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>step 1 → 3</span>
      </div>

      {/* CREATE — three-panel flow */}
      <div style={{ padding: '14px 48px 6px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {/* STEP 1 — Solo or Together */}
        <StepPanel n={1} label="solo or together?" done>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PathRow icon="◉" title="Just me" sub="keep recipes, pantry, plan private to your account" />
            <PathRow icon="◎" title="Start a household" sub="share pantry/freezer/shopping plan with the people you cook with" selected />
            <PathRow icon="↗" title="Join an existing one" sub="someone shared a link or QR with you" />
          </div>
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(143,166,119,0.10)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>
            you can switch later · only one household per account for now.
          </div>
        </StepPanel>

        {/* STEP 2 — Name + invite */}
        <StepPanel n={2} label="name it · invite people" current>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>HOUSEHOLD NAME</div>
          <input defaultValue="Park Road kitchen" style={{ marginTop: 4, padding: '7px 12px', width: '100%', boxSizing: 'border-box', fontFamily: 'Caveat', fontSize: 26, color: 'var(--ink)', border: '1.5px solid var(--ink)', borderRadius: 8, background: 'var(--card)' }} />

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>INVITE LINK · ANYONE WITH IT CAN JOIN</div>
          <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
            <code style={{ flex: 1, padding: '6px 10px', background: 'var(--paper-warm)', borderRadius: 6, fontFamily: 'JetBrains Mono', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>robbiesrecipes.com/join/<b>park-road-kitchen</b>?k=8c4f…</code>
            <button className="mf-btn primary sm">copy</button>
          </div>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 4 }}>link expires in 7 days · refresh anytime</div>

          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 92px' }}>
              <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>OR · IN-PERSON</div>
              <QRPlaceholder size={92} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>BY EMAIL</div>
              <input placeholder="ellie@…   jamie@…   nana@…" style={{ marginTop: 4, padding: '6px 10px', width: '100%', boxSizing: 'border-box', fontFamily: 'Kalam', fontSize: 13, border: '1px solid var(--line-strong)', borderRadius: 6 }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                <span className="mf-tag" style={{ fontSize: 11 }}>ellie@home.com ×</span>
                <span className="mf-tag" style={{ fontSize: 11 }}>jamie@home.com ×</span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>ROLE</span>
                <span className="mf-tag include" style={{ fontSize: 10 }}>member</span>
                <span className="mf-tag soft" style={{ fontSize: 10 }}>guest (view-only)</span>
              </div>
            </div>
          </div>
        </StepPanel>

        {/* STEP 3 — Share scope */}
        <StepPanel n={3} label="what's shared?">
          <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>defaults — change anytime in settings</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              ['Pantry · what\'s in stock',       'shared', 'everyone toggles · activity feed shows flips'],
              ['Freezer · cooked + ingredients',  'shared', 'everyone can add / mark eaten'],
              ['Shopping list & meal plan',       'shared', 'one plan per week · everyone sees + can opt out'],
              ['Meal calendar',                    'shared', 'who\'s home for which dinner'],
              ['Recipe box',                      'personal','household visibility is a per-recipe choice'],
              ['Cookbooks',                       'personal','household = a 4th visibility level on each book'],
              ['Diet profile',                    'personal','each person has their own · cook picks per meal'],
            ].map(([k, scope, sub]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', borderBottom: '1px dashed var(--line)' }}>
                <span style={{
                  width: 56, flexShrink: 0, padding: '2px 6px', borderRadius: 4, textAlign: 'center',
                  fontFamily: 'JetBrains Mono', fontSize: 9, letterSpacing: '0.04em',
                  background: scope === 'shared' ? 'var(--sage)' : 'var(--paper-warm)',
                  color: scope === 'shared' ? 'white' : 'var(--ink-3)',
                  border: scope === 'shared' ? 'none' : '1px solid var(--line)',
                }}>{scope.toUpperCase()}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.15 }}>{k}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>can be changed in settings</span>
            <button className="mf-btn primary">create household ✓</button>
          </div>
        </StepPanel>
      </div>

      {/* JOIN — the receiver side */}
      <div style={{ padding: '6px 48px 28px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>OR · YOU GOT INVITED</div>
        <div className="mf-card" style={{ padding: 16, marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 18, alignItems: 'center', borderLeft: '3px solid var(--terracotta)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--butter)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="mf-display" style={{ fontSize: 30, color: 'var(--terracotta-deep)' }}>R</span>
          </div>
          <div>
            <div className="mf-display" style={{ fontSize: 26, lineHeight: 1 }}>Robbie invited you to <span style={{ color: 'var(--terracotta)' }}>Park Road kitchen</span>.</div>
            <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
              you'll share pantry, freezer, shopping & meal plan. Recipes stay personal unless you mark them household. Already a member: <b>Robbie</b>.
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>JOIN AS</span>
              <span className="mf-tag include" style={{ fontSize: 11 }}>member</span>
              <span className="mf-tag soft" style={{ fontSize: 11 }}>guest (view-only)</span>
              <span className="mf-mono" style={{ color: 'var(--ink-3)', marginLeft: 12 }}>YOUR DIET</span>
              <span className="mf-tag" style={{ fontSize: 11 }}>set after joining</span>
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 6 }}>
              a <b style={{ color: 'var(--ink-2)' }}>guest</b> keeps their own primary household — view-only here. Members get one primary household at a time.
            </div>
          </div>
          <QRPlaceholder size={70} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="mf-btn primary">accept & join</button>
            <button className="mf-btn ghost sm">not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPanel({ n, label, children, current, done }) {
  return (
    <div className="mf-card" style={{
      padding: 14,
      borderColor: current ? 'var(--ink)' : 'var(--line-strong)',
      borderWidth: current ? 2 : 1.25,
      background: done ? 'rgba(143,166,119,0.06)' : 'var(--card)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%',
          background: done ? 'var(--sage)' : current ? 'var(--ink)' : 'var(--paper-warm)',
          color: done || current ? 'white' : 'var(--ink-3)',
          fontFamily: 'Caveat', fontWeight: 700, fontSize: 16,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{done ? '✓' : n}</span>
        <div className="mf-display" style={{ fontSize: 22 }}>{label}</div>
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function PathRow({ icon, title, sub, selected }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
      border: selected ? '1.5px solid var(--terracotta)' : '1px solid var(--line)',
      background: selected ? 'rgba(200,105,60,0.06)' : 'transparent', cursor: 'pointer',
    }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: selected ? 'var(--terracotta)' : 'var(--paper-warm)', color: selected ? 'white' : 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mf-display" style={{ fontSize: 18, lineHeight: 1 }}>{title}</div>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function QRPlaceholder({ size = 80 }) {
  // simple non-functional QR-like grid for hi-fi feel
  const cells = 9;
  const out = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      // pseudo-random pattern from coords (stable)
      const v = (x * 7 + y * 11 + x * y) % 5;
      const finder = (x < 3 && y < 3) || (x > cells - 4 && y < 3) || (x < 3 && y > cells - 4);
      out.push(<rect key={x + '-' + y} x={x} y={y} width={1} height={1} fill={finder || v < 2 ? '#1F1A14' : 'transparent'} />);
    }
  }
  return (
    <div style={{ width: size, height: size, padding: 4, background: 'white', border: '1.5px solid var(--ink)', borderRadius: 6, boxShadow: 'var(--shadow)' }}>
      <svg viewBox={`0 0 ${cells} ${cells}`} width={size - 8} height={size - 8} shapeRendering="crispEdges">{out}</svg>
    </div>
  );
}

window.HouseholdSetup = HouseholdSetup; window.QRPlaceholder = QRPlaceholder;

// ──────────────────────────────────────────────────────────────
// 2 · HOUSEHOLD SETTINGS
// ──────────────────────────────────────────────────────────────
function HouseholdSettings() {
  const t = useHH();
  const members = getMembers(t.householdSize);
  return (
    <div className="mf mf-page">
      <Nav active={null} />
      <div style={{ padding: '28px 48px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SETTINGS · HOUSEHOLD</div>
          <h1 className="mf-display" style={{ fontSize: 52, margin: '4px 0 0' }}>
            <span style={{ color: 'var(--terracotta)' }}>Park Road</span> kitchen.
          </h1>
          <div className="mf-body" style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 2 }}>
            {members.length} people · created Apr 2025 · you're the owner.
          </div>
        </div>
        <MemberStack members={members} size={36} max={6} overlap={10} />
      </div>

      {/* settings sub-nav */}
      <div style={{ padding: '14px 48px 0', display: 'flex', gap: 0, borderBottom: '1px solid var(--line)' }}>
        {['Household', 'Diet', 'Notifications', 'Units', 'Data & privacy'].map((s, i) => (
          <span key={s} style={{ padding: '8px 14px', fontFamily: 'Kalam', fontSize: 14, color: i === 0 ? 'var(--ink)' : 'var(--ink-3)', borderBottom: i === 0 ? '2px solid var(--terracotta)' : '2px solid transparent', marginBottom: -1, cursor: 'pointer', fontWeight: i === 0 ? 700 : 400 }}>{s}</span>
        ))}
      </div>

      <div style={{ padding: '20px 48px 40px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28 }}>
        {/* LEFT — members */}
        <div>
          <SettingsBlock label="MEMBERS" sub="owner · members (full access) · guests (view-only, keep their own primary household)">
            <div style={{ borderRadius: 8, border: '1px solid var(--line)', overflow: 'hidden' }}>
              {members.map((m, i) => (
                <div key={m.id} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', alignItems: 'center', gap: 14,
                  padding: '10px 14px', background: i % 2 ? 'transparent' : 'rgba(244,236,214,0.5)',
                  borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                }}>
                  <MemberDot m={m} size={34} ring you={m.you} />
                  <div>
                    <div style={{ fontFamily: 'Kalam', fontSize: 15 }}>
                      {m.name} {m.you && <span className="mf-mono" style={{ color: 'var(--terracotta)', marginLeft: 6 }}>you</span>}
                    </div>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{m.diet} · joined {i === 0 ? '12 Apr' : i === 1 ? '13 Apr' : i === 2 ? '5 May' : '14 May'}</div>
                    {m.guestNote && <div className="mf-mono" style={{ color: '#5A4882', fontSize: 9, marginTop: 2 }}>↗ {m.guestNote}</div>}
                  </div>
                  <RoleSelect role={m.role} disabled={m.you} />
                  <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                    last active {m.you ? 'now' : i === 1 ? '2m ago' : i === 2 ? '1h ago' : 'yesterday'}
                  </span>
                  {!m.you && <button className="mf-btn ghost sm" style={{ fontSize: 11, color: 'var(--terracotta-deep)' }} title="remove from household">remove</button>}
                  {m.you && <span style={{ width: 50 }}></span>}
                </div>
              ))}
            </div>
          </SettingsBlock>

          <SettingsBlock label="PENDING INVITES">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['sam@home.com', 'sent 2d ago · accepted via QR'],
                ['mum@gmail.com', 'sent 4d ago · waiting'],
              ].map(([e, sub]) => (
                <div key={e} style={{ padding: '8px 12px', border: '1px dashed var(--line-strong)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--paper-warm)', border: '1px dashed var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, color: 'var(--ink-3)', fontSize: 16 }}>?</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Kalam', fontSize: 14 }}>{e}</div>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{sub}</div>
                  </div>
                  <button className="mf-btn ghost sm" style={{ fontSize: 11 }}>resend</button>
                  <button className="mf-btn ghost sm" style={{ fontSize: 11, color: 'var(--terracotta-deep)' }}>revoke</button>
                </div>
              ))}
              <button className="mf-btn" style={{ alignSelf: 'flex-start', marginTop: 4 }}>＋ invite someone</button>
            </div>
          </SettingsBlock>

          <SettingsBlock label="DANGER ZONE" tone="terra">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="mf-btn">transfer ownership →</button>
              <button className="mf-btn" style={{ borderColor: 'var(--terracotta-deep)', color: 'var(--terracotta-deep)' }}>leave household</button>
              <button className="mf-btn" style={{ borderColor: 'var(--terracotta-deep)', color: 'var(--terracotta-deep)' }}>delete household</button>
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 8 }}>deleting removes shared pantry/freezer/plan. Personal recipes stay yours.</div>
          </SettingsBlock>
        </div>

        {/* RIGHT — shared surfaces */}
        <div>
          <SettingsBlock label="WHAT'S SHARED" sub="toggle what flows into the household vs stays personal">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                ['Pantry',           'shared',   '🧂', 'everyone can flip in/out · activity feed logs each change'],
                ['Freezer',          'shared',   '❄️', 'all add / mark eaten · auto-leftovers go here'],
                ['Shopping list',    'shared',   '🛒', 'one weekly bag · anyone can tick'],
                ['Meal plan',        'shared',   '📅', 'opt-outs per slot / range · who-cooks optional'],
                ['Diet profile',     'personal', '🥗', 'each has their own · cook picks whose to honor per meal'],
                ['Recipe box',       'personal', '📖', 'household = a 4th visibility on each recipe'],
                ['Cookbooks',        'personal', '📚', 'same — household-shared is per-book'],
                ['Scan history',     'personal', '📷', 'never shared'],
              ].map(([k, scope, ic, sub]) => (
                <div key={k} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, marginTop: 1 }}>{ic}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'Kalam', fontSize: 14 }}>{k}</span>
                      <span className="mf-mono" style={{ fontSize: 9, color: 'var(--ink-3)' }}>· {scope}</span>
                    </div>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{sub}</div>
                  </div>
                  <Switch on={scope === 'shared'} />
                </div>
              ))}
            </div>
          </SettingsBlock>

          <SettingsBlock label="HOUSEHOLD-WIDE">
            <KV label="Household name">
              <input defaultValue="Park Road kitchen" style={{ padding: '5px 8px', border: '1px solid var(--line-strong)', borderRadius: 6, fontFamily: 'Caveat', fontSize: 18, background: 'var(--card)' }} />
            </KV>
            <KV label="Cooking-for default">
              <span className="mf-tag include" style={{ fontSize: 11 }}>everyone</span>
              <span className="mf-tag" style={{ fontSize: 11 }}>let cook pick</span>
            </KV>
            <KV label="Who-cooks badges">
              <Switch on small />
              <span className="mf-mono" style={{ color: 'var(--ink-3)', marginLeft: 8 }}>show "claimed by …" on meals</span>
            </KV>
            <KV label="Activity feed">
              <span className="mf-tag" style={{ fontSize: 11 }}>quiet</span>
              <span className="mf-tag include" style={{ fontSize: 11 }}>compact</span>
              <span className="mf-tag" style={{ fontSize: 11 }}>everything</span>
            </KV>
            <KV label="Invite link">
              <code style={{ fontFamily: 'JetBrains Mono', fontSize: 10, background: 'var(--paper-warm)', padding: '4px 6px', borderRadius: 4 }}>…/join/park-road-kitchen</code>
              <button className="mf-btn ghost sm" style={{ fontSize: 11 }}>refresh</button>
            </KV>
          </SettingsBlock>
        </div>
      </div>
    </div>
  );
}

function SettingsBlock({ label, sub, tone, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="mf-mono" style={{ color: tone === 'terra' ? 'var(--terracotta-deep)' : 'var(--terracotta)' }}>{label}</div>
      {sub && <div className="mf-mono" style={{ color: 'var(--ink-3)', marginBottom: 4 }}>{sub}</div>}
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}
function KV({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center', padding: '7px 0', borderBottom: '1px dashed var(--line)', gap: 10 }}>
      <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}
function RoleSelect({ role, disabled }) {
  const styles = {
    owner:  { bg: 'var(--ink)',        col: 'var(--paper)' },
    member: { bg: 'var(--paper-warm)', col: 'var(--ink)' },
    guest:  { bg: '#E9E1F2',           col: '#5A4882' },
  };
  const s = styles[role];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999,
      background: s.bg, color: s.col, fontFamily: 'Kalam', fontSize: 12, opacity: disabled ? 0.85 : 1, cursor: disabled ? 'default' : 'pointer',
      border: '1px solid ' + (role === 'owner' ? 'var(--ink)' : 'var(--line-strong)'),
    }}>
      {role}{!disabled && <span className="mf-mono" style={{ fontSize: 9, opacity: 0.6 }}>▾</span>}
    </span>
  );
}
function Switch({ on, small }) {
  const w = small ? 30 : 36, h = small ? 16 : 20, k = small ? 12 : 14;
  return (
    <span style={{ width: w, height: h, borderRadius: 999, background: on ? 'var(--sage)' : 'var(--paper-warm)', border: '1px solid ' + (on ? 'var(--sage)' : 'var(--line-strong)'), display: 'inline-flex', alignItems: 'center', position: 'relative', padding: 1, flexShrink: 0 }}>
      <span style={{ width: k, height: k, borderRadius: '50%', background: 'white', marginLeft: on ? w - k - 4 : 0, transition: 'margin .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}></span>
    </span>
  );
}
window.HouseholdSettings = HouseholdSettings; window.Switch = Switch; window.RoleSelect = RoleSelect;

// ──────────────────────────────────────────────────────────────
// 3 · PROFILE with HOUSEHOLD card
// ── viewer: 'self' (you on your own profile), 'member' (household member viewing
//    yours), 'outsider' (anyone else). Outsiders only see members who set
//    householdPublic = true; if no one is public the card collapses entirely.
// ──────────────────────────────────────────────────────────────
function MidProfileWithHousehold({ viewer = 'self' }) {
  const t = useHH();
  const all = getMembers(t.householdSize);
  const youHHPublic = all[0].householdPublic;
  const visible = viewer === 'outsider' ? all.filter(m => m.householdPublic) : all;
  const cardVisible = viewer !== 'outsider' || (youHHPublic && visible.length > 0);

  // Meals-fed stat — the headline metric. Counts each portion served, whether
  // fresh, leftover, or pulled later from the shared freezer.
  const fedTotal = 238;
  const fedBreakdown = [
    ['64',  'yourself',                'fresh, your own cooking'],
    ['142', 'fresh for others',        'cooked → ate at the table'],
    ['32',  'from your freezer',       'portions yours, eaten later'],
  ];
  const sideStats = [
    ['12', 'people fed'],
    ['47', 'recipes'],
    ['8',  'cuisines'],
    ['18', 'badges'],
  ];

  // Badges. `earned` shows the title; `unearned` shows progress with a hint.
  const badgesEarned = [
    { ic: '🍴', name: 'The Feeder',       sub: '200+ meals fed',                     tone: 'butter' },
    { ic: '❄️', name: 'Freezer Queen',    sub: 'most leftovers shared this quarter', tone: 'sage' },
    { ic: '🌶️', name: 'Spice Captain',    sub: '12 spicy nights · no chickening',    tone: 'terra' },
    { ic: '☘️', name: 'Plant Whisperer',  sub: '30+ veggie meals fed',               tone: 'sage' },
    { ic: '🥄', name: 'Sunday Saviour',   sub: 'cooks for everyone on Sundays',      tone: 'butter' },
    { ic: '📺', name: 'TV Cook',          sub: '50+ strangers cooked your recipes',  tone: 'terra' },
    { ic: '✂️', name: 'Fuss Pot',         sub: 'tweaked 20 forks of other recipes',  tone: 'berry' },
  ];
  const badgesInProgress = [
    { ic: '🌍', name: 'Globe Trotter',  sub: 'cook 10 cuisines',           pct: 80 },
    { ic: '🔥', name: 'Daily Bread',    sub: '14-day cooking streak',      pct: 50 },
    { ic: '👯', name: 'Side by Side',   sub: 'cook 5 split meals',         pct: 60 },
  ];
  const badgesLocked = 8;

  return (
    <div className="mf mf-page">
      <Nav active={null} />
      <div style={{ padding: '20px 48px 12px', display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--butter)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)', flexShrink: 0 }}>
          <span className="mf-display" style={{ fontSize: 50, color: 'var(--terracotta-deep)' }}>R</span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>@ROBBIE · LIVERPOOL</div>
          <h1 className="mf-display" style={{ fontSize: 44, margin: '2px 0 0', lineHeight: 0.95 }}>
            Robbie's <span style={{ color: 'var(--terracotta)' }}>kitchen.</span>
          </h1>
          <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>
            Cook, taster, leftover-fan. Mostly weeknight pasta and slow-cooker miracles.
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>FOLLOWING 18 · FOLLOWERS 142</span>
            {cardVisible && viewer !== 'outsider' && (<React.Fragment><span style={{ width: 4, height: 4, borderRadius: 4, background: 'var(--ink-3)' }}></span><HouseholdBadge /></React.Fragment>)}
            {cardVisible && viewer === 'outsider' && youHHPublic && (
              <React.Fragment>
                <span style={{ width: 4, height: 4, borderRadius: 4, background: 'var(--ink-3)' }}></span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '3px 10px 3px 4px', borderRadius: 999, background: 'var(--paper-warm)', border: '1px solid var(--line-strong)', fontFamily: 'Kalam', fontSize: 12 }}>
                  <MemberStack members={visible} size={20} max={4} />
                  <span style={{ color: 'var(--ink-2)' }}>cooks with {visible.length - 1 || 'others'}</span>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
        {viewer === 'self' && <button className="mf-btn">edit profile</button>}
        {viewer === 'self' && <button className="mf-btn" title="Account settings — units, diet, privacy, notifications">⚙ settings</button>}
        {viewer === 'self' && <button className="mf-btn primary">📤 share recipe</button>}
        {viewer !== 'self' && <button className="mf-btn primary">＋ follow</button>}
      </div>

      <div style={{ padding: '4px 48px 24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24, alignItems: 'flex-start' }}>
        {/* LEFT — stats → recipes (featured) → badges (secondary) */}
        <div>
          {/* MEALS FED — compact: headline left, breakdown right */}
          <div className="mf-card" style={{ padding: '12px 16px', borderLeft: '3px solid var(--terracotta)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center' }}>
            <div>
              <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>MEALS FED</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="mf-display" style={{ fontSize: 54, color: 'var(--terracotta)', lineHeight: 0.9 }}>{fedTotal}</span>
                <span style={{ fontFamily: 'Caveat', fontSize: 16, color: 'var(--ink-3)' }}>portions</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {fedBreakdown.map(([n, l, sub]) => (
                <div key={l} title={sub}>
                  <div className="mf-display" style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>{n}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 14, borderLeft: '1px dashed var(--line)' }}>
              {sideStats.slice(0, 3).map(([n, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="mf-display" style={{ fontSize: 16, color: 'var(--ink)', minWidth: 24, textAlign: 'right' }}>{n}</span>
                  <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* tabs */}
          <div style={{ marginTop: 14, display: 'flex', gap: 16, borderBottom: '1px solid var(--line)' }}>
            {(viewer === 'self' ? ['Public', 'Household-shared', 'Friends-only', 'Private', 'Cooked'] : ['Public recipes', 'Public cookbooks', 'Recently cooked']).map((tab, i) => {
              const activeIdx = viewer === 'self' ? 1 : 0;
              return (
                <span key={tab} style={{ paddingBottom: 8, fontFamily: 'Kalam', fontSize: 14, color: i === activeIdx ? 'var(--ink)' : 'var(--ink-3)', borderBottom: i === activeIdx ? '2px solid var(--terracotta)' : '2px solid transparent', cursor: 'pointer', fontWeight: i === activeIdx ? 700 : 400 }}>{tab}</span>
              );
            })}
          </div>
          {viewer === 'self' && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(143,166,119,0.10)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)' }}>
              <span style={{ fontSize: 14 }}>🏠</span>
              <span><b>12 recipes</b> visible to {HH_NAME}. Each recipe & cookbook has 4 visibility levels: private · household · friends · public.</span>
              <button className="mf-btn ghost sm" style={{ marginLeft: 'auto', fontSize: 11 }}>📤 share with friends</button>
            </div>
          )}

          {/* RECIPES — the featured grid (the thing people actually share) */}
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {RECIPES.slice(0, 6).map(r => (
              <div key={r.id} className="mf-card">
                <FoodPhoto palette={r.palette} glyph={r.glyph} style={{ height: 110 }} />
                <div style={{ padding: '8px 10px' }}>
                  <div className="mf-display" style={{ fontSize: 18 }}>{r.title}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{r.cuisine.toLowerCase()} · {r.total}</span>
                    {viewer === 'self' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>🏠 {HH_NAME.split(' ')[0].toLowerCase()}</span>}
                    {viewer !== 'self' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>🌐</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* BADGES — secondary, below the recipes */}
          <div style={{ marginTop: 18, padding: '12px 16px', background: 'var(--paper-warm)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>BADGES · 7 / 18</span>
                <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>fun, not the main event</span>
              </div>
              <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>tap for the story →</span>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
              {badgesEarned.map(b => <div key={b.name} style={{ flex: '0 0 100px' }}><Badge b={b} /></div>)}
              {badgesInProgress.map(b => (
                <div key={b.name} style={{ flex: '0 0 100px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--paper)', border: '1.5px dashed var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, opacity: 0.5, position: 'relative' }}>
                    {b.ic}
                    <svg width="60" height="60" style={{ position: 'absolute', inset: -2, transform: 'rotate(-90deg)' }}>
                      <circle cx="30" cy="30" r="27" fill="none" stroke="var(--terracotta)" strokeWidth="2" strokeDasharray={`${(b.pct/100) * 169.6} 169.6`} strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="mf-display" style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1, textAlign: 'center' }}>{b.name}</div>
                  <div className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>{b.pct}%</div>
                </div>
              ))}
              <div style={{ flex: '0 0 100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--paper)', border: '1.5px dashed var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--ink-3)' }}>🔒</div>
                <div className="mf-display" style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1 }}>{badgesLocked} locked</div>
                <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>keep cooking</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — household card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cardVisible ? (
            <div className="mf-card" style={{ padding: 16, borderLeft: '3px solid var(--terracotta)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>HOUSEHOLD</span>
                <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>
                  {viewer === 'self' && 'visibility: per-member · your settings ↗'}
                  {viewer === 'member' && 'you\'re also in this household'}
                  {viewer === 'outsider' && 'public members only'}
                </span>
              </div>
              <div className="mf-display" style={{ fontSize: 30, lineHeight: 1, marginTop: 4 }}>{HH_NAME}</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2 }}>
                {viewer === 'outsider'
                  ? `${visible.length} public · ${all.length - visible.length} private`
                  : `${all.length} people · you're the owner`}
              </div>

              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visible.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <MemberDot m={m} size={28} ring you={m.you} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.1 }}>
                        {m.name} {m.you && <span className="mf-mono" style={{ color: 'var(--terracotta)', marginLeft: 4 }}>you</span>}
                        {m.role === 'owner' && !m.you && <span className="mf-mono" style={{ color: 'var(--ink-3)', marginLeft: 4 }}>owner</span>}
                        {m.role === 'guest' && <span className="mf-mono" style={{ color: '#5A4882', marginLeft: 4 }}>guest</span>}
                      </div>
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{m.diet}</div>
                    </div>
                    {viewer !== 'outsider' && (
                      <span className="mf-mono" style={{ fontSize: 9, color: m.householdPublic ? 'var(--sage)' : 'var(--ink-3)' }} title={m.householdPublic ? 'shown on their public profile' : 'private — only household sees them'}>
                        {m.householdPublic ? '🌐 public' : '🔒 private'}
                      </span>
                    )}
                  </div>
                ))}
                {viewer === 'outsider' && all.length - visible.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', opacity: 0.6 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--paper-warm)', border: '1.25px dashed var(--ink-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, color: 'var(--ink-3)' }}>+{all.length - visible.length}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-3)' }}>+ {all.length - visible.length} more</div>
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>private — visible only to household</div>
                    </div>
                  </div>
                )}
              </div>

              {viewer === 'self' && (
                <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--paper-warm)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>
                  visible to the household: <b>pantry · freezer · shopping · meal plan</b>. Recipes & cookbooks are per-item.
                </div>
              )}

              {viewer === 'self' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                  <button className="mf-btn sm" style={{ flex: 1 }}>＋ invite</button>
                  <button className="mf-btn ghost sm">manage →</button>
                </div>
              )}
            </div>
          ) : (
            <div className="mf-card" style={{ padding: 16, opacity: 0.7, borderStyle: 'dashed' }}>
              <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>HOUSEHOLD · PRIVATE</span>
              <div style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
                Robbie hasn't made their household membership public.
              </div>
            </div>
          )}

          {/* YOUR visibility control — only on your own profile */}
          {viewer === 'self' && (
            <div className="mf-card" style={{ padding: 14, borderColor: 'var(--ink)', borderWidth: 1.5 }}>
              <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>YOUR HOUSEHOLD VISIBILITY</span>
              <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>controls how YOU appear when others view this profile</div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['🔒', 'private', 'Robbie\'s household stays hidden to non-members.', false],
                  ['🌐', 'public',  'others see "Robbie cooks with {public members}" + a public-only roster.', true],
                ].map(([ic, k, sub, on]) => (
                  <label key={k} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid ' + (on ? 'var(--terracotta)' : 'var(--line)'), background: on ? 'rgba(200,105,60,0.06)' : 'transparent', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--ink)', background: on ? 'var(--terracotta)' : 'transparent', flexShrink: 0, marginTop: 2 }}></span>
                    <span style={{ fontSize: 16 }}>{ic}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Kalam', fontSize: 14, fontWeight: 700 }}>{k}</div>
                      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--paper-warm)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>
                <b>members of your household always see everyone</b>, regardless of this setting. This only controls what outsiders see on your public profile.
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 32 }}></div>
    </div>
  );
}

window.MidProfileWithHousehold = MidProfileWithHousehold;

// ── Badges ────────────────────────────────────────────────────
function Badge({ b }) {
  const toneBg = {
    butter:  'linear-gradient(135deg, #F5C764 0%, #E2A040 100%)',
    sage:    'linear-gradient(135deg, #9DAE7A 0%, #506B3F 100%)',
    terra:   'linear-gradient(135deg, #C8693C 0%, #7E2D1F 100%)',
    berry:   'linear-gradient(135deg, #99394A 0%, #5A1E2A 100%)',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4, cursor: 'pointer' }} title={b.sub}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: toneBg[b.tone] || toneBg.butter,
        border: '2px solid var(--ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, boxShadow: 'var(--shadow)',
        position: 'relative',
      }}>
        <span style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }}>{b.ic}</span>
        {/* subtle stitched ring */}
        <span style={{ position: 'absolute', inset: 3, borderRadius: '50%', border: '1px dashed rgba(255,246,224,0.5)' }}></span>
      </div>
      <div className="mf-display" style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1 }}>{b.name}</div>
      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 8, lineHeight: 1.2 }}>{b.sub}</div>
    </div>
  );
}

function BadgeProgress({ b }) {
  return (
    <div style={{ padding: '8px 10px', background: 'var(--paper-warm)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }} title={b.sub}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--paper)', border: '1.5px dashed var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, opacity: 0.6, flexShrink: 0 }}>{b.ic}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mf-display" style={{ fontSize: 15, lineHeight: 1 }}>{b.name}</div>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{b.sub}</div>
        <div style={{ marginTop: 4, height: 4, background: 'rgba(31,26,20,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: b.pct + '%', height: '100%', background: 'var(--terracotta)' }}></div>
        </div>
      </div>
      <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 10 }}>{b.pct}%</span>
    </div>
  );
}

window.Badge = Badge; window.BadgeProgress = BadgeProgress;

// ── Badge Story Sheet — opens when you tap a badge ───────────
// Shows: when earned, how it was earned, the contributing meals/people,
// and a one-tap "share this win" CTA. Designed as a modal sheet so it
// works equally on desktop click and mobile tap.
function BadgeStorySheet({ b }) {
  const toneBg = {
    butter:  'linear-gradient(135deg, #F5C764 0%, #E2A040 100%)',
    sage:    'linear-gradient(135deg, #9DAE7A 0%, #506B3F 100%)',
    terra:   'linear-gradient(135deg, #C8693C 0%, #7E2D1F 100%)',
  };
  return (
    <div className="mf mf-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(31,26,20,0.55)' }}></div>
      <div className="mf-card" style={{ position: 'relative', width: 'min(560px, 100%)', padding: 0, overflow: 'hidden', borderColor: 'var(--ink)', borderWidth: 2 }}>
        {/* big top — the badge in glory */}
        <div style={{ padding: '24px 24px 14px', textAlign: 'center', background: 'var(--paper-warm)', position: 'relative' }}>
          <button className="mf-btn ghost sm" style={{ position: 'absolute', top: 10, right: 10, fontSize: 14 }}>×</button>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: toneBg[b.tone] || toneBg.butter,
            border: '3px solid var(--ink)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 44, boxShadow: '0 12px 24px rgba(31,26,20,0.18)',
            position: 'relative',
          }}>
            <span style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.25))' }}>{b.ic}</span>
            <span style={{ position: 'absolute', inset: 5, borderRadius: '50%', border: '1.5px dashed rgba(255,246,224,0.55)' }}></span>
          </div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 10 }}>EARNED · 14 MAY 2026</div>
          <div className="mf-display" style={{ fontSize: 40, lineHeight: 1, marginTop: 4 }}>{b.title}</div>
          <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, maxWidth: 380, margin: '4px auto 0' }}>
            {b.tagline}
          </div>
        </div>

        {/* body */}
        <div style={{ padding: '14px 22px 18px' }}>
          {/* the criterion */}
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>HOW YOU EARNED IT</div>
          <div style={{ marginTop: 4, padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 13 }}>
            {b.criterion}
          </div>

          {/* contributing meals / people */}
          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>HIGHLIGHTS</div>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {b.highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: 'var(--paper-warm)' }}>
                <span style={{ width: 26, height: 26, borderRadius: 4, background: `linear-gradient(135deg, ${h.palette[0]}, ${h.palette[1]})`, position: 'relative', flexShrink: 0 }}>{h.glyph && <FoodGlyph kind={h.glyph} size={18} />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Kalam', fontSize: 13, lineHeight: 1.1 }}>{h.name}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{h.when}</div>
                </div>
                <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>{h.count}</span>
              </div>
            ))}
          </div>

          {/* progress chart — sparkline-ish */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>PROGRESS · LAST 12 WEEKS</span>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>{b.unit}</span>
          </div>
          <div style={{ marginTop: 4, padding: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
            {[6, 9, 8, 11, 10, 14, 12, 16, 18, 20, 22, 24].map((v, i) => (
              <div key={i} style={{ flex: 1, height: v * 1.7, background: i === 11 ? 'var(--terracotta)' : 'var(--ink-4)', borderRadius: 2, transition: 'background .15s' }}></div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="mf-btn primary" style={{ flex: 1 }}>📤 share this win</button>
            <button className="mf-btn">view all badges</button>
          </div>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 6, textAlign: 'center' }}>shared to your profile + activity feed (if your household is public)</div>
        </div>
      </div>
    </div>
  );
}
window.BadgeStorySheet = BadgeStorySheet;

const FEEDER_STORY = {
  ic: '🍴', tone: 'butter', title: 'The Feeder',
  tagline: 'You\'ve put plates in front of people 200+ times. That\'s a lot of forks.',
  criterion: 'Cook & serve 200 meal-portions to anyone — yourself, household, fresh or from your freezer. Now: 238 portions and counting.',
  unit: 'portions / week',
  highlights: [
    { name: 'Chicken & Chorizo Pasta Bake',  when: 'cooked ×7 · fed 24 people fresh',          count: '×7', palette: ['#D67C42','#7E2D1F'], glyph: 'pasta' },
    { name: 'Quesadillas',                    when: '2 leftover portions eaten by Jamie · Thu', count: '×4', palette: ['#E2A040','#8B4A1E'], glyph: 'tortilla' },
    { name: 'Slow Cooker Mexican',            when: 'shared 4 frozen portions with Ellie',     count: '×3', palette: ['#B5462E','#5C1A0F'], glyph: 'pot' },
  ],
};
window.FEEDER_STORY = FEEDER_STORY;
