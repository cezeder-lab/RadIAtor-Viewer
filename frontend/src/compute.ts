import { decodeArray } from "./api";
import type { Method, Polarization, RawSlicePattern } from "./types";

const EPS = 2.220446049250313e-16; // MATLAB `eps`

export interface ComplexGrid {
  re: Float32Array;
  im: Float32Array;
}

export interface EmbeddedPattern {
  name: string;
  eth: ComplexGrid;
  eph: ComplexGrid;
}

function decodeComplex(reEnc: RawSlicePattern["eth_re"], imEnc: RawSlicePattern["eth_im"]): ComplexGrid {
  return { re: decodeArray(reEnc), im: decodeArray(imEnc) };
}

/** Reproduces DATA.method branch in loadData(): differential (toggling
 * phase) extraction of embedded element patterns, or raw passthrough. */
export function buildEmbeddedPatterns(
  rawPatterns: RawSlicePattern[],
  method: Method,
): EmbeddedPattern[] {
  const rawEth = rawPatterns.map((p) => decodeComplex(p.eth_re, p.eth_im));
  const rawEph = rawPatterns.map((p) => decodeComplex(p.eph_re, p.eph_im));

  if (method === "Toggling Phase") {
    const out: EmbeddedPattern[] = [];
    const ref_eth = rawEth[0];
    const ref_eph = rawEph[0];
    for (let k = 1; k < rawPatterns.length; k++) {
      const n = ref_eth.re.length;
      const eth: ComplexGrid = { re: new Float32Array(n), im: new Float32Array(n) };
      const eph: ComplexGrid = { re: new Float32Array(n), im: new Float32Array(n) };
      for (let i = 0; i < n; i++) {
        eth.re[i] = (-rawEth[k].re[i] + ref_eth.re[i]) / 2;
        eth.im[i] = (-rawEth[k].im[i] + ref_eth.im[i]) / 2;
        eph.re[i] = (-rawEph[k].re[i] + ref_eph.re[i]) / 2;
        eph.im[i] = (-rawEph[k].im[i] + ref_eph.im[i]) / 2;
      }
      out.push({ name: rawPatterns[k].filename, eth, eph });
    }
    return out;
  }

  return rawPatterns.map((p, k) => ({
    name: p.filename,
    eth: rawEth[k],
    eph: rawEph[k],
  }));
}

function rhcpLhcpAt(eth: ComplexGrid, eph: ComplexGrid, i: number) {
  const invSqrt2 = 1 / Math.SQRT2;
  const rhcpRe = (eth.re[i] - eph.im[i]) * invSqrt2;
  const rhcpIm = (eth.im[i] + eph.re[i]) * invSqrt2;
  const lhcpRe = (eth.re[i] + eph.im[i]) * invSqrt2;
  const lhcpIm = (eth.im[i] - eph.re[i]) * invSqrt2;
  return { rhcpRe, rhcpIm, lhcpRe, lhcpIm };
}

/** dB(Total/RHCP/LHCP) from complex Eth/Eph, matching DATA.EtotDB /
 * DATA.ErhcpDB / DATA.ElhcpDB. */
export function computeDb(eth: ComplexGrid, eph: ComplexGrid, pol: Polarization): Float32Array {
  const n = eth.re.length;
  const out = new Float32Array(n);
  if (pol === "Total") {
    for (let i = 0; i < n; i++) {
      const mag = Math.hypot(eth.re[i], eth.im[i], eph.re[i], eph.im[i]);
      out[i] = 20 * Math.log10(mag + EPS);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const { rhcpRe, rhcpIm, lhcpRe, lhcpIm } = rhcpLhcpAt(eth, eph, i);
      const mag = pol === "RHCP" ? Math.hypot(rhcpRe, rhcpIm) : Math.hypot(lhcpRe, lhcpIm);
      out[i] = 20 * Math.log10(mag + EPS);
    }
  }
  return out;
}

/** Beamforms all embedded patterns toward (azIdx, elIdx) and returns the
 * dB(pol) grid for the combined array pattern. Weight+sum is applied to
 * Eth/Eph directly (equivalent to weighting Erhcp/Elhcp, since the
 * RHCP/LHCP decomposition is a unitary rotation of Eth/Eph — same result,
 * less work) instead of the literal MATLAB order. */
export function computeBeamformedDb(
  patterns: EmbeddedPattern[],
  steerIdx: number,
  pol: Polarization,
): Float32Array {
  const n = patterns[0].eth.re.length;
  const nP = patterns.length;

  const wRe = new Float32Array(nP);
  const wIm = new Float32Array(nP);
  for (let p = 0; p < nP; p++) {
    const { rhcpRe, rhcpIm } = rhcpLhcpAt(patterns[p].eth, patterns[p].eph, steerIdx);
    const ang = Math.atan2(rhcpIm, rhcpRe);
    wRe[p] = Math.cos(-ang);
    wIm[p] = Math.sin(-ang);
  }

  const ethSum: ComplexGrid = { re: new Float32Array(n), im: new Float32Array(n) };
  const ephSum: ComplexGrid = { re: new Float32Array(n), im: new Float32Array(n) };
  for (let p = 0; p < nP; p++) {
    const { eth, eph } = patterns[p];
    const wr = wRe[p];
    const wi = wIm[p];
    for (let i = 0; i < n; i++) {
      ethSum.re[i] += eth.re[i] * wr - eth.im[i] * wi;
      ethSum.im[i] += eth.re[i] * wi + eth.im[i] * wr;
      ephSum.re[i] += eph.re[i] * wr - eph.im[i] * wi;
      ephSum.im[i] += eph.re[i] * wi + eph.im[i] * wr;
    }
  }

  return computeDb(ethSum, ephSum, pol);
}

function meanDiff(arr: number[]): number {
  let sum = 0;
  for (let i = 1; i < arr.length; i++) sum += arr[i] - arr[i - 1];
  return sum / (arr.length - 1);
}

/** Peak level and peak directivity (numerical solid-angle integration),
 * matching the PeakVal / D_peak_dBi block in updatePlot(). Uses the
 * UNCLIPPED dB grid (computed before the colorbar range clamp). */
export function computePeakDirectivity(
  eDb: Float32Array,
  az: number[],
  el: number[],
  nAz: number,
  nEl: number,
): { peakDb: number; peakDirectivityDbi: number } {
  let peakDb = -Infinity;
  for (let i = 0; i < eDb.length; i++) if (eDb[i] > peakDb) peakDb = eDb[i];

  const dAz = meanDiff(az);
  const dEl = meanDiff(el);

  let sumWeighted = 0;
  for (let iEl = 0; iEl < nEl; iEl++) {
    const s = Math.sin(el[iEl]);
    for (let iAz = 0; iAz < nAz; iAz++) {
      const uLin = Math.pow(10, eDb[iAz * nEl + iEl] / 10);
      sumWeighted += uLin * s;
    }
  }
  const pRad = sumWeighted * dEl * dAz;
  const maxULin = Math.pow(10, peakDb / 10);
  const dPeak = (4 * Math.PI * maxULin) / pRad;

  return { peakDb, peakDirectivityDbi: 10 * Math.log10(dPeak) };
}

/** R/C grid used by both the 3D surface and the cuts, matching MATLAB's
 * `R = R'; R = [R, R(:,1)];` (transpose to [El x Az], then wrap azimuth
 * by duplicating the first column at the end). Shape: [nEl][nAz+1]. */
export function buildRC(
  eDbClipped: Float32Array,
  nAz: number,
  nEl: number,
  rangeMin: number,
  rangeMax: number,
): { R: number[][]; C: number[][] } {
  const R: number[][] = [];
  const C: number[][] = [];
  for (let iEl = 0; iEl < nEl; iEl++) {
    const rowR: number[] = [];
    const rowC: number[] = [];
    for (let iAz = 0; iAz <= nAz; iAz++) {
      const srcAz = iAz < nAz ? iAz : 0;
      const e = eDbClipped[srcAz * nEl + iEl];
      rowR.push((e - rangeMin) / (rangeMax - rangeMin));
      rowC.push(e);
    }
    R.push(rowR);
    C.push(rowC);
  }
  return { R, C };
}

export function clipToRangeMin(eDb: Float32Array, rangeMin: number): Float32Array {
  const out = new Float32Array(eDb.length);
  for (let i = 0; i < eDb.length; i++) out[i] = Math.max(eDb[i], rangeMin);
  return out;
}

export interface Surface3D {
  x: number[][];
  y: number[][];
  z: number[][];
  c: number[][];
}

export function buildSurface(R: number[][], C: number[][], az: number[], el: number[]): Surface3D {
  const azExt = [...az, az[0] + 2 * Math.PI];
  const x: number[][] = [];
  const y: number[][] = [];
  const z: number[][] = [];
  for (let iEl = 0; iEl < el.length; iEl++) {
    const rowX: number[] = [];
    const rowY: number[] = [];
    const rowZ: number[] = [];
    const elVal = el[iEl];
    for (let iAz = 0; iAz < azExt.length; iAz++) {
      const r = R[iEl][iAz];
      const azVal = azExt[iAz];
      rowX.push(r * Math.cos(azVal) * Math.sin(elVal));
      rowY.push(r * Math.sin(azVal) * Math.sin(elVal));
      rowZ.push(r * Math.cos(elVal));
    }
    x.push(rowX);
    y.push(rowY);
    z.push(rowZ);
  }
  return { x, y, z, c: C };
}

function nearestIndex(arr: number[], target: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

function mod360(v: number): number {
  return ((v % 360) + 360) % 360;
}

export interface CutResult {
  sai: number[];
  rFull: number[];
  cut3D: { x: number[]; y: number[]; z: number[] };
  titleText: string;
}

/** φ-cut: elevation profile at a fixed azimuth, mirrored with its antipodal
 * cut (φ+180°) to form a continuous -θ..+θ sweep. */
export function phiCut(R: number[][], az: number[], el: number[], phiCutDeg: number): CutResult {
  const azDeg = az.map((a) => (a * 180) / Math.PI);
  const phiIdx = nearestIndex(azDeg, phiCutDeg);
  const phiIdx180 = nearestIndex(azDeg, mod360(phiCutDeg + 180));

  const nEl = el.length;
  const rCut: number[] = [];
  const rCut180: number[] = [];
  for (let iEl = 0; iEl < nEl; iEl++) {
    rCut.push(R[iEl][phiIdx]);
    rCut180.push(R[iEl][phiIdx180]);
  }

  const sai: number[] = [];
  const rFull: number[] = [];
  for (let i = nEl - 1; i >= 1; i--) {
    sai.push(-el[i]);
    rFull.push(rCut180[i]);
  }
  for (let i = 0; i < nEl; i++) {
    sai.push(el[i]);
    rFull.push(rCut[i]);
  }

  const phiRad = (phiCutDeg * Math.PI) / 180;
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  for (let i = 0; i < sai.length; i++) {
    const r = rFull[i];
    const s = sai[i];
    x.push(r * Math.sin(s) * Math.cos(phiRad));
    y.push(r * Math.sin(s) * Math.sin(phiRad));
    z.push(r * Math.cos(s));
  }

  return { sai, rFull, cut3D: { x, y, z }, titleText: `φ=${phiCutDeg}° cut` };
}

/** θ-cut: azimuthal profile at a fixed elevation (full wrapped loop). */
export function thetaCut(R: number[][], az: number[], el: number[], thetaCutDeg: number): CutResult {
  const elDeg = el.map((e) => (e * 180) / Math.PI);
  const elIdx = nearestIndex(elDeg, thetaCutDeg);

  const azExt = [...az, az[0] + 2 * Math.PI];
  const rFull = R[elIdx];
  const sai = azExt;

  const thetaRad = (thetaCutDeg * Math.PI) / 180;
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  for (let i = 0; i < sai.length; i++) {
    const r = rFull[i];
    x.push(r * Math.sin(thetaRad) * Math.cos(sai[i]));
    y.push(r * Math.sin(thetaRad) * Math.sin(sai[i]));
    z.push(r * Math.cos(thetaRad));
  }

  return { sai, rFull, cut3D: { x, y, z }, titleText: `θ=${thetaCutDeg}° cut` };
}

/** Flat 2D projection shared by both cut types: x=r·cos(sai), y=r·sin(sai). */
export function flatten2D(cut: CutResult): { x: number[]; y: number[] } {
  const x = cut.sai.map((s, i) => cut.rFull[i] * Math.cos(s));
  const y = cut.sai.map((s, i) => cut.rFull[i] * Math.sin(s));
  return { x, y };
}

export function nearestIndexRad(arr: number[], targetRad: number): number {
  return nearestIndex(arr, targetRad);
}

export function thetaRings(): { x: number[]; y: number[]; z: number[] }[] {
  return [30, 60, 90, 120, 150].map((deg) => {
    const t = (deg * Math.PI) / 180;
    const phi = Array.from({ length: 200 }, (_, i) => (i / 199) * 2 * Math.PI);
    return {
      x: phi.map((p) => Math.sin(t) * Math.cos(p)),
      y: phi.map((p) => Math.sin(t) * Math.sin(p)),
      z: phi.map(() => Math.cos(t)),
    };
  });
}

export function phiRings(): { x: number[]; y: number[]; z: number[] }[] {
  const rings: { x: number[]; y: number[]; z: number[] }[] = [];
  for (let deg = 0; deg < 360; deg += 45) {
    const p = (deg * Math.PI) / 180;
    const theta = Array.from({ length: 200 }, (_, i) => (i / 199) * Math.PI);
    rings.push({
      x: theta.map((t) => Math.sin(t) * Math.cos(p)),
      y: theta.map((t) => Math.sin(t) * Math.sin(p)),
      z: theta.map((t) => Math.cos(t)),
    });
  }
  return rings;
}

export function beamDirectionVector(theta0Deg: number, phi0Deg: number) {
  const theta0 = (theta0Deg * Math.PI) / 180;
  const phi0 = (phi0Deg * Math.PI) / 180;
  return {
    x: Math.sin(theta0) * Math.cos(phi0),
    y: Math.sin(theta0) * Math.sin(phi0),
    z: Math.cos(theta0),
  };
}
