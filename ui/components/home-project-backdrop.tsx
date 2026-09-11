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
      <ProjectCapture
        artifactClassName="home-project-artifact--asset-tracker"
        imageClassName="artifact-capture__image--asset-tracker"
        title="ASSET TRACKER"
        meta="RECHARTS · PORTFOLIO"
      />
      <div className="home-project-backdrop__veil" />
    </div>
  );
}
