import { useEffect, useRef } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import Plotly from "plotly.js-dist-min";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout: any;
  style?: React.CSSProperties;
}

export default function PlotlyChart({ data, layout, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    Plotly.react(ref.current, data, layout, { displaylogo: false, responsive: true });
  }, [data, layout]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, []);

  return <div ref={ref} style={style} />;
}
