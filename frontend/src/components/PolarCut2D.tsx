import { useMemo } from "react";
import PlotlyChart from "../PlotlyChart";

interface Props {
  x: number[];
  y: number[];
  rangeMin: number;
  rangeMax: number;
  headerText: string;
  titleText: string;
}

export default function PolarCut2D({ x, y, rangeMin, rangeMax, headerText, titleText }: Props) {
  const { traces, annotations } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traces: any[] = [
      {
        type: "scatter",
        mode: "lines",
        x,
        y,
        line: { color: "#4fa8ff", width: 2 },
        hoverinfo: "skip",
        showlegend: false,
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const annotations: any[] = [];

    const t = Array.from({ length: 200 }, (_, i) => (i / 199) * 2 * Math.PI);
    for (let k = 0; k < 5; k++) {
      const lvl = rangeMin + (k * (rangeMax - rangeMin)) / 4;
      const r = (lvl - rangeMin) / (rangeMax - rangeMin);
      traces.push({
        type: "scatter",
        mode: "lines",
        x: t.map((a) => r * Math.cos(a)),
        y: t.map((a) => r * Math.sin(a)),
        line: { color: "rgba(100,100,100,0.6)", dash: "dash", width: 1 },
        hoverinfo: "skip",
        showlegend: false,
      });
      annotations.push({
        x: r * Math.cos((135 * Math.PI) / 180),
        y: r * Math.sin((135 * Math.PI) / 180),
        text: `${lvl.toFixed(1)} dB`,
        showarrow: false,
        font: { color: "rgba(190,190,190,0.9)", size: 10 },
      });
    }

    for (let deg = 0; deg < 360; deg += 30) {
      const a = (deg * Math.PI) / 180;
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [0, Math.cos(a)],
        y: [0, Math.sin(a)],
        line: { color: "rgba(80,80,80,0.6)", width: 1 },
        hoverinfo: "skip",
        showlegend: false,
      });
      annotations.push({
        x: 1.1 * Math.cos(a),
        y: 1.1 * Math.sin(a),
        text: `${deg}°`,
        showarrow: false,
        font: { color: "white", size: 11 },
      });
    }

    return { traces, annotations };
  }, [x, y, rangeMin, rangeMax]);

  const layout = {
    paper_bgcolor: "black",
    plot_bgcolor: "black",
    xaxis: { visible: false, range: [-1.25, 1.25] },
    yaxis: { visible: false, range: [-1.25, 1.25], scaleanchor: "x" },
    margin: { l: 10, r: 10, t: 50, b: 40 },
    annotations,
    title: { text: `${headerText}<br>${titleText}`, font: { color: "white", size: 13 } },
    showlegend: false,
  };

  return <PlotlyChart data={traces} layout={layout} style={{ width: "100%", height: "550px" }} />;
}
