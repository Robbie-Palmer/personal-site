// mid-fi/units.jsx — measurement preferences. Display-only conversion: the original
// recipe is always preserved; we just re-express each quantity in your units.
//
// The model is a LADDER, not a binary small/large switch — that's what Robbie's
// "tsp, tbsp, ml AND litres" needs. Each dimension carries an ordered list of unit
// "tiers", each with an upper threshold where it hands off to the next:
//   tsp → up to 15ml → tbsp → up to 45ml → ml → up to 1L → litres (and above)
// You add/remove units from the ladder with chips; you drag the thresholds between
// them on a log-scale ruler (log so tsp and litres both get a visible band).
// Length & oven temp stay single-choice — a ladder there isn't natural.

// ── unit metadata ─────────────────────────────────────────────────────────────
const U_NAME = { g: 'g', kg: 'kg', oz: 'oz', lb: 'lb', ml: 'ml', l: 'litres', tsp: 'tsp', tbsp: 'tbsp', floz: 'fl oz', cup: 'cups', pt: 'pints', cm: 'cm', in: 'in', c: '°C', f: '°F', gas: 'gas mark' };
// value of 1 unit, in the base unit (g for weight, ml for volume)
const FAC = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592, ml: 1, l: 1000, tsp: 5, tbsp: 15, floz: 30, cup: 250, pt: 568.261 };
// the units that may appear in each ladder, in ascending "natural size" order
const LADDER_UNITS = { weight: ['g', 'oz', 'lb', 'kg'], volume: ['tsp', 'tbsp', 'floz', 'ml', 'cup', 'pt', 'l'] };
// default threshold (in base units) when a unit is first added to a ladder
const DEFAULT_UPTO = { tsp: 15, tbsp: 45, floz: 120, ml: 1000, cup: 1000, pt: 2000, l: Infinity, g: 1000, oz: 340, lb: 2000, kg: Infinity };
const U_SINGLE = { length: [['cm', 'centimetres'], ['in', 'inches']], temp: [['c', '°C'], ['f', '°F'], ['gas', 'gas mark']] };
// log-scale bar bounds, in base units
const BAR = { weight: { min: 2, max: 4000 }, volume: { min: 2, max: 4000 } };

// ── presets ─────────────────────────────────────────────────────────────────
const U_PRESETS = {
  metric: { weight: { tiers: [{ u: 'g', upTo: 1000 }, { u: 'kg', upTo: Infinity }] }, volume: { tiers: [{ u: 'tsp', upTo: 15 }, { u: 'tbsp', upTo: 45 }, { u: 'ml', upTo: 1000 }, { u: 'l', upTo: Infinity }] }, length: 'cm', temp: 'c' },
  uk:     { weight: { tiers: [{ u: 'g', upTo: 1000 }, { u: 'kg', upTo: Infinity }] }, volume: { tiers: [{ u: 'tsp', upTo: 15 }, { u: 'tbsp', upTo: 45 }, { u: 'ml', upTo: 1000 }, { u: 'l', upTo: Infinity }] }, length: 'cm', temp: 'gas' },
  us:     { weight: { tiers: [{ u: 'oz', upTo: 454 }, { u: 'lb', upTo: Infinity }] }, volume: { tiers: [{ u: 'tsp', upTo: 15 }, { u: 'tbsp', upTo: 45 }, { u: 'cup', upTo: Infinity }] }, length: 'in', temp: 'f' },
};
const U_PRESET_META = [
  ['metric', 'Metric', 'tsp · ml · L · °C'],
  ['uk', 'UK', 'tsp · ml · L · gas'],
  ['us', 'US', 'tsp · tbsp · cups · °F'],
  ['custom', 'Custom', 'your own ladder'],
];
const U_DEFAULT = JSON.parse(JSON.stringify(U_PRESETS.metric));
// JSON round-trips turn Infinity into null — re-normalize so the last tier is Infinity again.
function loadCfg(src) {
  const c = JSON.parse(JSON.stringify(src || U_PRESETS.metric));
  c.weight.tiers = normalizeTiers('weight', c.weight.tiers);
  c.volume.tiers = normalizeTiers('volume', c.volume.tiers);
  return c;
}
function unitsMatchPreset(cfg) {
  for (const k of ['metric', 'uk', 'us']) if (JSON.stringify(U_PRESETS[k]) === JSON.stringify(cfg)) return k;
  return 'custom';
}

// ── ladder helpers ────────────────────────────────────────────────────────────
// keep tiers in canonical order, thresholds strictly increasing, last = Infinity
function normalizeTiers(dim, tiers) {
  const order = LADDER_UNITS[dim];
  let t = tiers.slice().sort((a, b) => order.indexOf(a.u) - order.indexOf(b.u));
  for (let i = 0; i < t.length; i++) {
    if (i === t.length - 1) { t[i] = { ...t[i], upTo: Infinity }; }
    else {
      let up = t[i].upTo; if (!Number.isFinite(up)) up = DEFAULT_UPTO[t[i].u] || 1000;
      const floor = i === 0 ? 0 : t[i - 1].upTo;
      if (up <= floor) up = floor * 1.5;
      t[i] = { ...t[i], upTo: up };
    }
  }
  return t;
}
function toggleUnit(dim, tiers, u) {
  const has = tiers.some((t) => t.u === u);
  let next;
  if (has) { if (tiers.length <= 1) return tiers; next = tiers.filter((t) => t.u !== u); }
  else next = [...tiers, { u, upTo: DEFAULT_UPTO[u] != null ? DEFAULT_UPTO[u] : 1000 }];
  return normalizeTiers(dim, next);
}
const _r = (n) => n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
function fmtLadder(base, tiers) {
  let tier = tiers[tiers.length - 1];
  for (const t of tiers) { if (base < t.upTo) { tier = t; break; } }
  return _r(base / FAC[tier.u]) + ' ' + U_NAME[tier.u];
}
const GAS = [[135, '¼'], [149, '2'], [163, '3'], [177, '4'], [191, '5'], [204, '6'], [218, '7'], [232, '8'], [246, '9']];
function fmtTemp(cval, u) {
  if (u === 'c') return cval + ' °C';
  if (u === 'f') return Math.round(cval * 9 / 5 + 32) + ' °F';
  let best = GAS[0]; for (const g of GAS) if (Math.abs(g[0] - cval) < Math.abs(best[0] - cval)) best = g;
  return 'gas ' + best[1];
}
function fmtLength(cm, u) { return u === 'cm' ? cm + ' cm' : _r(cm / 2.54) + ' in'; }

// the standing sample every preview re-expresses
const U_SAMPLE = [
  { what: 'baking powder', base: 5, orig: '5 ml', dim: 'volume' },
  { what: 'olive oil', base: 30, orig: '30 ml', dim: 'volume' },
  { what: 'plain flour', base: 250, orig: '250 g', dim: 'weight' },
  { what: 'whole milk', base: 600, orig: '600 ml', dim: 'volume' },
  { what: 'chicken thighs', base: 1200, orig: '1.2 kg', dim: 'weight' },
  { what: 'chicken stock', base: 1500, orig: '1.5 L', dim: 'volume' },
  { what: 'springform tin', base: 23, orig: '23 cm', dim: 'length' },
  { what: 'oven', base: 200, orig: '200 °C', dim: 'temp' },
];
function fmtSample(row, cfg) {
  if (row.dim === 'weight') return fmtLadder(row.base, cfg.weight.tiers);
  if (row.dim === 'volume') return fmtLadder(row.base, cfg.volume.tiers);
  if (row.dim === 'length') return fmtLength(row.base, cfg.length);
  return fmtTemp(row.base, cfg.temp);
}

// ── preset row ────────────────────────────────────────────────────────────────
function UnitPresetRow({ cfg, setCfg }) {
  const cur = unitsMatchPreset(cfg);
  return (
    <div>
      <div className="mf-mono" style={{ color: 'var(--ink-3)', marginBottom: 7 }}>START FROM</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {U_PRESET_META.map(([k, label, sub]) => {
          const on = cur === k; const dis = k === 'custom';
          return (
            <button key={k} onClick={() => !dis && setCfg(loadCfg(U_PRESETS[k]))}
              style={{ textAlign: 'left', padding: '8px 14px', borderRadius: 12, cursor: dis ? 'default' : 'pointer',
                border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--line-strong)'),
                background: on ? 'var(--ink)' : 'var(--card)', color: on ? 'var(--paper)' : 'var(--ink)', minWidth: 96 }}>
              <div style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: 20, lineHeight: 1 }}>{label}</div>
              <div className="mf-mono" style={{ fontSize: 9, color: on ? 'var(--butter)' : 'var(--ink-3)', marginTop: 3 }}>{on && dis ? 'active' : sub}</div>
            </button>);
        })}
      </div>
    </div>);
}

// ── preview ───────────────────────────────────────────────────────────────────
function UnitsPreview({ cfg, tight }) {
  return (
    <div style={{ background: 'var(--card)', border: '1.25px solid var(--line-strong)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: tight ? '8px 12px' : '10px 16px', background: 'var(--paper-warm)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="mf-mono" style={{ color: 'var(--terracotta)' }}>LIVE · ANY RECIPE, YOUR UNITS</span>
        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>original kept</span>
      </div>
      <div style={{ padding: tight ? '4px 12px 8px' : '6px 16px 10px' }}>
        {U_SAMPLE.map((row) => (
          <div key={row.what} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 0', borderBottom: '1px dashed var(--line)' }}>
            <span style={{ flex: 1, fontFamily: 'Kalam', fontSize: tight ? 12.5 : 14, color: 'var(--ink-2)' }}>{row.what}</span>
            <span style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: tight ? 18 : 20, color: 'var(--ink)' }}>{fmtSample(row, cfg)}</span>
            <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, minWidth: tight ? 46 : 56, textAlign: 'right' }}>was {row.orig}</span>
          </div>
        ))}
      </div>
    </div>);
}

// ── the ruler: chip toggles + a multi-band log-scale bar with draggable dividers ─
const BAND_COLORS = ['rgba(200,105,60,0.18)', 'rgba(143,166,119,0.22)', 'rgba(184,138,74,0.20)', 'rgba(150,110,140,0.18)', 'rgba(120,150,170,0.18)'];
const BAND_INK = ['var(--terracotta-deep)', 'var(--sage)', '#9A6B33', '#7C5A78', '#4F6E84'];
function lg(v) { return Math.log10(Math.max(0.0001, v)); }

function LadderRuler({ dim, cfg, setCfg }) {
  const tiers = cfg[dim].tiers;
  const b = BAR[dim];
  const xOf = (v) => { const lo = lg(b.min), hi = lg(b.max); return Math.min(1, Math.max(0, (lg(v) - lo) / (hi - lo))) * 100; };
  const setTiers = (t) => setCfg({ ...cfg, [dim]: { tiers: t } });
  const onChip = (u) => setTiers(toggleUnit(dim, tiers, u));

  const dragDivider = (i, e) => {
    e.preventDefault();
    const bar = e.currentTarget.closest('[data-bar]'); const rect = bar.getBoundingClientRect();
    const lo = lg(b.min), hi = lg(b.max);
    const move = (ev) => {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const p = Math.min(1, Math.max(0, (cx - rect.left) / rect.width));
      let v = Math.pow(10, lo + p * (hi - lo));
      // snap to something tidy
      v = v < 50 ? Math.round(v / 5) * 5 : v < 500 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50;
      const floor = i === 0 ? b.min : tiers[i - 1].upTo;
      const ceil = tiers[i + 1] && Number.isFinite(tiers[i + 1].upTo) ? tiers[i + 1].upTo : b.max;
      v = Math.min(ceil - 1, Math.max(floor + 1, v));
      const nt = tiers.map((t, j) => j === i ? { ...t, upTo: v } : t);
      setTiers(nt);
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up);
  };

  return (
    <div style={{ padding: '14px 18px 16px', border: '1.25px solid var(--line-strong)', borderRadius: 14, background: 'var(--card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: 22 }}>{dim === 'weight' ? 'Weight' : 'Volume'}</span>
        <span className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9 }}>{tiers.length} {tiers.length === 1 ? 'unit' : 'units in the ladder'}</span>
      </div>
      {/* chips: which units are in play */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {LADDER_UNITS[dim].map((u) => {
          const on = tiers.some((t) => t.u === u);
          return (
            <button key={u} onClick={() => onChip(u)}
              style={{ padding: '4px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 11,
                border: '1.5px solid ' + (on ? 'var(--ink)' : 'var(--line-strong)'),
                background: on ? 'var(--ink)' : 'var(--card)', color: on ? 'var(--paper)' : 'var(--ink-3)' }}>
              {on ? '✓ ' : '+ '}{U_NAME[u]}
            </button>);
        })}
      </div>
      {/* the bar */}
      <div data-bar style={{ position: 'relative', height: 50, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line-strong)', userSelect: 'none', touchAction: 'none' }}>
        {tiers.map((t, i) => {
          const loV = i === 0 ? b.min : tiers[i - 1].upTo;
          const hiV = Number.isFinite(t.upTo) ? t.upTo : b.max;
          const left = xOf(loV), w = xOf(hiV) - xOf(loV);
          return (
            <div key={t.u} style={{ position: 'absolute', top: 0, bottom: 0, left: left + '%', width: w + '%', background: BAND_COLORS[i % BAND_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: 17, color: BAND_INK[i % BAND_INK.length], whiteSpace: 'nowrap' }}>{U_NAME[t.u]}</span>
            </div>);
        })}
        {/* draggable dividers (all but the last tier) */}
        {tiers.slice(0, -1).map((t, i) => (
          <div key={'d' + i} onMouseDown={(e) => dragDivider(i, e)} onTouchStart={(e) => dragDivider(i, e)}
            style={{ position: 'absolute', top: 0, bottom: 0, left: xOf(t.upTo) + '%', width: 16, transform: 'translateX(-8px)', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
            <span style={{ width: 2, height: '100%', background: 'var(--ink)' }}></span>
            <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', background: 'var(--ink)', border: '2px solid var(--card)' }}></span>
          </div>
        ))}
      </div>
      {/* threshold labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, flexWrap: 'wrap', gap: 4 }}>
        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>{b.min} {dim === 'weight' ? 'g' : 'ml'}</span>
        <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {tiers.slice(0, -1).map((t, i) => (
            <span key={i} className="mf-mono" style={{ color: 'var(--terracotta)', fontSize: 9.5 }}>
              {U_NAME[t.u]}→{U_NAME[tiers[i + 1].u]} at {fmtLadder(t.upTo, [{ u: dim === 'weight' ? (t.upTo >= 1000 ? 'kg' : 'g') : (t.upTo >= 1000 ? 'l' : 'ml'), upTo: Infinity }])}
            </span>
          ))}
        </span>
        <span className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9 }}>{b.max >= 1000 ? (b.max / 1000) + (dim === 'weight' ? ' kg' : ' L') : b.max}</span>
      </div>
    </div>);
}

function SingleDimRow({ cfg, setCfg }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {['length', 'temp'].map((dim) => (
        <div key={dim} style={{ padding: '13px 16px', border: '1.25px solid var(--line-strong)', borderRadius: 14, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: 19, lineHeight: 1 }}>{dim === 'length' ? 'Length & tins' : 'Oven temp'}</div>
            <div className="mf-mono" style={{ color: 'var(--ink-4)', fontSize: 9, marginTop: 2 }}>one unit</div>
          </div>
          <span style={{ display: 'inline-flex', gap: 3, padding: 3, background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 999, flexWrap: 'wrap', rowGap: 3 }}>
            {U_SINGLE[dim].map(([k]) => {
              const on = cfg[dim] === k;
              return <button key={k} onClick={() => setCfg({ ...cfg, [dim]: k })} style={{ padding: '3px 11px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontSize: 11, background: on ? 'var(--ink)' : 'transparent', color: on ? '#fff' : 'var(--ink-2)', fontWeight: on ? 700 : 400 }}>{U_NAME[k]}</button>;
            })}
          </span>
        </div>
      ))}
    </div>);
}

function UnitsControl({ cfg, setCfg }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LadderRuler dim="weight" cfg={cfg} setCfg={setCfg} />
      <LadderRuler dim="volume" cfg={cfg} setCfg={setCfg} />
      <SingleDimRow cfg={cfg} setCfg={setCfg} />
    </div>);
}

// standalone demo card for the canvas comparison artboard
function UnitsVariantDemo() {
  const t = (typeof useHH === 'function' ? useHH() : {});
  const [cfg, setCfg] = React.useState(() => loadCfg(U_PRESETS[t.unitPreset] || U_DEFAULT));
  React.useEffect(() => { if (U_PRESETS[t.unitPreset]) setCfg(loadCfg(U_PRESETS[t.unitPreset])); }, [t.unitPreset]);
  return (
    <div className="mf" style={{ height: '100%', background: 'var(--paper)', overflow: 'auto', padding: '22px 22px 26px', boxSizing: 'border-box' }}>
      <div className="mf-mono" style={{ color: 'var(--terracotta)' }}>THE RULER</div>
      <h2 className="mf-display" style={{ fontSize: 32, margin: '2px 0 0', lineHeight: 1 }}>Drag the thresholds.</h2>
      <div className="mf-mono" style={{ color: 'var(--ink-3)', fontSize: 9, marginBottom: 16 }}>add/remove units with chips · drag the dividers · log scale so tsp→litres all fit</div>
      <div style={{ marginBottom: 16 }}><UnitPresetRow cfg={cfg} setCfg={setCfg} /></div>
      <UnitsControl cfg={cfg} setCfg={setCfg} />
      <div style={{ marginTop: 16 }}><UnitsPreview cfg={cfg} tight /></div>
    </div>);
}

Object.assign(window, {
  U_DEFAULT, U_PRESETS, loadCfg, UnitPresetRow, UnitsPreview, UnitsControl, unitsMatchPreset, UnitsVariantDemo,
});
