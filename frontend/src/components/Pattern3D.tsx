import { useMemo } from "react";
import PlotlyChart from "../PlotlyChart";
import type { Surface3D } from "../compute";

interface Ring {
  x: number[];
  y: number[];
  z: number[];
}

interface Props {
  surface: Surface3D;
  rings: { theta: Ring[]; phi: Ring[] };
  cut3D: Ring;
  beam: { x: number; y: number; z: number } | null;
  rangeMin: number;
  rangeMax: number;
}

function buildReferenceSphere() {
  const nTheta = 31;
  const nPhi = 31;
  const x: number[][] = [];
  const y: number[][] = [];
  const z: number[][] = [];
  for (let i = 0; i < nTheta; i++) {
    const t = (i / (nTheta - 1)) * Math.PI;
    const rowX: number[] = [];
    const rowY: number[] = [];
    const rowZ: number[] = [];
    for (let j = 0; j < nPhi; j++) {
      const p = (j / (nPhi - 1)) * 2 * Math.PI;
      rowX.push(Math.sin(t) * Math.cos(p));
      rowY.push(Math.sin(t) * Math.sin(p));
      rowZ.push(Math.cos(t));
    }
    x.push(rowX);
    y.push(rowY);
    z.push(rowZ);
  }
  return { x, y, z };
}

export default function Pattern3D({ surface, rings, cut3D, beam, rangeMin, rangeMax }: Props) {
  const refSphere = useMemo(buildReferenceSphere, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [
    {
      type: "surface",
      x: surface.x,
      y: surface.y,
      z: surface.z,
      surfacecolor: surface.c,
      colorscale: "Turbo",
      cmin: rangeMin,
      cmax: rangeMax,
      showscale: true,
      colorbar: { title: "dB", tickfont: { color: "white" }, titlefont: { color: "white" } },
      lighting: { diffuse: 0.9, specular: 0.05, ambient: 0.6 },
      hoverinfo: "skip",
    },
    {
      type: "surface",
      x: refSphere.x,
      y: refSphere.y,
      z: refSphere.z,
      showscale: false,
      opacity: 0.05,
      colorscale: [
        [0, "rgb(150,150,150)"],
        [1, "rgb(150,150,150)"],
      ],
      hoverinfo: "skip",
    },
    ...rings.theta.map((r) => ({
      type: "scatter3d",
      mode: "lines",
      x: r.x,
      y: r.y,
      z: r.z,
      line: { color: "rgba(200,200,200,0.5)", dash: "dash", width: 1 },
      hoverinfo: "skip",
      showlegend: false,
    })),
    ...rings.phi.map((r) => ({
      type: "scatter3d",
      mode: "lines",
      x: r.x,
      y: r.y,
      z: r.z,
      line: { color: "rgba(130,130,130,0.5)", dash: "dot", width: 1 },
      hoverinfo: "skip",
      showlegend: false,
    })),
    {
      type: "scatter3d",
      mode: "lines",
      x: cut3D.x,
      y: cut3D.y,
      z: cut3D.z,
      line: { color: "cyan", width: 5 },
      hoverinfo: "skip",
      showlegend: false,
    },
  ];

  if (beam) {
    traces.push({
      type: "scatter3d",
      mode: "lines+markers",
      x: [0, beam.x],
      y: [0, beam.y],
      z: [0, beam.z],
      line: { color: "red", width: 5 },
      marker: { color: "red", size: 5 },
      hoverinfo: "skip",
      showlegend: false,
    });
  }

  const layout = {
    paper_bgcolor: "black",
    plot_bgcolor: "black",
    scene: {
      xaxis: { visible: false, range: [-1, 1] },
      yaxis: { visible: false, range: [-1, 1] },
      zaxis: { visible: false, range: [-1, 1] },
      aspectmode: "cube",
      camera: { eye: { x: 1.4, y: 1.4, z: 1.1 } },
      bgcolor: "black",
    },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false,
  };

  return <PlotlyChart data={traces} layout={layout} style={{ width: "100%", height: "700px" }} />;
}
