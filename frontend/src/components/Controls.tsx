import type { CutType, Method, Polarization } from "../types";

interface Props {
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedFileNames: string[];
  onLoadData: () => void;
  loading: boolean;

  method: Method;
  onMethodChange: (m: Method) => void;

  patternNames: string[];
  patternIdx: number;
  onPatternIdxChange: (i: number) => void;

  freqOptionsMHz: string[];
  freqIdx: number;
  onFreqIdxChange: (i: number) => void;

  pol: Polarization;
  onPolChange: (p: Polarization) => void;

  rangeMin: number;
  rangeMax: number;
  onRangeMinChange: (v: number) => void;
  onRangeMaxChange: (v: number) => void;
  onAutoRange: () => void;

  beamforming: boolean;
  onBeamformingChange: (v: boolean) => void;
  theta0: number;
  phi0: number;
  onTheta0Change: (v: number) => void;
  onPhi0Change: (v: number) => void;

  cutType: CutType;
  onCutTypeChange: (t: CutType) => void;
  cutOptions: number[];
  cutValueDeg: number;
  onCutValueChange: (v: number) => void;

  peakDb: number | null;
  peakDirectivityDbi: number | null;

  dataLoaded: boolean;
  error: string | null;
}

export default function Controls(p: Props) {
  return (
    <div className="controls-bar">
      <div className="control-group">
        <label>Fichiers .mat</label>
        <input type="file" accept=".mat" multiple onChange={p.onFilesSelected} />
        {p.selectedFileNames.length > 0 && (
          <div className="file-order-hint">
            Ordre : {p.selectedFileNames.join(", ")}
          </div>
        )}
        <button onClick={p.onLoadData} disabled={p.selectedFileNames.length === 0 || p.loading}>
          {p.loading ? "Chargement..." : "Charger"}
        </button>
      </div>

      <div className="control-group">
        <label>Méthode de mesure</label>
        <select value={p.method} onChange={(e) => p.onMethodChange(e.target.value as Method)}>
          <option value="Toggling Phase">Toggling Phase</option>
          <option value="Standard">Standard</option>
        </select>
      </div>

      {p.dataLoaded && (
        <>
          <div className="control-group">
            <label>Pattern</label>
            <select
              value={p.patternIdx}
              disabled={p.beamforming}
              onChange={(e) => p.onPatternIdxChange(Number(e.target.value))}
            >
              {p.patternNames.map((name, i) => (
                <option key={name + i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Fréquence</label>
            <select value={p.freqIdx} onChange={(e) => p.onFreqIdxChange(Number(e.target.value))}>
              {p.freqOptionsMHz.map((f, i) => (
                <option key={i} value={i}>
                  {f} MHz
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Polarisation</label>
            <select value={p.pol} onChange={(e) => p.onPolChange(e.target.value as Polarization)}>
              <option value="Total">Total</option>
              <option value="RHCP">RHCP</option>
              <option value="LHCP">LHCP</option>
            </select>
          </div>

          <div className="control-group">
            <label>Colorbar min/max (dB)</label>
            <div className="inline-fields">
              <input
                type="number"
                value={p.rangeMin}
                onChange={(e) => p.onRangeMinChange(Number(e.target.value))}
              />
              <input
                type="number"
                value={p.rangeMax}
                onChange={(e) => p.onRangeMaxChange(Number(e.target.value))}
              />
              <button onClick={p.onAutoRange}>Auto Range</button>
            </div>
          </div>

          <div className="control-group">
            <label>
              <input
                type="checkbox"
                checked={p.beamforming}
                onChange={(e) => p.onBeamformingChange(e.target.checked)}
              />
              {" "}Enable Beamforming
            </label>
            <div className="inline-fields">
              <label className="mini-label">θ</label>
              <input
                type="number"
                value={p.theta0}
                onChange={(e) => p.onTheta0Change(Number(e.target.value))}
              />
              <label className="mini-label">φ</label>
              <input
                type="number"
                value={p.phi0}
                onChange={(e) => p.onPhi0Change(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="control-group">
            <label>Coupe</label>
            <div className="inline-fields">
              <select value={p.cutType} onChange={(e) => p.onCutTypeChange(e.target.value as CutType)}>
                <option value="Phi Cut">Phi Cut</option>
                <option value="Theta Cut">Theta Cut</option>
              </select>
              <select
                value={p.cutValueDeg}
                onChange={(e) => p.onCutValueChange(Number(e.target.value))}
              >
                {p.cutOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}°
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="control-group readout">
            <label>Peak Gain (dB)</label>
            <div className="readout-value">{p.peakDb?.toFixed(2) ?? "-"}</div>
          </div>
          <div className="control-group readout">
            <label>Peak Dir. (dBi)</label>
            <div className="readout-value">{p.peakDirectivityDbi?.toFixed(2) ?? "-"}</div>
          </div>
        </>
      )}

      {p.error && <div className="error-banner">{p.error}</div>}
    </div>
  );
}
