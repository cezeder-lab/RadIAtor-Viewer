"""Parser for MVG Starlab measurement .mat files.

Expected MATLAB struct layout (as produced by the Starlab post-processing
export and consumed by the legacy pattern_gui MATLAB tool):

    data.axes(1).data  -> Azimuth samples [rad], length NAz
    data.axes(2).data  -> Elevation samples [rad], length NEl
    data.axes(3).data  -> Frequency samples [Hz], length NF
    data.layers(1).data -> Etheta real part, size [NAz x NEl x NF]
    data.layers(2).data -> Etheta imag part, size [NAz x NEl x NF]
    data.layers(3).data -> Ephi real part,   size [NAz x NEl x NF]
    data.layers(4).data -> Ephi imag part,   size [NAz x NEl x NF]
"""
from __future__ import annotations

import base64
import numpy as np
from scipy.io import loadmat


class MatParseError(ValueError):
    pass


def _as_list(x):
    """Normalize a MATLAB struct array (which scipy may squeeze to a scalar
    mat_struct when it has length 1) into a plain python list."""
    if isinstance(x, np.ndarray):
        return list(x)
    return [x]


def parse_mvg_mat(file_path: str) -> dict:
    mat = loadmat(file_path, squeeze_me=True, struct_as_record=False)

    if "data" not in mat:
        raise MatParseError("Top-level 'data' struct not found in .mat file")

    data = mat["data"]

    if not hasattr(data, "axes") or not hasattr(data, "layers"):
        raise MatParseError("'data' struct is missing 'axes' and/or 'layers' fields")

    axes = _as_list(data.axes)
    layers = _as_list(data.layers)

    if len(axes) < 3:
        raise MatParseError(f"Expected 3 axes (Az, El, F), got {len(axes)}")
    if len(layers) < 4:
        raise MatParseError(
            f"Expected 4 layers (Etheta_re, Etheta_im, Ephi_re, Ephi_im), got {len(layers)}"
        )

    az = np.asarray(axes[0].data, dtype=np.float64).ravel()
    el = np.asarray(axes[1].data, dtype=np.float64).ravel()
    freq = np.asarray(axes[2].data, dtype=np.float64).ravel()

    eth_re = np.asarray(layers[0].data, dtype=np.float64)
    eth_im = np.asarray(layers[1].data, dtype=np.float64)
    eph_re = np.asarray(layers[2].data, dtype=np.float64)
    eph_im = np.asarray(layers[3].data, dtype=np.float64)

    expected_shape = (az.size, el.size, freq.size)
    for name, arr in (
        ("Etheta_re", eth_re),
        ("Etheta_im", eth_im),
        ("Ephi_re", eph_re),
        ("Ephi_im", eph_im),
    ):
        if arr.shape != expected_shape:
            raise MatParseError(
                f"{name} has shape {arr.shape}, expected {expected_shape} "
                f"(NAz x NEl x NF)"
            )

    return {
        "az": az,
        "el": el,
        "freq": freq,
        "eth_re": eth_re,
        "eth_im": eth_im,
        "eph_re": eph_re,
        "eph_im": eph_im,
    }


def encode_array(arr: np.ndarray) -> dict:
    """Encode a numpy array as base64 float32 for compact JSON transfer.

    The frontend reconstructs a Float32Array and reshapes using `shape`,
    so the buffer must be C-contiguous (row-major) to match.
    """
    arr32 = np.ascontiguousarray(np.asarray(arr, dtype=np.float32))
    return {
        "shape": list(arr32.shape),
        "data": base64.b64encode(arr32.tobytes()).decode("ascii"),
    }
