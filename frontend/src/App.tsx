import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { fetchSlice, uploadFiles } from "./api";
import Controls from "./components/Controls";
import Pattern3D from "./components/Pattern3D";
import PolarCut2D from "./components/PolarCut2D";
import {
  beamDirectionVector,
  buildEmbeddedPatterns,
  buildRC,
  buildSurface,
  clipToRangeMin,
  computeBeamformedDb,
  computeDb,
  computePeakDirectivity,
  flatten2D,
  nearestIndexRad,
  phiCut,
  phiRings,
  thetaCut,
  thetaRings,
  type EmbeddedPattern,
} from "./compute";
import type { CutType, Method, Polarization, SliceResponse, UploadResponse } from "./types";

function extractElementIndex(filename: string): number {
  const m = filename.match(/(\d+)(?=\.[^.]*$)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

function sortFilesByElementIndex(files: File[]): File[] {
  return [...files].sort((a, b) => extractElementIndex(a.name) - extractElementIndex(b.name));
}

function uniqueRoundedDeg(valsRad: number[]): number[] {
  const set = new Set(valsRad.map((v) => Math.round((v * 180) / Math.PI)));
  return Array.from(set).sort((a, b) => a - b);
}

export default function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [method, setMethod] = useState<Method>("Toggling Phase");
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [slice, setSlice] = useState<SliceResponse | null>(null);
  const [freqIdx, setFreqIdx] = useState(0);
  const [patternIdx, setPatternIdx] = useState(0);
  const [pol, setPol] = useState<Polarization>("Total");
  const [rangeMin, setRangeMin] = useState(-25);
  const [rangeMax, setRangeMax] = useState(5);
  const [beamforming, setBeamforming] = useState(false);
  const [theta0, setTheta0] = useState(30);
  const [phi0, setPhi0] = useState(0);
  const [cutType, setCutType] = useState<CutType>("Phi Cut");
  const [cutValueDeg, setCutValueDeg] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSelectedFiles(sortFilesByElementIndex(files));
  }

  async function onLoadData() {
    if (selectedFiles.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await uploadFiles(selectedFiles);
      setUpload(resp);
      setFreqIdx(0);
      const sl = await fetchSlice(resp.upload_id, 0);
      setSlice(sl);
      setPatternIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!upload) return;
    let cancelled = false;
    setLoading(true);
    fetchSlice(upload.upload_id, freqIdx)
      .then((sl) => {
        if (!cancelled) setSlice(sl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // freqIdx changes trigger a refetch; `upload` identity change is handled by onLoadData's initial fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freqIdx]);

  const embeddedPatterns: EmbeddedPattern[] = useMemo(() => {
    if (!slice) return [];
    return buildEmbeddedPatterns(slice.patterns, method);
  }, [slice, method]);

  const nAz = upload?.az.length ?? 0;
  const nEl = upload?.el.length ?? 0;

  const azDegOptions = useMemo(() => (upload ? uniqueRoundedDeg(upload.az) : []), [upload]);
  const elDegOptions = useMemo(() => (upload ? uniqueRoundedDeg(upload.el) : []), [upload]);
  const cutOptions = cutType === "Phi Cut" ? azDegOptions : elDegOptions;

  useEffect(() => {
    if (cutOptions.length > 0 && !cutOptions.includes(cutValueDeg)) {
      setCutValueDeg(cutOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutOptions]);

  const safePatternIdx = Math.min(patternIdx, Math.max(embeddedPatterns.length - 1, 0));

  const result = useMemo(() => {
    if (!upload || embeddedPatterns.length === 0) return null;
    const az = upload.az;
    const el = upload.el;

    let eDbRaw: Float32Array;
    if (beamforming) {
      const azIdx = nearestIndexRad(az, (phi0 * Math.PI) / 180);
      const elIdx = nearestIndexRad(el, (theta0 * Math.PI) / 180);
      const steerIdx = azIdx * nEl + elIdx;
      eDbRaw = computeBeamformedDb(embeddedPatterns, steerIdx, pol);
    } else {
      const patternData = embeddedPatterns[safePatternIdx];
      eDbRaw = computeDb(patternData.eth, patternData.eph, pol);
    }

    const rMinOrdered = Math.min(rangeMin, rangeMax);
    const rMaxOrdered = Math.max(rangeMin, rangeMax);

    const eDbClipped = clipToRangeMin(eDbRaw, rMinOrdered);
    const { R, C } = buildRC(eDbClipped, nAz, nEl, rMinOrdered, rMaxOrdered);
    const surface = buildSurface(R, C, az, el);
    const peak = computePeakDirectivity(eDbRaw, az, el, nAz, nEl);
    const cut =
      cutType === "Phi Cut" ? phiCut(R, az, el, cutValueDeg) : thetaCut(R, az, el, cutValueDeg);
    const flat = flatten2D(cut);

    return { surface, peak, cut, flat, rMinOrdered, rMaxOrdered };
  }, [
    upload,
    embeddedPatterns,
    beamforming,
    phi0,
    theta0,
    pol,
    safePatternIdx,
    rangeMin,
    rangeMax,
    cutType,
    cutValueDeg,
    nAz,
    nEl,
  ]);

  function onAutoRange() {
    if (!result) return;
    const newMax = Math.ceil(result.peak.peakDb);
    setRangeMax(newMax);
    setRangeMin(newMax - 40);
  }

  const rings = useMemo(() => ({ theta: thetaRings(), phi: phiRings() }), []);
  const beamVec = beamforming ? beamDirectionVector(theta0, phi0) : null;

  const freqLabel = upload ? (upload.freq[freqIdx] / 1e6).toFixed(1) : "";
  const headerText = beamforming
    ? `Beamforming θ=${theta0}° | φ=${phi0}° | ${pol} | ${freqLabel} MHz`
    : `${embeddedPatterns[safePatternIdx]?.name ?? ""} | ${pol} | ${freqLabel} MHz`;

  return (
    <div className="app-root">
      <h1 className="app-title">RadIAtor Viewer — Starlab MVG</h1>
      <Controls
        onFilesSelected={onFilesSelected}
        selectedFileNames={selectedFiles.map((f) => f.name)}
        onLoadData={onLoadData}
        loading={loading}
        method={method}
        onMethodChange={setMethod}
        patternNames={embeddedPatterns.map((p) => p.name)}
        patternIdx={safePatternIdx}
        onPatternIdxChange={setPatternIdx}
        freqOptionsMHz={(upload?.freq ?? []).map((f) => (f / 1e6).toFixed(1))}
        freqIdx={freqIdx}
        onFreqIdxChange={setFreqIdx}
        pol={pol}
        onPolChange={setPol}
        rangeMin={rangeMin}
        rangeMax={rangeMax}
        onRangeMinChange={setRangeMin}
        onRangeMaxChange={setRangeMax}
        onAutoRange={onAutoRange}
        beamforming={beamforming}
        onBeamformingChange={setBeamforming}
        theta0={theta0}
        phi0={phi0}
        onTheta0Change={setTheta0}
        onPhi0Change={setPhi0}
        cutType={cutType}
        onCutTypeChange={setCutType}
        cutOptions={cutOptions}
        cutValueDeg={cutValueDeg}
        onCutValueChange={setCutValueDeg}
        peakDb={result?.peak.peakDb ?? null}
        peakDirectivityDbi={result?.peak.peakDirectivityDbi ?? null}
        dataLoaded={!!upload}
        error={error}
      />

      {result && (
        <div className="plots-row">
          <div className="plot-3d">
            <Pattern3D
              surface={result.surface}
              rings={rings}
              cut3D={result.cut.cut3D}
              beam={beamVec}
              rangeMin={result.rMinOrdered}
              rangeMax={result.rMaxOrdered}
            />
          </div>
          <div className="plot-2d">
            <PolarCut2D
              x={result.flat.x}
              y={result.flat.y}
              rangeMin={result.rMinOrdered}
              rangeMax={result.rMaxOrdered}
              headerText={headerText}
              titleText={result.cut.titleText}
            />
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="empty-state">Charge des fichiers .mat pour commencer.</div>
      )}
    </div>
  );
}
