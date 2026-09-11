function ProjectCapture({
  artifactClassName,
  imageClassName,
  meta,
  title,
}: Readonly<{
  artifactClassName: string;
  imageClassName: string;
  meta: string;
  title: string;
}>) {
  return (
    <div className={`home-project-artifact ${artifactClassName}`}>
      <div className="artifact-capture">
        <div className="artifact-capture__bar">
          <span className="artifact-capture__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="artifact-capture__title">{title}</span>
          <span className="artifact-capture__meta">{meta}</span>
        </div>
        <div className={`artifact-capture__image ${imageClassName}`} />
      </div>
    </div>
  );
}

function AutonomousWorkGraph() {
  return (
    <div className="home-project-artifact home-project-artifact--work-graph">
      <svg viewBox="0 0 580 310">
        <title>Semi-autonomous software development work graph</title>
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
      <ProjectCapture
        artifactClassName="home-project-artifact--pathology"
        imageClassName="artifact-capture__image--pathology"
        title="PATHOLOGY VIEWER"
        meta="LEAFLET · CPTAC-COAD"
      />
      <ProjectCapture
        artifactClassName="home-project-artifact--satellites"
        imageClassName="artifact-capture__image--satellites"
        title="AUTONOMIC SWARM"
        meta="CESIUMJS · WASM TRACE"
      />
      <AutonomousWorkGraph />
      <div className="home-project-backdrop__veil" />
    </div>
  );
}
