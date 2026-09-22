export interface EncodedArray {
  shape: number[];
  data: string; // base64 float32, C-order (row-major)
}

export interface RawSlicePattern {
  filename: string;
  eth_re: EncodedArray;
  eth_im: EncodedArray;
  eph_re: EncodedArray;
  eph_im: EncodedArray;
}

export interface SliceResponse {
  patterns: RawSlicePattern[];
}

export interface UploadResponse {
  upload_id: string;
  az: number[]; // radians
  el: number[]; // radians
  freq: number[]; // Hz
  pattern_filenames: string[];
}

export type Method = "Toggling Phase" | "Standard";
export type Polarization = "Total" | "RHCP" | "LHCP";
export type CutType = "Phi Cut" | "Theta Cut";
