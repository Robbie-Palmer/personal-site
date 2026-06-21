// mid-fi/provenance.jsx — recipe lineage / provenance.
//
// MODEL
// ─────
// Every recipe is a node in a DAG. Each carries:
//   id · title · author · version · created · edited · cooks · forks
//   origin: one of { external (URL · book · scan · typed), internal (parent recipe id) }
//   parent: nullable — recipe this was forked from
//
// Lifecycle:
//   ingest  →  external origin captured (URL/photo/typed/"from @friend"), recipe v1.0 created
//   edit    →  threshold-based: tiny tweaks bump minor version (1.0 → 1.1);
//              material changes prompt "save in place" vs "fork as new branch"
//   fork    →  new recipe with parent set; author becomes you; lineage preserved
//   cook    →  increments cooks counter on the exact version you cooked
//
// Attribution: every node up the tree retains credit. "Cooked from Robbie's
// fork of Ellie's vegetarian fork of Mum's chorizo bake" — clickable chain.
//
// Privacy: a fork inherits YOUR default visibility, not the parent's. Lineage
// pointers stay even if a parent is private — the child can still show "forked
// from a private recipe by @ellie" without revealing the parent contents.

// ── DEMO LINEAGE for Chorizo Pasta Bake ─────────────────────
// External origin → Mum's typed version → Robbie's edits → fan-out into Ellie's
// vegetarian fork, Jamie's low-FODMAP fork, and a few downstream cooks of yours.
const LINEAGE_NODES = [
  { id: 'src',  kind: 'external', label: 'BBC Good Food', sub: 'bbcgoodfood.com/chorizo-pasta-bake', icon: '🌐', x: 1, y: 0 },
  { id: 'v100', kind: 'internal', label: "Mum's Chorizo Pasta",     author: 'Mum',    version: '1.0', when: 'Mar 2022', cooks: 31, palette: ['#D67C42','#7E2D1F'], glyph: 'pasta', x: 1, y: 1, note: 'typed from the website, slightly halved' },
  { id: 'v110', kind: 'internal', label: 'Chorizo Pasta · Robbie',  author: 'Robbie', version: '1.1', when: 'Jul 2023', cooks: 18, palette: ['#D67C42','#7E2D1F'], glyph: 'pasta', parent: 'v100', x: 1, y: 2, note: '+chorizo, +oregano' },
  { id: 'v120', kind: 'internal', label: 'Chicken & Chorizo Bake',  author: 'Robbie', version: '1.2', when: 'Feb 2024', cooks: 23, palette: ['#D67C42','#7E2D1F'], glyph: 'pasta', parent: 'v110', x: 1, y: 3, note: 'scaled to 4 · added basil · weeknight version', here: true },
  { id: 'v200', kind: 'internal', label: 'Halloumi Pasta Bake',     author: 'Ellie',  version: '2.0', when: 'May 2024', cooks: 8,  palette: ['#C8553D','#7E3326'], glyph: 'pasta', parent: 'v120', x: 0, y: 4, note: 'chicken → halloumi · veggie fork' },
  { id: 'v121', kind: 'internal', label: 'Low-FODMAP Pasta Bake',   author: 'Jamie',  version: '1.2.1', when: 'Aug 2024', cooks: 4, palette: ['#C8693C','#742A18'], glyph: 'pasta', parent: 'v120', x: 2, y: 4, note: 'garlic → garlic oil · low-FODMAP fork' },
  { id: 'v201', kind: 'internal', label: 'Halloumi Pasta · Sarah',  author: '@sarah', version: '2.1', when: 'Oct 2024', cooks: 3,  palette: ['#9DAE7A','#506B3F'], glyph: 'pasta', parent: 'v200', x: 0, y: 5, note: 'public fork · added courgette' },
];

const HERE_ID = 'v120';

function authorDot(author) {
  // map a few names to consistent colors
  const map = {
    'Mum':    { bg: '#B8AED1', col: '#3A2E58' },
    'Robbie': { bg: '#F5C764', col: '#A04F26' },
    'Ellie':  { bg: '#8FA677', col: '#FFFEF8' },
    'Jamie':  { bg: '#C8693C', col: '#FFFEF8' },
    '@sarah': { bg: '#99394A', col: '#FFFEF8' },
  };
  return map[author] || { bg: 'var(--paper-warm)', col: 'var(--ink)' };
}

function Stat({ n, l, sub, tone }) {
  const toneCol = {
    sage:   'var(--sage)',
    terra:  'var(--terracotta)',
    butter: 'var(--terracotta-deep)',
  }[tone] || 'var(--ink)';
  return (
    <div title={sub} style={{ padding: '8px 10px', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--line)' }}>
      <div className="mf-display" style={{ fontSize: 24, color: toneCol, lineHeight: 1 }}>{n}</div>
      <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2 }}>{l}</div>
      <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, marginTop: 2, fontStyle: 'italic' }}>{sub}</div>
    </div>
  );
}

function AuthorChip({ name, size = 18 }) {
  const c = authorDot(name);
  const initial = (name || '?').replace(/[@\s]/g, '')[0];
  return (
    <span title={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px 1px 1px', borderRadius: 999, background: 'var(--paper-warm)', border: '1px solid var(--line-strong)', fontFamily: 'Kalam', fontSize: size > 14 ? 12 : 11 }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: c.bg, color: c.col, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: size * 0.65, border: '1px solid rgba(31,26,20,0.35)' }}>{initial}</span>
      <span>{name}</span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// 11 · README · the lineage model
// ──────────────────────────────────────────────────────────────
function ProvenanceReadme() {
  return (
    <div style={{ padding: 32, height: '100%', background: '#FAF3E2', fontFamily: 'Kalam', boxSizing: 'border-box', overflow: 'auto' }}>
      <div style={{ fontFamily: 'Caveat', fontSize: 48, lineHeight: 1, color: '#1F1A14' }}>recipe lineage.</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: '#4D4337', maxWidth: 700 }}>
        A recipe is a <b>living thing</b> — it travels. You ingest it from somewhere, edit it for your kitchen, then someone else takes it and tweaks it further. The platform keeps the whole chain visible so credit, history, and "how this got here" stay intact.
      </div>

      <hr className="mf-rule" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <div>
          <div className="mf-mono" style={{ color: '#A04F26' }}>EVERY RECIPE HAS</div>
          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 13, lineHeight: 1.5, color: '#4D4337' }}>
            <li><b>an origin</b> — URL, scanned photo, cookbook citation, typed, or "from @friend"</li>
            <li><b>a version</b> — 1.0, 1.1, 1.2… bumped on edit; new majors when forked</li>
            <li><b>an author</b> — you, if you ingested or forked it</li>
            <li><b>a parent</b> — the recipe it was forked from (if any)</li>
            <li><b>cook count</b> — how many times THIS exact version has been cooked</li>
            <li><b>fork count</b> — how many people have built on it</li>
          </ul>
        </div>
        <div>
          <div className="mf-mono" style={{ color: '#A04F26' }}>EDIT vs FORK</div>
          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 13, lineHeight: 1.5, color: '#4D4337' }}>
            <li><b>Tiny tweak</b> (typos, notes, rating) → bumps minor version silently</li>
            <li><b>Material change</b> (ingredient swap, step rewrite, scale) → we ask: <i>save in place as v1.2, or fork as a new branch?</i></li>
            <li><b>Forking someone else's</b> always creates a new branch — never overwrites</li>
            <li>Detection is automatic, but you always get final say</li>
          </ul>
        </div>
      </div>

      <hr className="mf-rule" />

      <div className="mf-mono" style={{ color: '#A04F26' }}>THE QUESTION EVERY EDIT ANSWERS</div>
      <div style={{ marginTop: 8, padding: 14, background: '#F4ECD6', borderRadius: 10, border: '1.5px solid #1F1A14' }}>
        <div style={{ fontFamily: 'Caveat', fontSize: 30, color: '#1F1A14', lineHeight: 1 }}>do you want <span style={{ color: '#A04F26' }}>one recipe</span>, or <span style={{ color: '#A04F26' }}>two?</span></div>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: 10, borderRadius: 8, background: '#FFFEF8', border: '1px solid rgba(31,26,20,0.12)' }}>
            <div style={{ fontFamily: 'Caveat', fontSize: 22, color: '#A04F26' }}>↑ refine</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>same recipe, better now</div>
            <div className="mf-mono" style={{ color: '#8B7C66', fontSize: 9, marginTop: 4 }}>v1.2 → v1.3 · old version replaced · "I figured out it's better with more basil"</div>
          </div>
          <div style={{ padding: 10, borderRadius: 8, background: '#FFFEF8', border: '1px solid rgba(31,26,20,0.12)' }}>
            <div style={{ fontFamily: 'Caveat', fontSize: 22, color: '#A04F26' }}>🌱 branch</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>two recipes living side-by-side</div>
            <div className="mf-mono" style={{ color: '#8B7C66', fontSize: 9, marginTop: 4 }}>v1.2 stays · v2.0 starts a new branch · "I want chicken AND halloumi in my box"</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#4D4337', lineHeight: 1.5 }}>
          Editing <b>your own recipe</b>: small change → silent refine. Material change → we ask. Editing <b>someone else's recipe</b>: <i>always</i> a branch on your side (their version is untouched). The only exception is <b>↗ suggest upstream</b>, which is a review-style fix that needs the author's accept.
        </div>
      </div>

      <hr className="mf-rule" />

      <div className="mf-mono" style={{ color: '#A04F26' }}>THE THREE EDIT MODES</div>
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { ic: '↑', k: 'refine',         v: 'v1.2 → v1.3', sub: 'your recipe, better. Replaces previous version. Auto-applied for small tweaks; we ask for material changes.' },
          { ic: '↗', k: 'suggest upstream', v: 'review-style', sub: "small fix on someone else's recipe → they accept/reject · accepted fixes ship with 'suggested by you' credit" },
          { ic: '🌱', k: 'branch / fork', v: 'v1.2 + v2.0',  sub: 'keep both versions · attribution preserved up the tree · all edits to others\' recipes start here' },
        ].map(c => (
          <div key={c.k} style={{ padding: 10, background: '#F4ECD6', borderRadius: 8, border: '1px solid rgba(31,26,20,0.12)' }}>
            <div style={{ fontFamily: 'Caveat', fontSize: 26, color: '#A04F26', lineHeight: 1 }}>{c.ic} {c.k}</div>
            <div className="mf-mono" style={{ color: '#8B7C66', fontSize: 9, marginTop: 4 }}>{c.v}</div>
            <div style={{ fontSize: 12, color: '#4D4337', marginTop: 4, lineHeight: 1.35 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="mf-mono" style={{ color: '#8B7C66', marginTop: 6, fontStyle: 'italic' }}>
        we don't have a "private notes" mode. If something's worth saying, it's worth saying out loud — the app is about distributing fixes, not hoarding them.
      </div>

      <hr className="mf-rule" />

      <div className="mf-mono" style={{ color: '#A04F26' }}>WORKFLOWS</div>
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          ['🌐 ingest',  'detection-first', 'URL & barcode auto-detected · only ask for photo/typed origins'],
          ['↑ in-place', 'tweak your copy', "tiny → silent · material → prompt to fork"],
          ['↗ suggest', 'help upstream', 'spot a typo? send a fix to the author · they review'],
          ['🌱 fork',    'branch & remix', 'new branch · attribution all the way up'],
        ].map(([k, l, sub]) => (
          <div key={k} style={{ padding: 10, background: '#F4ECD6', borderRadius: 8, border: '1px solid rgba(31,26,20,0.12)' }}>
            <div style={{ fontFamily: 'Caveat', fontSize: 22, color: '#A04F26' }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{l}</div>
            <div className="mf-mono" style={{ color: '#8B7C66', fontSize: 9, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      <hr className="mf-rule" />

      <div className="mf-mono" style={{ color: '#A04F26' }}>EDGE CASES · DECIDED</div>
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12.5, color: '#4D4337', lineHeight: 1.5 }}>
        <div>· <b>Private parent</b>: child shows "forked from a private recipe by @ellie" — no parent content leaked</div>
        <div>· <b>External SEO credit</b>: BBC URL stays as a permanent root + outbound link on every descendant recipe — sends real clicks back to the original site</div>
        <div>· <b>Cross-household forks</b>: when @ellie forks your private recipe, her fork is visible to anyone who can see <i>her</i> version. Your "forks downstream" count includes it regardless — credit follows the chain even when content doesn't.</div>
        <div>· <b>Deleting a parent</b>: tombstone node with "this version is gone, but credit remains"</div>
        <div>· <b>Suggestions vs forks</b>: suggestions are review-style fixes (small, accepted into parent); forks are derivatives (branched). If author rejects, suggester can still fork.</div>
        <div>· <b>Cooked count</b>: increments per version cooked; aggregate "tree cooks" is shown separately. Cooks without forking still count toward an author's TV-Cook badge.</div>
      </div>

      <hr className="mf-rule" />

      <div className="mf-mono" style={{ color: '#A04F26' }}>STAY IN SYNC · WHEN UPSTREAM UPDATES</div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#4D4337', lineHeight: 1.5 }}>
        When your <i>parent</i> recipe refines (v1.2 → v1.3), your fork gets a soft nudge: <b>"upstream has updates — pull in?"</b> See the diff, cherry-pick individual changes, or dismiss. Branches don't auto-merge — but you always know what's new and can borrow what you like.
      </div>

      <hr className="mf-rule" />

      <div className="mf-mono" style={{ color: '#A04F26' }}>SOCIAL PROOF · NO STAR RATINGS</div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#4D4337', lineHeight: 1.5, maxWidth: 740 }}>
        Star ratings are vibes. Behavior is data. Every recipe page shows what people <i>actually did</i>: how many cooked it, how many came back to cook it again, real cook-time medians, downstream forks, frozen-portion counts, plans for this week. Ratings can't be left without cooking — we use the lineage tree as the trust layer.
      </div>

      <hr className="mf-rule" />

      <div className="mf-mono" style={{ color: '#A04F26' }}>WHAT THIS UNLOCKS</div>
      <div style={{ marginTop: 6, fontSize: 13, color: '#4D4337', lineHeight: 1.5 }}>
        Every cook becomes part of a chain. <b>📺 TV Cook</b> badge (50+ strangers cooked your recipes) reads off downstream cooks. <b>✂️ Fuss Pot</b> badge (20+ forks of others' recipes) reads off your edit-from-parent activity. Cookbooks can showcase a recipe AND its best-known fork. The "scan" flow always captures origin honestly. Sharing always carries attribution back to the people who made the dish.
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#F4ECD6', borderRadius: 8, fontFamily: 'Caveat', fontSize: 20, color: '#A04F26' }}>
        keep scrolling ↓ — recipe page lineage chip · full tree · fork-and-diff · ingest with origin
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 11a · Recipe page · lineage chip + panel inline
// ──────────────────────────────────────────────────────────────
function RecipeWithLineage() {
  return (
    <div className="mf mf-page">
      <Nav active="recipes" />
      <div style={{ padding: '28px 48px 12px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28, alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>RECIPE · ITALIAN · ONE-POT</div>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>·</span>
            {/* Inline lineage chip — always visible on every recipe */}
            <span className="mf-mono" style={{ color: 'var(--ink-2)' }}>
              v1.2 ·
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>
              by <AuthorChip name="Robbie" /> · from <AuthorChip name="Mum" /> · originally
              <span title="bbcgoodfood.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px 1px 4px', borderRadius: 999, background: 'var(--paper-warm)', border: '1px solid var(--line-strong)' }}>
                🌐 <span>BBC Good Food</span>
              </span>
            </span>
            <span className="mf-mono" style={{ color: 'var(--terracotta)', cursor: 'pointer' }}>see lineage ⌥</span>
          </div>

          <h1 className="mf-display" style={{ fontSize: 60, margin: '6px 0 0', lineHeight: 0.95 }}>
            Chicken & <span style={{ color: 'var(--terracotta)' }}>Chorizo</span> Pasta Bake
          </h1>
          <div className="mf-body" style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 6, maxWidth: 540 }}>
            Mum's chorizo upgrade of the BBC weeknight bake. Scaled for 4 with basil. The whole household keeps coming back to this one.
          </div>

          {/* SEO credit banner — outbound link back to origin */}
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--paper-warm)', border: '1px dashed var(--line-strong)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Kalam', fontSize: 12 }}>
            <span style={{ fontSize: 16 }}>🌐</span>
            <span style={{ flex: 1, color: 'var(--ink-2)' }}>
              originally <b>BBC Good Food</b> · <a href="#" style={{ color: 'var(--terracotta-deep)', textDecoration: 'underline' }}>read the source recipe ↗</a>
            </span>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>1.2k clicks sent · this month</span>
          </div>

          {/* SOCIAL PROOF — behavioral stats, no stars */}
          <div className="mf-card" style={{ marginTop: 12, padding: '12px 14px', borderLeft: '3px solid var(--sage)', background: 'rgba(143,166,119,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>HONEST SIGNAL · NO STARS</span>
              <span className="mf-mono" style={{ color: 'var(--ink-3)' }} title="we don't ask people to rate recipes. We tell you what people actually did with them.">why no stars? ⓘ</span>
            </div>
            <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <Stat n="341" l="times cooked" sub="across 7 tree versions" />
              <Stat n="89"  l="people cooked it" sub="unique cooks lifetime" />
              <Stat n="62%" l="cooked again" sub="repeat-cook rate · 30d" tone="terra" />
              <Stat n="8"   l="downstream forks" sub="active branches in the tree" />
              <Stat n="+24" l="cooks this week" sub="trending — top 5% momentum" tone="sage" />
              <Stat n="65m" l="real cook time" sub="vs 55m stated · honest median" />
              <Stat n="×34" l="frozen for later" sub="leftover-friendly · low waste" />
              <Stat n="47"  l="on plans this week" sub="being shopped right now" tone="butter" />
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: 9 }}>
              behavior beats opinion · only people who actually cooked it count · ratings can't be left without cooking
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="mf-btn primary">🔥 start cooking</button>
            <button className="mf-btn">🌱 fork & edit</button>
            <button className="mf-btn ghost">↗ suggest a fix</button>
            <button className="mf-btn ghost">📤 share</button>
            <button className="mf-btn ghost">＋ add to plan</button>
          </div>

          <div style={{ marginTop: 18, padding: 14, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>INGREDIENTS · SERVES 4</div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {INGREDIENTS.slice(0, 8).map(i => (
                <div key={i} style={{ padding: '3px 0', fontFamily: 'Kalam', fontSize: 13, borderBottom: '1px dashed var(--line)' }}>· {i}</div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — lineage compact panel + adoption stats */}
        <div>
          <div className="mf-card" style={{ padding: 14, borderLeft: '3px solid var(--terracotta)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>LINEAGE · COMPACT</span>
              <span className="mf-mono" style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>see full tree →</span>
            </div>

            {/* the chain — top to bottom */}
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
              {[
                { kind: 'external', label: 'BBC Good Food', sub: 'bbcgoodfood.com', icon: '🌐' },
                { kind: 'internal', label: "Mum's Chorizo Pasta",     v: '1.0', author: 'Mum',    when: 'Mar 2022', cooks: 31, change: 'typed from the site, halved' },
                { kind: 'internal', label: "Chorizo Pasta · Robbie",  v: '1.1', author: 'Robbie', when: 'Jul 2023', cooks: 18, change: '+chorizo, +oregano' },
                { kind: 'internal', label: "Chicken & Chorizo Bake",  v: '1.2', author: 'Robbie', when: 'Feb 2024', cooks: 23, change: 'scaled to 4, +basil', here: true },
              ].map((n, i, arr) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  {/* rail */}
                  <div style={{ width: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{
                      width: n.here ? 14 : 10, height: n.here ? 14 : 10, borderRadius: '50%',
                      background: n.here ? 'var(--terracotta)' : n.kind === 'external' ? 'transparent' : 'var(--ink)',
                      border: n.here ? '2px solid var(--ink)' : n.kind === 'external' ? '1.5px dashed var(--ink-3)' : '1.5px solid var(--ink)',
                      marginTop: 6, flexShrink: 0,
                    }}></span>
                    {i < arr.length - 1 && <span style={{ flex: 1, width: 1.5, background: 'var(--line-strong)', marginTop: 2 }}></span>}
                  </div>
                  {/* node */}
                  <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 10 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {n.kind === 'external' ? (
                        <React.Fragment>
                          <span style={{ fontFamily: 'Kalam', fontSize: 13 }}>{n.icon} <b>{n.label}</b></span>
                          <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>{n.sub}</span>
                        </React.Fragment>
                      ) : (
                        <React.Fragment>
                          <span style={{ fontFamily: 'Kalam', fontSize: 13, fontWeight: n.here ? 700 : 400 }}>{n.label}</span>
                          {n.here && <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>YOU ARE HERE</span>}
                        </React.Fragment>
                      )}
                    </div>
                    {n.kind === 'internal' && (
                      <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-3)' }}>
                        <AuthorChip name={n.author} size={14} />
                        <span>v{n.v}</span>
                        <span>·</span>
                        <span>{n.when}</span>
                        <span>·</span>
                        <span>🍴 {n.cooks}</span>
                      </div>
                    )}
                    {n.change && <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2, fontStyle: 'italic' }}>{n.change}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 10 }}>FORKS FROM YOUR v1.2</div>
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { name: 'Halloumi Pasta Bake',   author: 'Ellie', v: '2.0', when: 'May 2024', cooks: 8, change: 'chicken → halloumi' },
                { name: 'Low-FODMAP Pasta Bake', author: 'Jamie', v: '1.2.1', when: 'Aug 2024', cooks: 4, change: 'garlic → garlic oil' },
              ].map((f, i) => (
                <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--paper-warm)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--terracotta)' }}></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Kalam', fontSize: 12 }}>{f.name}</div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 1, fontFamily: 'Kalam', fontSize: 10, color: 'var(--ink-3)' }}>
                      <AuthorChip name={f.author} size={12} />
                      <span>v{f.v} · {f.when} · 🍴 {f.cooks}</span>
                    </div>
                  </div>
                  <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, fontStyle: 'italic' }}>{f.change}</span>
                </div>
              ))}
            </div>
          </div>

          {/* adoption stats */}
          <div className="mf-card" style={{ padding: 14, marginTop: 12 }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>YOUR ADOPTION · THIS RECIPE</span>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                ['23', 'cooks of yours'],
                ['12', 'forks of yours'],
                ['68', 'cooks downstream'],
              ].map(([n, l]) => (
                <div key={l} style={{ padding: '8px 10px', background: 'var(--paper-warm)', borderRadius: 8 }}>
                  <div className="mf-display" style={{ fontSize: 22, color: 'var(--terracotta)', lineHeight: 1 }}>{n}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: 9 }}>📺 cooks downstream count toward your <b>TV Cook</b> badge.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 11b · Full lineage tree view
// ──────────────────────────────────────────────────────────────
function LineageTree() {
  const cellW = 220, cellH = 90, gapX = 24, gapY = 56;
  const maxX = Math.max(...LINEAGE_NODES.map(n => n.x));
  const maxY = Math.max(...LINEAGE_NODES.map(n => n.y));
  const W = (maxX + 1) * cellW + maxX * gapX;
  const H = (maxY + 1) * cellH + maxY * gapY;

  // helpers
  const pos = (n) => ({ left: n.x * (cellW + gapX), top: n.y * (cellH + gapY), w: cellW, h: cellH });
  const center = (n) => { const p = pos(n); return { x: p.left + p.w / 2, y: p.top + p.h / 2 }; };
  const byId = Object.fromEntries(LINEAGE_NODES.map(n => [n.id, n]));

  return (
    <div className="mf mf-page">
      <Nav active="recipes" />
      <div style={{ padding: '24px 48px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>LINEAGE · CHICKEN & CHORIZO PASTA BAKE</div>
          <h1 className="mf-display" style={{ fontSize: 48, margin: '4px 0 0' }}>where this <span style={{ color: 'var(--terracotta)' }}>came from.</span></h1>
          <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
            7 versions · 91 total cooks across the tree · 6 contributors · 2 active forks
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="mf-btn ghost sm">collapse minor versions</button>
          <button className="mf-btn ghost sm">show only forks</button>
          <button className="mf-btn primary sm">📤 share tree</button>
        </div>
      </div>

      <div style={{ padding: '14px 48px 40px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'flex-start' }}>
        {/* TREE */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 24, overflow: 'auto' }}>
          <div style={{ position: 'relative', width: W, height: H, margin: '0 auto' }}>
            {/* edges (SVG layer underneath nodes) */}
            <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {LINEAGE_NODES.filter(n => n.parent).map(child => {
                const parent = byId[child.parent];
                const c1 = center(parent), c2 = center(child);
                const dy = (c2.y - c1.y) / 2;
                const path = `M ${c1.x} ${c1.y + cellH/2} C ${c1.x} ${c1.y + cellH/2 + dy}, ${c2.x} ${c2.y - cellH/2 - dy}, ${c2.x} ${c2.y - cellH/2}`;
                return <path key={child.id} d={path} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />;
              })}
              {/* external → first internal */}
              {(() => {
                const ext = LINEAGE_NODES[0], first = LINEAGE_NODES[1];
                const c1 = center(ext), c2 = center(first);
                return <line key="ext" x1={c1.x} y1={c1.y + cellH/2} x2={c2.x} y2={c2.y - cellH/2} stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="4 4" />;
              })()}
            </svg>

            {LINEAGE_NODES.map(n => {
              const p = pos(n);
              if (n.kind === 'external') {
                return (
                  <div key={n.id} style={{ position: 'absolute', left: p.left, top: p.top, width: cellW, height: cellH, padding: 10, borderRadius: 10, border: '1.5px dashed var(--line-strong)', background: 'var(--paper-warm)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>EXTERNAL ORIGIN</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 18 }}>{n.icon}</span>
                      <span className="mf-display" style={{ fontSize: 18, lineHeight: 1 }}>{n.label}</span>
                    </div>
                    <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 4 }}>{n.sub}</span>
                  </div>
                );
              }
              const isHere = n.here;
              return (
                <div key={n.id} style={{
                  position: 'absolute', left: p.left, top: p.top, width: cellW, height: cellH,
                  padding: 8, borderRadius: 10,
                  background: 'var(--card)',
                  border: isHere ? '2px solid var(--terracotta)' : '1px solid var(--line-strong)',
                  boxShadow: isHere ? '0 6px 18px rgba(200,105,60,0.18)' : 'var(--shadow)',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 4, background: `linear-gradient(135deg, ${n.palette[0]}, ${n.palette[1]})`, position: 'relative', flexShrink: 0 }}><FoodGlyph kind={n.glyph} size={18} /></span>
                    <span className="mf-display" style={{ fontSize: 15, lineHeight: 1, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
                    {isHere && <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9, padding: '1px 6px', background: 'rgba(200,105,60,0.10)', borderRadius: 999 }}>HERE</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-2)' }}>
                    <AuthorChip name={n.author} size={14} />
                    <span>v{n.version}</span>
                    <span style={{ color: 'var(--ink-4)' }}>·</span>
                    <span>{n.when}</span>
                  </div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, fontStyle: 'italic' }}>{n.note}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                    <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>🍴 {n.cooks}</span>
                    <span style={{ flex: 1 }}></span>
                    <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9, cursor: 'pointer' }}>open ↗</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — totals + active node detail + contributors */}
        <div>
          <div className="mf-card" style={{ padding: 14 }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>TOTALS · ACROSS THE TREE</span>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                ['91',  'total cooks'],
                ['6',   'contributors'],
                ['7',   'versions'],
                ['2',   'active forks'],
              ].map(([n, l]) => (
                <div key={l} style={{ padding: '8px 10px', background: 'var(--paper-warm)', borderRadius: 8 }}>
                  <div className="mf-display" style={{ fontSize: 22, color: 'var(--terracotta)', lineHeight: 1 }}>{n}</div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mf-card" style={{ padding: 14, marginTop: 12, borderColor: 'var(--terracotta)', borderWidth: 1.5 }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>SELECTED · v1.2 · YOURS</span>
            <div className="mf-display" style={{ fontSize: 20, marginTop: 4, lineHeight: 1 }}>Chicken & Chorizo Bake</div>
            <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)' }}>scaled to 4 · added basil · weeknight version</div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 6 }}>CHANGES VS PARENT (v1.1)</div>
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'Kalam', fontSize: 12 }}>
              <div style={{ color: 'var(--sage)' }}>+ small bunch basil</div>
              <div style={{ color: 'var(--ink-2)' }}>~ pasta 200g → <b>300g</b></div>
              <div style={{ color: 'var(--ink-2)' }}>~ chicken 400g → <b>600g</b></div>
              <div style={{ color: 'var(--ink-2)' }}>~ serves 2 → <b>4</b></div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button className="mf-btn primary sm" style={{ flex: 1 }}>open this version</button>
              <button className="mf-btn ghost sm">fork →</button>
            </div>
          </div>

          <div className="mf-card" style={{ padding: 14, marginTop: 12 }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>CONTRIBUTORS</span>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['Mum', 'Robbie', 'Ellie', 'Jamie', '@sarah'].map(a => (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Kalam', fontSize: 12 }}>
                  <AuthorChip name={a} size={16} />
                  <span style={{ flex: 1, color: 'var(--ink-3)' }}>{LINEAGE_NODES.filter(n => n.author === a).length} version{LINEAGE_NODES.filter(n => n.author === a).length > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 11c · Fork & edit · diff view
// ──────────────────────────────────────────────────────────────
function ForkAndDiff() {
  return (
    <div className="mf mf-page">
      <Nav active="recipes" />
      <div style={{ padding: '24px 48px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>FORK & EDIT · DIFF VIEW</div>
          <h1 className="mf-display" style={{ fontSize: 44, margin: '4px 0 0' }}>making it <span style={{ color: 'var(--terracotta)' }}>yours.</span></h1>
          <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
            forked from <AuthorChip name="Robbie" /> · Chicken & Chorizo Bake v1.2 — see changes from parent live as you edit.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="mf-btn ghost">cancel</button>
          <button className="mf-btn primary">save as v2.0 → my recipes</button>
        </div>
      </div>

      {/* the fork prompt banner — explains the rules right at the top */}
      <div style={{ padding: '0 48px' }}>
        <div className="mf-card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: '3px solid var(--terracotta)' }}>
          <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>FORKING</span>
          <span style={{ fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', flex: 1 }}>
            attribution stays — Robbie's v1.2 will appear as your parent. Save when you're ready — your fork is private until you change visibility.
          </span>
          <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>visibility</span>
          <span className="mf-tag include" style={{ fontSize: 11 }}>🔒 private</span>
          <span className="mf-tag soft" style={{ fontSize: 11 }}>🏠 household</span>
          <span className="mf-tag soft" style={{ fontSize: 11 }}>👥 friends</span>
          <span className="mf-tag soft" style={{ fontSize: 11 }}>🌐 public</span>
        </div>
      </div>

      <div style={{ padding: '12px 48px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'flex-start' }}>
        {/* PARENT (read-only) */}
        <div className="mf-card" style={{ padding: 16, background: 'rgba(244,236,214,0.5)' }}>
          <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>PARENT · v1.2 BY ROBBIE · READ-ONLY</div>
          <div className="mf-display" style={{ fontSize: 26, marginTop: 4 }}>Chicken & Chorizo Bake</div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 10 }}>INGREDIENTS</div>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1, fontFamily: 'Kalam', fontSize: 13 }}>
            {[
              '300g farfalle',
              '600g chicken breast, chopped',
              '1 chorizo ring, sliced',
              '3 cloves garlic, crushed',
              '1 tin cherry tomatoes',
              '1 tin chopped tomatoes',
              'small bunch fresh basil',
              '2 tsp dried oregano',
              '75g light soft cheese',
              '150g mozzarella, chopped',
              '40g parmesan, grated',
            ].map(i => <div key={i} style={{ padding: '2px 0', borderBottom: '1px dashed var(--line)' }}>· {i}</div>)}
          </div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 10 }}>STEPS · 7</div>
          <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>
            1. Pre-heat to 200°C…  2. Cook pasta to al dente…  3. Render the chorizo…  4. Sear chicken…  5. Tomatoes + garlic…  6. Soft cheese, fold pasta…  7. Bake til bubbling.
          </div>
        </div>

        {/* YOUR FORK (editable) */}
        <div className="mf-card" style={{ padding: 16, borderColor: 'var(--terracotta)', borderWidth: 1.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>YOUR FORK · v2.0 · EDITABLE</div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>auto-saved · 12s ago</div>
          </div>
          <input defaultValue="Halloumi Pasta Bake (veggie)" style={{ marginTop: 4, padding: '4px 8px', width: '100%', boxSizing: 'border-box', fontFamily: 'Caveat', fontSize: 26, fontWeight: 600, border: '1.5px solid var(--ink)', borderRadius: 6, background: 'var(--card)' }} />

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 10 }}>INGREDIENTS · CHANGES SHOWN</div>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1, fontFamily: 'Kalam', fontSize: 13 }}>
            <DiffLine kind="kept">300g farfalle</DiffLine>
            <DiffLine kind="removed">600g chicken breast, chopped</DiffLine>
            <DiffLine kind="added">450g halloumi, cubed</DiffLine>
            <DiffLine kind="removed">1 chorizo ring, sliced</DiffLine>
            <DiffLine kind="added">1 jar roasted peppers, chopped</DiffLine>
            <DiffLine kind="modified" was="3 cloves garlic, crushed">2 cloves garlic, crushed</DiffLine>
            <DiffLine kind="kept">1 tin cherry tomatoes</DiffLine>
            <DiffLine kind="kept">1 tin chopped tomatoes</DiffLine>
            <DiffLine kind="kept">small bunch fresh basil</DiffLine>
            <DiffLine kind="kept">2 tsp dried oregano</DiffLine>
            <DiffLine kind="kept">75g light soft cheese</DiffLine>
            <DiffLine kind="kept">150g mozzarella, chopped</DiffLine>
            <DiffLine kind="kept">40g parmesan, grated</DiffLine>
            <DiffLine kind="added">handful of rocket to serve</DiffLine>
          </div>

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 10 }}>STEPS</div>
          <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>
            <DiffLine kind="modified" was="Render the chorizo…">Sear the halloumi until golden on all sides.</DiffLine>
            <DiffLine kind="modified" was="Sear chicken…">Tip in the peppers and warm through.</DiffLine>
            <DiffLine kind="kept">Tomatoes + garlic + oregano · simmer.</DiffLine>
            <DiffLine kind="kept">Soft cheese, fold pasta.</DiffLine>
            <DiffLine kind="added">Top with rocket once out of the oven.</DiffLine>
            <DiffLine kind="kept">Bake til bubbling.</DiffLine>
          </div>

          <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(143,166,119,0.10)', borderRadius: 8, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>
            <b>diff summary:</b> 4 added · 2 removed · 3 modified · 8 kept. Looks like a <b>material change</b> — saved as a fork (v2.0), not a refine.
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 11c-bonus · Suggest upstream — sender side + author inbox
// The "↗ suggest a fix" flow. Small fixes don't need a fork — they should
// flow back to the original author. Author reviews, accepts or rejects.
// Accepted suggestions ship as a refine on the author's branch with
// "suggested by you" credit on that version.
// ──────────────────────────────────────────────────────────────
function SuggestUpstream() {
  return (
    <div className="mf mf-page">
      <Nav active="recipes" />
      <div style={{ padding: '24px 48px 6px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SUGGEST UPSTREAM · REVIEW-STYLE FIXES</div>
        <h1 className="mf-display" style={{ fontSize: 44, margin: '4px 0 0' }}>send a fix <span style={{ color: 'var(--terracotta)' }}>up the chain.</span></h1>
        <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, maxWidth: 740 }}>
          Spotted a typo, a missing ingredient, a wrong oven temp? Send a fix to the author. They review and accept (or reject). Accepted fixes ship as a refine on their branch with your name on it — no fork needed.
        </div>
      </div>

      <div style={{ padding: '16px 48px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* LEFT — SENDER side */}
        <div className="mf-card" style={{ padding: 16, borderLeft: '3px solid var(--terracotta)' }}>
          <span className="mf-mono" style={{ color: 'var(--terracotta)', padding: '2px 8px', background: 'rgba(200,105,60,0.10)', borderRadius: 999, fontSize: 9 }}>SENDER · YOU</span>
          <div className="mf-display" style={{ fontSize: 24, marginTop: 6, lineHeight: 1 }}>cooking from <AuthorChip name="Ellie" />'s Halloumi Pasta Bake</div>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 4 }}>v2.0 · noticed mid-cook: oregano was missing from the ingredient list (but used in step 5)</div>

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>YOUR FIX · 1 CHANGE</div>
          <div style={{ marginTop: 4, padding: '8px 10px', background: 'var(--paper-warm)', borderRadius: 6 }}>
            <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>INGREDIENTS</div>
            <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 12.5 }}>
              <div style={{ padding: '2px 6px', background: 'rgba(143,166,119,0.12)', borderRadius: 4, color: 'var(--sage)' }}><b style={{ fontFamily: 'JetBrains Mono', fontSize: 11, marginRight: 6 }}>+</b>2 tsp dried oregano</div>
            </div>
          </div>

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>NOTE · OPTIONAL</div>
          <textarea defaultValue="Hi Ellie — step 5 says 'add the oregano' but it's not on the ingredient list! Cooked from yours tonight, was great otherwise."
            style={{ marginTop: 4, padding: '8px 10px', width: '100%', boxSizing: 'border-box', fontFamily: 'Kalam', fontSize: 13, border: '1px solid var(--line-strong)', borderRadius: 6, minHeight: 64, resize: 'none', background: 'var(--card)' }} />

          <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(143,166,119,0.10)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-2)' }}>
            small fix · auto-detected as a <b>suggestion</b>, not a fork. If Ellie accepts, her v2.1 ships with your name on it — and you get a ✂️ <b>Fuss Pot</b> credit.
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <button className="mf-btn primary" style={{ flex: 1 }}>↗ send to Ellie</button>
            <button className="mf-btn ghost">fork instead</button>
            <button className="mf-btn ghost">cancel</button>
          </div>
        </div>

        {/* RIGHT — AUTHOR'S INBOX */}
        <div className="mf-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)', padding: '2px 8px', background: 'rgba(200,105,60,0.10)', borderRadius: 999, fontSize: 9 }}>AUTHOR · ELLIE'S INBOX</span>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>3 pending · 14 accepted lifetime</span>
          </div>
          <div className="mf-display" style={{ fontSize: 22, marginTop: 6, lineHeight: 1 }}>suggestions on your recipes</div>

          {/* one expanded — the oregano fix */}
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--paper-warm)', border: '1.5px solid var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AuthorChip name="Robbie" size={18} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Kalam', fontSize: 13 }}>
                  <b>Robbie</b> suggested a fix on <b>Halloumi Pasta Bake v2.0</b>
                </div>
                <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>2h ago · 1 change</div>
              </div>
              <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>EXPANDED</span>
            </div>

            <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--card)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)', borderLeft: '2px solid var(--terracotta)' }}>
              "step 5 says 'add the oregano' but it's not on the ingredient list! Cooked from yours tonight, was great otherwise."
            </div>

            <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 10 }}>DIFF</div>
            <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 4, background: 'rgba(143,166,119,0.12)', fontFamily: 'Kalam', fontSize: 12.5, color: 'var(--sage)' }}>
              <b style={{ fontFamily: 'JetBrains Mono', fontSize: 11, marginRight: 6 }}>+</b>2 tsp dried oregano
            </div>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: 9 }}>SAVES AS · v2.1 · "Halloumi Pasta Bake (suggested by Robbie)"</div>

            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <button className="mf-btn primary sm" style={{ flex: 1 }}>accept ✓ ship v2.1</button>
              <button className="mf-btn sm">edit before accept</button>
              <button className="mf-btn ghost sm">reject</button>
            </div>
          </div>

          {/* compact list — other pending */}
          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 14 }}>OTHER PENDING</div>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { who: 'Jamie', recipe: 'Halloumi Pasta Bake v2.0', summary: 'temp typo · 200°C → 180°C', when: '5h' },
              { who: '@sarah', recipe: 'Halloumi Pasta Bake v2.0', summary: '+1 change · roast peppers before adding', when: '1d' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AuthorChip name={s.who} size={14} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Kalam', fontSize: 12, lineHeight: 1.2 }}>
                    <b>{s.summary}</b>
                  </div>
                  <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{s.recipe} · {s.when} ago</div>
                </div>
                <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>review →</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 48px 32px' }}>
        <div className="mf-card" style={{ padding: 12, borderLeft: '3px solid var(--sage)', background: 'rgba(143,166,119,0.06)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)' }}>
          <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>WHY THIS EXISTS</span>
          <span style={{ flex: 1, minWidth: 280 }}>
            people cook from each other's recipes and notice things. Without this flow, the only options are <i>silently fork</i> (which fragments the chain) or <i>tell them in a comment</i> (which never gets fixed). Suggestions give a low-friction path for community quality control.
          </span>
          <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>3 suggestions accepted · this week · across the household</span>
        </div>
      </div>
    </div>
  );
}
window.SuggestUpstream = SuggestUpstream;

// ──────────────────────────────────────────────────────────────
// 11e · Upstream sync — pull updates from a parent into your fork
// When the parent refines (v1.2 → v1.3) downstream forks see a nudge.
// They can pull in individual changes, dismiss, or fork the new
// upstream version as a sub-branch.
// ──────────────────────────────────────────────────────────────
function UpstreamSync() {
  return (
    <div className="mf mf-page">
      <Nav active="recipes" />
      <div style={{ padding: '24px 48px 6px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>UPSTREAM SYNC · YOUR FORK</div>
        <h1 className="mf-display" style={{ fontSize: 44, margin: '4px 0 0' }}>Robbie improved <span style={{ color: 'var(--terracotta)' }}>the parent.</span></h1>
        <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, maxWidth: 740 }}>
          Looking at your <b>Halloumi Pasta Bake v2.0</b>, forked from Robbie's <b>Chicken & Chorizo Bake v1.2</b>. Robbie just refined the parent to v1.3. Some of those changes might be nice for your halloumi version too — review and cherry-pick.
        </div>
      </div>

      <div style={{ padding: '14px 48px 8px' }}>
        {/* the nudge that triggers this view */}
        <div className="mf-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid var(--terracotta)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>📩</span>
          <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)' }}>
            <b><AuthorChip name="Robbie" /> refined</b> the parent of your fork — <b>v1.2 → v1.3</b> · 3 changes · 2h ago
          </span>
          <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>your fork wasn't touched — pull only what you want</span>
          <button className="mf-btn ghost sm" style={{ fontSize: 11 }}>dismiss all</button>
        </div>
      </div>

      <div style={{ padding: '6px 48px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'flex-start' }}>
        {/* LEFT — upstream's changes */}
        <div className="mf-card" style={{ padding: 16, background: 'rgba(244,236,214,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>UPSTREAM · ROBBIE'S v1.2 → v1.3</span>
            <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>3 CHANGES</span>
          </div>
          <div className="mf-display" style={{ fontSize: 24, marginTop: 4 }}>Chicken & Chorizo Bake</div>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2, fontSize: 9 }}>refined 2h ago · "weeknight tweaks after a few cooks"</div>

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>WHAT CHANGED</div>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <UpstreamChange
              status="pulled"
              kind="modified"
              label="basil: small bunch → 2 tsp dried basil"
              note="more reliable for weeknight cooks"
              applicable={true}
            />
            <UpstreamChange
              status="pending"
              kind="modified"
              label="bake: 18m → 22m"
              note="needed longer to brown the cheese"
              applicable={true}
            />
            <UpstreamChange
              status="dismissed"
              kind="added"
              label="+ pinch chilli flakes (optional)"
              note="this is a chicken-specific tweak"
              applicable={false}
              applicableNote="doesn't apply — your fork already excludes chilli"
            />
          </div>

          <div style={{ marginTop: 12, padding: '6px 10px', background: 'var(--paper-warm)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-2)' }}>
            this view <b>doesn't touch Robbie's recipe</b>. We're just showing you what changed so you can borrow what works for your branch.
          </div>
        </div>

        {/* RIGHT — your fork after pulling */}
        <div className="mf-card" style={{ padding: 16, borderColor: 'var(--terracotta)', borderWidth: 1.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>YOUR FORK · v2.0 → v2.1 (PREVIEW)</span>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>1 pulled · 1 pending · 1 dismissed</span>
          </div>
          <div className="mf-display" style={{ fontSize: 24, marginTop: 4 }}>Halloumi Pasta Bake</div>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 2, fontSize: 9 }}>your branch · refines stay on your branch</div>

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>PREVIEW · CHANGES TO YOUR FORK</div>
          <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 6, background: 'var(--paper-warm)', border: '1px dashed var(--terracotta)' }}>
            <DiffLine kind="modified" was="small bunch fresh basil">2 tsp dried basil</DiffLine>
            <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 4 }}>↳ pulled from Robbie · "more reliable for weeknight cooks"</div>
          </div>

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>STILL TO DECIDE</div>
          <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 6, background: 'rgba(245,199,100,0.10)', border: '1px solid var(--butter)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Kalam', fontSize: 12, flex: 1 }}>
              <b>bake: 18m → 22m</b> · halloumi might dry out with extra time — try first?
            </span>
            <button className="mf-btn primary sm" style={{ fontSize: 11 }}>pull</button>
            <button className="mf-btn ghost sm" style={{ fontSize: 11 }}>skip</button>
          </div>

          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>LINEAGE AFTER</div>
          <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>
            your <b>v2.1</b> remains a fork of Robbie's <b>v1.2</b> (the version you originally forked from). The pull-in is annotated: <i>"basil change pulled from v1.3."</i> Robbie's v1.3 doesn't become your new parent — your branch identity is preserved.
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
            <button className="mf-btn primary" style={{ flex: 1 }}>save v2.1 ✓</button>
            <button className="mf-btn ghost">dismiss all</button>
          </div>
        </div>
      </div>

      {/* When this applies vs doesn't */}
      <div style={{ padding: '0 48px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div className="mf-card" style={{ padding: 12, borderLeft: '3px solid var(--sage)', background: 'rgba(143,166,119,0.06)' }}>
          <div className="mf-mono" style={{ color: 'var(--sage)' }}>✓ APPLICABLE TO YOUR FORK</div>
          <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>changes to ingredients/steps you didn't already alter. Cherry-pickable.</div>
        </div>
        <div className="mf-card" style={{ padding: 12, borderLeft: '3px solid var(--butter)', background: 'rgba(245,199,100,0.10)' }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta-deep)' }}>⚠ AMBIGUOUS</div>
          <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>upstream changed something you also changed in your fork — show both sides, you choose which wins.</div>
        </div>
        <div className="mf-card" style={{ padding: 12, borderLeft: '3px solid var(--ink-3)', background: 'rgba(31,26,20,0.04)' }}>
          <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>− NOT APPLICABLE</div>
          <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)' }}>change touched something you forked out (e.g. chilli, chicken). Auto-dismissed with a note.</div>
        </div>
      </div>
    </div>
  );
}

function UpstreamChange({ status, kind, label, note, applicable, applicableNote }) {
  const statusMap = {
    pulled:    { bg: 'rgba(143,166,119,0.12)', border: 'var(--sage)',          label: 'PULLED IN',  color: 'var(--sage)' },
    pending:   { bg: 'rgba(245,199,100,0.18)', border: 'var(--butter)',        label: 'PENDING',    color: 'var(--terracotta-deep)' },
    dismissed: { bg: 'rgba(31,26,20,0.05)',    border: 'var(--line-strong)',   label: 'DISMISSED',  color: 'var(--ink-3)' },
  };
  const s = statusMap[status];
  return (
    <div style={{ padding: '8px 10px', borderRadius: 6, background: s.bg, borderLeft: '3px solid ' + s.border }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mf-mono" style={{ color: s.color, fontSize: 9 }}>{s.label}</span>
        <span style={{ fontFamily: 'Kalam', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{label}</span>
      </div>
      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, fontStyle: 'italic', marginTop: 2 }}>"{note}"</div>
      {!applicable && <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 4 }}>↳ {applicableNote}</div>}
      {status === 'pending' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="mf-btn sm" style={{ flex: 1, fontSize: 11 }}>pull in →</button>
          <button className="mf-btn ghost sm" style={{ fontSize: 11 }}>skip</button>
        </div>
      )}
    </div>
  );
}

window.UpstreamSync = UpstreamSync;

function DiffLine({ kind, was, children }) {
  const styles = {
    kept:     { color: 'var(--ink-2)',         bg: 'transparent',                   prefix: '·',  pre: 'var(--ink-3)' },
    added:    { color: 'var(--sage)',          bg: 'rgba(143,166,119,0.12)',         prefix: '+',  pre: 'var(--sage)' },
    removed:  { color: 'var(--terracotta-deep)', bg: 'rgba(200,105,60,0.10)',        prefix: '−',  pre: 'var(--terracotta-deep)', strike: true },
    modified: { color: 'var(--ink-2)',         bg: 'rgba(245,199,100,0.18)',         prefix: '~',  pre: 'var(--terracotta-deep)' },
  };
  const s = styles[kind] || styles.kept;
  return (
    <div style={{ padding: '2px 6px', background: s.bg, borderRadius: 4, borderBottom: kind === 'kept' ? '1px dashed var(--line)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{ color: s.pre, fontFamily: 'JetBrains Mono', fontSize: 11, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>{s.prefix}</span>
      <div style={{ flex: 1 }}>
        {kind === 'modified' && was && <div style={{ color: 'var(--ink-3)', textDecoration: 'line-through', fontSize: 12 }}>{was}</div>}
        <div style={{ color: s.color, textDecoration: s.strike ? 'line-through' : 'none' }}>{children}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 11d · Ingest · origin DETECTION (not manual entry)
// The platform almost always knows: URL → automatic, barcode/QR → automatic,
// photo of a known cookbook cover → OCR + suggest, photo without context → ask.
// Manual entry is the last resort, not the first step.
// ──────────────────────────────────────────────────────────────
function IngestWithOrigin() {
  return (
    <div className="mf mf-page">
      <Nav active="scan" />
      <div style={{ padding: '24px 48px 6px' }}>
        <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>INGEST · ORIGIN DETECTION</div>
        <h1 className="mf-display" style={{ fontSize: 44, margin: '4px 0 0' }}>we usually <span style={{ color: 'var(--terracotta)' }}>already know.</span></h1>
        <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
          URL paste · barcode · cookbook cover OCR — provenance is captured automatically. We only ask when the source genuinely isn't obvious.
        </div>
      </div>

      <div style={{ padding: '16px 48px 32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {/* A · auto-detected */}
        <IngestCard tone="sage" badge="AUTO-DETECTED" headline="URL paste" sub="bbcgoodfood.com/recipes/chicken-chorizo-bake">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>🌐</span>
            <div style={{ flex: 1 }}>
              <div className="mf-display" style={{ fontSize: 16, lineHeight: 1 }}>BBC Good Food</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>confidence · 100%</div>
            </div>
          </div>
          <div className="mf-mono" style={{ color: 'var(--ink-3)', marginTop: 10, fontSize: 9 }}>RECORDED</div>
          <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)' }}>
            · origin: <b>bbcgoodfood.com/.../chicken-chorizo-bake</b><br/>
            · attribution: <b>BBC Good Food</b> · permanent SEO link<br/>
            · version: <b>1.0</b> · author: <b>Robbie</b>
          </div>
          <button className="mf-btn primary sm" style={{ width: '100%', marginTop: 10 }}>save & open ✓</button>
        </IngestCard>

        {/* B · auto-detected barcode (groceries app overlap) */}
        <IngestCard tone="sage" badge="AUTO-DETECTED" headline="Cookbook cover" sub="OCR matched a title we know">
          <div style={{ padding: 8, background: 'var(--paper-warm)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 48, height: 60, borderRadius: 3, background: 'linear-gradient(135deg, #8FA677, #506B3F)', boxShadow: 'var(--shadow)', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 2 }}></div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mf-display" style={{ fontSize: 14, lineHeight: 1 }}>River Cottage Veg Every Day</div>
              <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>confidence · 94%</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>PAGE</span>
            <input defaultValue="114" style={{ width: 60, padding: '4px 8px', fontFamily: 'Kalam', fontSize: 13, border: '1px solid var(--line-strong)', borderRadius: 4 }} />
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>· auto-suggested from OCR</span>
          </div>
          <div style={{ marginTop: 10, padding: '6px 8px', background: 'rgba(143,166,119,0.10)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-2)' }}>
            we matched the cover. <b>Correct?</b> Edit anytime in <i>recipe → settings → origin</i>.
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="mf-btn primary sm" style={{ flex: 1 }}>looks right ✓</button>
            <button className="mf-btn ghost sm">not this one</button>
          </div>
        </IngestCard>

        {/* C · only when we don't know */}
        <IngestCard tone="butter" badge="NEEDS YOU" headline="No source detected" sub="photo wasn't a known cover · ask once">
          <div style={{ marginTop: 4 }}>
            <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>WHERE'S THIS FROM?</div>
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { ic: '📖', k: 'a cookbook',       sub: 'name it · we\'ll OCR future scans automatically', on: true },
                { ic: '👤', k: 'from someone',     sub: 'tag a person (or paste their name) — they get credit', on: false },
                { ic: '✎',  k: 'I made it up',    sub: 'you\'re the root · no upstream origin', on: false },
              ].map(o => (
                <label key={o.k} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid ' + (o.on ? 'var(--terracotta)' : 'var(--line)'), background: o.on ? 'rgba(200,105,60,0.06)' : 'transparent', display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid var(--ink)', background: o.on ? 'var(--terracotta)' : 'transparent', flexShrink: 0, marginTop: 3 }}></span>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{o.ic}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Kalam', fontSize: 12, fontWeight: 700 }}>{o.k}</div>
                    <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{o.sub}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>NAME OF COOKBOOK</div>
              <input placeholder="e.g. Ottolenghi · SIMPLE" style={{ marginTop: 4, padding: '6px 10px', width: '100%', boxSizing: 'border-box', fontFamily: 'Kalam', fontSize: 13, border: '1px solid var(--line-strong)', borderRadius: 6 }} />
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>PAGE</span>
                <input placeholder="optional" style={{ width: 80, padding: '4px 8px', fontFamily: 'Kalam', fontSize: 13, border: '1px solid var(--line-strong)', borderRadius: 4 }} />
              </div>
            </div>
            <button className="mf-btn primary sm" style={{ width: '100%', marginTop: 10 }}>save ✓</button>
          </div>
        </IngestCard>
      </div>

      <div style={{ padding: '0 48px 32px' }}>
        <div className="mf-card" style={{ padding: 14, borderLeft: '3px solid var(--sage)', background: 'rgba(143,166,119,0.06)' }}>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>SEO CREDIT · WHY THIS MATTERS</div>
          <div style={{ marginTop: 4, fontFamily: 'Kalam', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            External origins (BBC, NYT Cooking, Serious Eats, individual food blogs) keep a permanent outbound link on every descendant recipe in our system. <b>1.2k clicks/month back to BBC Good Food</b> from descendants of one recipe alone. Cookbooks get text credit + a "buy" link if affiliated. People who fork credit forward the same — anyone reaching v2.0 can still see and click through to the BBC root.
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 14, fontFamily: 'Kalam', fontSize: 12, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
            <span>· source publishers should <b>want</b> their recipes ingested here</span>
            <span>· makes us partner-friendly, not parasitic</span>
            <span>· cookbooks become discoverable via OCR scan → "buy this book ↗"</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IngestCard({ tone, badge, headline, sub, children }) {
  const accent = tone === 'sage' ? 'var(--sage)' : tone === 'butter' ? 'var(--butter)' : 'var(--terracotta)';
  return (
    <div className="mf-card" style={{ padding: 14, borderLeft: '3px solid ' + accent }}>
      <span className="mf-mono" style={{ color: accent, padding: '2px 8px', background: tone === 'sage' ? 'rgba(143,166,119,0.12)' : 'rgba(245,199,100,0.18)', borderRadius: 999, fontSize: 9 }}>{badge}</span>
      <div className="mf-display" style={{ fontSize: 22, marginTop: 6, lineHeight: 1 }}>{headline}</div>
      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 2 }}>{sub}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

window.ProvenanceReadme = ProvenanceReadme;
window.RecipeWithLineage = RecipeWithLineage;
window.LineageTree = LineageTree;
window.ForkAndDiff = ForkAndDiff;
window.IngestWithOrigin = IngestWithOrigin;
window.LINEAGE_NODES = LINEAGE_NODES;
window.AuthorChip = AuthorChip;

// ──────────────────────────────────────────────────────────────
// 11f · Published-book registry
// Cookbooks are domain objects, not just origin strings. Each book carries
// title · author · publisher · edition · year · ISBN · cover. Recipes citing
// a book reference its ID, so an edition swap (p.42 1st-ed → p.46 2nd-ed)
// stays traceable. Cover photos train OCR to auto-route future scans.
// ──────────────────────────────────────────────────────────────
const BOOKS = [
  { id: 'rcveg',   title: 'River Cottage Veg Every Day', author: 'Hugh Fearnley-Whittingstall', publisher: 'Bloomsbury', edition: '1st ed', year: 2011, isbn: '978-1408828595', recipes: 4, palette: ['#8FA677','#506B3F'], glyph: 'bowl' },
  { id: 'simple',  title: 'SIMPLE',                      author: 'Yotam Ottolenghi',            publisher: 'Ebury',      edition: '1st ed', year: 2018, isbn: '978-1785031168', recipes: 7, palette: ['#E2A040','#8B4A1E'], glyph: 'tortilla' },
  { id: 'salt',    title: 'Salt Fat Acid Heat',          author: 'Samin Nosrat',                publisher: 'Canongate',  edition: '1st ed', year: 2017, isbn: '978-1782112303', recipes: 2, palette: ['#F5C764','#A04F26'], glyph: 'pasta' },
  { id: 'slow',    title: 'The Roasting Tin',            author: 'Rukmini Iyer',                publisher: 'Square Peg', edition: '2nd ed', year: 2019, isbn: '978-1529104787', recipes: 5, palette: ['#C8693C','#742A18'], glyph: 'pot' },
];

function PublishedBooks() {
  return (
    <div className="mf mf-page">
      <Nav active={null} />
      <div style={{ padding: '24px 48px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>PUBLISHED BOOKS · YOUR PHYSICAL SHELF</div>
          <h1 className="mf-display" style={{ fontSize: 48, margin: '4px 0 0' }}>cookbooks <span style={{ color: 'var(--terracotta)' }}>you cite.</span></h1>
          <div className="mf-body" style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, maxWidth: 760 }}>
            Real published cookbooks are first-class objects. Capture the cover once · every recipe you scan from inside auto-routes to the right book, edition, page. Editions matter — a 1st-ed p.42 lookup follows a different chain than a revised p.46.
          </div>
        </div>
        <button className="mf-btn primary">＋ add a book</button>
      </div>

      <div style={{ padding: '16px 48px 32px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'flex-start' }}>
        {/* LEFT — book grid */}
        <div>
          <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>{BOOKS.length} BOOKS · {BOOKS.reduce((n, b) => n + b.recipes, 0)} RECIPES CITED</div>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {BOOKS.map(b => <BookCard key={b.id} b={b} active={b.id === 'rcveg'} />)}
          </div>
        </div>

        {/* RIGHT — add-a-book / cover capture flow */}
        <div className="mf-card" style={{ padding: 16, borderLeft: '3px solid var(--terracotta)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>ADD A BOOK</span>
            <span className="mf-mono" style={{ color: 'var(--ink-3)' }}>step 1 of 2 · capture cover</span>
          </div>

          {/* cover capture viewfinder */}
          <div style={{ marginTop: 10, padding: 8, background: '#2a2520', borderRadius: 8, position: 'relative', height: 220 }}>
            <div style={{ position: 'absolute', inset: 16, border: '2px dashed var(--butter)', borderRadius: 6 }}></div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 90, height: 130, background: 'linear-gradient(135deg, #8FA677, #506B3F)', borderRadius: 3, boxShadow: '0 6px 18px rgba(0,0,0,0.4)', position: 'relative', transform: 'rotate(-3deg)' }}>
                <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 2 }}></div>
                <div style={{ position: 'absolute', top: 22, left: 0, right: 0, textAlign: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 14, color: '#FFF6E0', lineHeight: 1.05, padding: '0 8px' }}>River<br/>Cottage<br/>VEG</div>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: 'var(--butter)', fontFamily: 'Caveat', fontSize: 16 }}>line the spine up · hold steady</div>
            <div style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px', background: 'rgba(143,166,119,0.85)', borderRadius: 999, fontFamily: 'JetBrains Mono', fontSize: 9, color: '#FFF6E0', letterSpacing: '0.04em' }}>MATCH · 94%</div>
          </div>

          {/* OCR matched fields — editable */}
          <div className="mf-mono" style={{ color: 'var(--terracotta)', marginTop: 12 }}>WE THINK IT'S — CONFIRM OR EDIT</div>
          <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['title',     'River Cottage Veg Every Day', 'span 2'],
              ['author',    'Hugh Fearnley-Whittingstall', 'span 2'],
              ['publisher', 'Bloomsbury',                  null],
              ['year',      '2011',                        null],
              ['edition',   '1st ed',                      null],
              ['isbn',      '978-1408828595',              null],
            ].map(([k, v, span]) => (
              <div key={k} style={{ gridColumn: span === 'span 2' ? 'span 2' : 'auto' }}>
                <div className="mf-mono" style={{ color: 'var(--ink-3)' }}>{k.toUpperCase()}</div>
                <input defaultValue={v} style={{ marginTop: 2, padding: '4px 8px', width: '100%', boxSizing: 'border-box', fontFamily: 'Kalam', fontSize: 13, border: '1px solid var(--line-strong)', borderRadius: 4, background: 'var(--card)' }} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(143,166,119,0.10)', borderRadius: 6, fontFamily: 'Kalam', fontSize: 11, color: 'var(--ink-2)' }}>
            ISBN auto-matched against the publisher database — title, author, year, edition come back filled. <b>Edition matters</b>: page numbers differ.
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="mf-btn primary" style={{ flex: 1 }}>save · ready to scan recipes</button>
            <button className="mf-btn ghost">retake</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 48px 32px' }}>
        <div className="mf-card" style={{ padding: 14, borderLeft: '3px solid var(--butter)', background: 'rgba(245,199,100,0.10)' }}>
          <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>WHY THIS MATTERS · EDITION HANDLING</span>
          <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, fontFamily: 'Kalam', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            <div>
              <b>One book, many editions.</b> The 1st-ed of <i>SIMPLE</i> has the chocolate cake on p.42. The revised has it on p.46. A recipe citing "p.42 · SIMPLE" without an edition is ambiguous — we store both.
            </div>
            <div>
              <b>Auto-routing.</b> Once you've registered River Cottage Veg, any future page-scan from that book pre-fills the citation. You confirm the page number; the rest is automatic.
            </div>
            <div>
              <b>Affiliate links.</b> Books in our registry can carry a "buy this book ↗" link with affiliate attribution — sends real revenue back to authors/publishers. Independent bookshops first; Amazon as a fallback.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookCard({ b, active }) {
  return (
    <div className="mf-card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start', borderColor: active ? 'var(--terracotta)' : 'var(--line-strong)', borderWidth: active ? 1.5 : 1.25 }}>
      {/* spine + cover */}
      <div style={{ position: 'relative', width: 64, height: 90, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: '4px -3px -3px 3px', background: 'var(--ink-4)', borderRadius: 3, opacity: 0.35 }}></div>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 3, background: `linear-gradient(135deg, ${b.palette[0]}, ${b.palette[1]})`, boxShadow: '0 4px 10px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
          <FoodGlyph kind={b.glyph} size={60} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 6, background: 'rgba(0,0,0,0.2)', boxShadow: 'inset -1px 0 2px rgba(0,0,0,0.15)' }}></div>
          <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 2 }}></div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mf-display" style={{ fontSize: 18, lineHeight: 1, color: 'var(--ink)' }}>{b.title}</div>
        <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginTop: 4 }}>{b.author}</div>
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <span className="mf-tag soft" style={{ fontSize: 10 }}>{b.edition}</span>
          <span className="mf-tag soft" style={{ fontSize: 10 }}>{b.year}</span>
          <span className="mf-tag soft" style={{ fontSize: 10 }}>{b.publisher}</span>
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>ISBN {b.isbn}</span>
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9 }}>📖 {b.recipes} recipes cited</span>
          <span style={{ flex: 1 }}></span>
          <span className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 10, cursor: 'pointer' }}>open ↗</span>
          <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 10, cursor: 'pointer' }}>buy ↗</span>
        </div>
      </div>
    </div>
  );
}

window.PublishedBooks = PublishedBooks;
window.BOOKS = BOOKS;
