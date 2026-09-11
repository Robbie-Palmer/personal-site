function PathologyViewer() {
  return (
    <div className="home-project-artifact home-project-artifact--pathology">
      <svg viewBox="0 0 520 360" role="presentation">
        <defs>
          <linearGradient id="slide-wash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4c7d9" />
            <stop offset="0.55" stopColor="#c77dab" />
            <stop offset="1" stopColor="#74437f" />
          </linearGradient>
          <filter id="tissue-soften">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <clipPath id="slide-canvas">
            <rect x="54" y="58" width="438" height="274" rx="8" />
          </clipPath>
        </defs>

        <rect width="520" height="360" rx="24" className="artifact-shell" />
        <path d="M0 42h520" className="artifact-rule" />
        <circle cx="22" cy="21" r="4" className="artifact-dot" />
        <circle cx="36" cy="21" r="4" className="artifact-dot" />
        <circle cx="50" cy="21" r="4" className="artifact-dot" />
        <text x="74" y="26" className="artifact-title">
          PATHOLOGY VIEWER
        </text>

        <rect
          x="12"
          y="58"
          width="30"
          height="132"
          rx="8"
          className="artifact-tool"
        />
        <path
          d="M21 76h12M27 70v12M20 101h14M20 126l14-14M20 152h14"
          className="artifact-icon"
        />
        <circle cx="27" cy="174" r="6" className="artifact-icon" />

        <g clipPath="url(#slide-canvas)">
          <rect
            x="54"
            y="58"
            width="438"
            height="274"
            fill="url(#slide-wash)"
            opacity="0.3"
          />
          <g className="slide-grid">
            <path d="M54 126h438M54 194h438M54 262h438M128 58v274M202 58v274M276 58v274M350 58v274M424 58v274" />
          </g>
          <g filter="url(#tissue-soften)" opacity="0.88">
            <path
              d="M80 244c22-66 53-129 113-145 42-12 67 22 102 25 39 4 62-39 107-19 35 16 37 53 66 77 25 20 21 60-6 80-33 25-76 3-113 10-49 9-79 50-137 34-51-15-83-18-132-62Z"
              fill="#dca1bf"
            />
            <path
              d="M110 237c25-35 22-88 66-105 37-14 60 28 95 25 41-4 63-38 104-18 34 16 25 49 55 70 20 14 3 42-24 38-35-5-52-18-87-7-45 14-76 46-123 35-39-9-55-30-86-38Z"
              fill="#85508c"
            />
            <path
              d="M144 221c28-18 34-48 68-48 27 0 41 23 68 22 31-1 50-26 79-10 20 11 17 35-5 44-27 11-50-3-77 9-39 18-95 22-133-17Z"
              fill="#f1c2d2"
            />
          </g>
          <g className="cell-specks">
            {[
              [118, 213],
              [145, 186],
              [176, 241],
              [209, 151],
              [229, 229],
              [258, 178],
              [291, 243],
              [319, 158],
              [348, 212],
              [382, 176],
              [408, 230],
              [439, 193],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" />
            ))}
          </g>
          <path
            d="M163 137 244 118l71 48-35 78-91 8-46-53Z"
            className="annotation-region"
          />
          <circle cx="315" cy="166" r="5" className="annotation-handle" />
          <circle cx="244" cy="118" r="5" className="annotation-handle" />
          <circle cx="189" cy="252" r="5" className="annotation-handle" />
        </g>

        <rect
          x="378"
          y="300"
          width="96"
          height="20"
          rx="10"
          className="artifact-pill"
        />
        <text x="392" y="314" className="artifact-meta">
          20x · 240 µm
        </text>
      </svg>
    </div>
  );
}

function SatelliteGlobe() {
  return (
    <div className="home-project-artifact home-project-artifact--satellites">
      <svg viewBox="0 0 430 430" role="presentation">
        <defs>
          <radialGradient id="earth-fill" cx="34%" cy="28%" r="76%">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="0.43" stopColor="#2563a7" />
            <stop offset="1" stopColor="#071c39" />
          </radialGradient>
          <radialGradient id="earth-shade" cx="32%" cy="28%" r="70%">
            <stop offset="0.55" stopColor="transparent" />
            <stop offset="1" stopColor="#020617" stopOpacity="0.92" />
          </radialGradient>
          <clipPath id="earth-clip">
            <circle cx="215" cy="220" r="116" />
          </clipPath>
        </defs>

        <rect width="430" height="430" rx="28" className="artifact-shell" />
        <path d="M0 46h430" className="artifact-rule" />
        <circle cx="22" cy="23" r="4" className="artifact-dot" />
        <circle cx="36" cy="23" r="4" className="artifact-dot" />
        <circle cx="50" cy="23" r="4" className="artifact-dot" />
        <text x="73" y="28" className="artifact-title">
          AUTONOMIC SWARM
        </text>
        <text x="348" y="28" className="artifact-meta">
          T+042
        </text>

        <g className="orbit orbit--outer">
          <ellipse
            cx="215"
            cy="220"
            rx="173"
            ry="87"
            transform="rotate(-24 215 220)"
          />
        </g>
        <g className="orbit orbit--inner">
          <ellipse
            cx="215"
            cy="220"
            rx="154"
            ry="64"
            transform="rotate(35 215 220)"
          />
        </g>
        <circle cx="215" cy="220" r="116" fill="url(#earth-fill)" />
        <g clipPath="url(#earth-clip)" className="earth-lines">
          <path d="M93 197h244M99 241h232M115 281h200M111 157h208" />
          <ellipse cx="215" cy="220" rx="52" ry="116" />
          <ellipse cx="215" cy="220" rx="91" ry="116" />
          <path
            d="M126 147c21-23 59-44 91-40l20 25-18 24-33 5-16 24-34-4-16-19Zm112 54 41-31 36 12 18 38-28 20-18 47-31 18-25-31 9-26-19-21Z"
            className="earth-land"
          />
        </g>
        <circle cx="215" cy="220" r="116" fill="url(#earth-shade)" />
        <circle cx="215" cy="220" r="116" className="earth-edge" />

        <g className="satellite-node satellite-node--one">
          <circle cx="68" cy="151" r="9" />
          <path d="m76 157 20 10" />
        </g>
        <g className="satellite-node satellite-node--two">
          <circle cx="342" cy="126" r="8" />
          <path d="m334 132-20 11" />
        </g>
        <g className="satellite-node satellite-node--three">
          <circle cx="350" cy="299" r="10" />
          <path d="m341 292-19-12" />
        </g>
        <path d="M76 151c62-54 185-75 266-25" className="swarm-message" />
        <path
          d="M342 134c26 42 27 102 8 155"
          className="swarm-message swarm-message--delay"
        />
        <circle cx="215" cy="370" r="4" className="status-active" />
        <text x="228" y="374" className="artifact-meta">
          3 NODES · MISSION ACTIVE
        </text>
      </svg>
    </div>
  );
}

function AutonomousWorkGraph() {
  return (
    <div className="home-project-artifact home-project-artifact--work-graph">
      <svg viewBox="0 0 580 310" role="presentation">
        <rect width="580" height="310" rx="24" className="artifact-shell" />
        <path d="M0 42h580" className="artifact-rule" />
        <circle cx="22" cy="21" r="4" className="artifact-dot" />
        <circle cx="36" cy="21" r="4" className="artifact-dot" />
        <circle cx="50" cy="21" r="4" className="artifact-dot" />
        <text x="74" y="26" className="artifact-title">
          WORK GRAPH
        </text>
        <text x="483" y="26" className="artifact-meta">
          4 ACTIVE
        </text>

        <g className="work-connectors">
          <path d="M116 111h54c20 0 21 0 35 17l18 22" />
          <path d="M116 111h54c20 0 21 0 35-17l18-22" />
          <path d="M302 92h32c22 0 22 0 40 18l15 15" />
          <path d="M302 150h32c22 0 22 0 40-18l15-15" />
          <path d="M452 121h38" />
          <path d="M269 177v41" strokeDasharray="5 7" />
        </g>

        <g className="work-node work-node--ready">
          <rect x="42" y="87" width="76" height="48" rx="10" />
          <circle cx="58" cy="103" r="4" />
          <text x="69" y="107">
            READY
          </text>
          <text x="58" y="124" className="node-name">
            Brief
          </text>
        </g>
        <g className="work-node work-node--running">
          <rect x="222" y="68" width="82" height="48" rx="10" />
          <circle cx="238" cy="84" r="4" />
          <text x="249" y="88">
            RUNNING
          </text>
          <text x="238" y="105" className="node-name">
            Agent 03
          </text>
        </g>
        <g className="work-node work-node--complete">
          <rect x="222" y="126" width="82" height="48" rx="10" />
          <circle cx="238" cy="142" r="4" />
          <text x="249" y="146">
            PASSED
          </text>
          <text x="238" y="163" className="node-name">
            Checks
          </text>
        </g>
        <g className="work-node work-node--review">
          <rect x="386" y="97" width="70" height="48" rx="10" />
          <circle cx="402" cy="113" r="4" />
          <text x="413" y="117">
            REVIEW
          </text>
          <text x="402" y="134" className="node-name">
            Evidence
          </text>
        </g>
        <g className="work-node work-node--deploy">
          <rect x="490" y="97" width="58" height="48" rx="10" />
          <circle cx="506" cy="113" r="4" />
          <text x="517" y="117">
            NEXT
          </text>
          <text x="506" y="134" className="node-name">
            Ship
          </text>
        </g>

        <g className="attention-card">
          <rect x="179" y="218" width="282" height="62" rx="12" />
          <path d="M199 238h14M206 231v14" />
          <text x="225" y="241" className="attention-title">
            ATTENTION INBOX
          </text>
          <text x="199" y="264" className="attention-copy">
            1 decision needs human judgment
          </text>
          <circle cx="433" cy="249" r="12" />
          <path d="m428 249 4 4 7-8" />
        </g>
      </svg>
    </div>
  );
}

export function HomeProjectBackdrop() {
  return (
    <div className="home-project-backdrop" aria-hidden="true">
      <PathologyViewer />
      <SatelliteGlobe />
      <AutonomousWorkGraph />
      <div className="home-project-backdrop__veil" />
    </div>
  );
}
