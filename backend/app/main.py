from __future__ import annotations

import os
import sys
import tempfile
import uuid
from pathlib import Path
from typing import List

import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .mat_parser import MatParseError, encode_array, parse_mvg_mat

app = FastAPI(title="RadIAtor Viewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store: upload_id -> {"az", "el", "freq", "patterns": [...]}
# Single-user local app: no eviction needed, data lives for the process lifetime.
SESSIONS: dict[str, dict] = {}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "No files provided")

    parsed = []
    for f in files:
        suffix = os.path.splitext(f.filename or "")[1] or ".mat"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await f.read())
            tmp_path = tmp.name
        try:
            result = parse_mvg_mat(tmp_path)
        except MatParseError as e:
            raise HTTPException(400, f"{f.filename}: {e}") from e
        finally:
            os.unlink(tmp_path)
        parsed.append({"filename": f.filename, **result})

    # All element files must share the same measurement grid.
    ref = parsed[0]
    for p in parsed[1:]:
        if not (
            np.array_equal(p["az"], ref["az"])
            and np.array_equal(p["el"], ref["el"])
            and np.array_equal(p["freq"], ref["freq"])
        ):
            raise HTTPException(
                400,
                f"{p['filename']} grid (Az/El/F) does not match {ref['filename']}; "
                "all element files must share the same measurement grid",
            )

    upload_id = uuid.uuid4().hex
    SESSIONS[upload_id] = {
        "az": ref["az"],
        "el": ref["el"],
        "freq": ref["freq"],
        "patterns": parsed,
    }

    return {
        "upload_id": upload_id,
        "az": ref["az"].tolist(),
        "el": ref["el"].tolist(),
        "freq": ref["freq"].tolist(),
        "pattern_filenames": [p["filename"] for p in parsed],
    }


@app.get("/api/slice")
def slice_frequency(upload_id: str, freq_idx: int = Query(..., ge=0)):
    """Return the Eth/Eph field slice at a single frequency, across all
    uploaded patterns. Kept small ([NAz x NEl] per field) so the frontend can
    do interactive polarization/beamforming/cut math without holding the
    full [NAz x NEl x NF] cube per element in browser memory."""
    session = SESSIONS.get(upload_id)
    if session is None:
        raise HTTPException(404, "Unknown upload_id (session expired or server restarted)")

    nf = session["freq"].size
    if not (0 <= freq_idx < nf):
        raise HTTPException(400, f"freq_idx out of range [0, {nf - 1}]")

    return {
        "patterns": [
            {
                "filename": p["filename"],
                "eth_re": encode_array(p["eth_re"][:, :, freq_idx]),
                "eth_im": encode_array(p["eth_im"][:, :, freq_idx]),
                "eph_re": encode_array(p["eph_re"][:, :, freq_idx]),
                "eph_im": encode_array(p["eph_im"][:, :, freq_idx]),
            }
            for p in session["patterns"]
        ]
    }


def _find_frontend_dist() -> Path | None:
    """Locate the built frontend (frontend/dist), whether running from
    source or from a PyInstaller onefile bundle (files unpacked under
    sys._MEIPASS at runtime, see desktop.spec's `datas`)."""
    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS"))
        candidate = base / "frontend_dist"
    else:
        candidate = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    return candidate if candidate.is_dir() else None


# Mounted last so it only catches paths not matched by the API routes above.
_frontend_dist = _find_frontend_dist()
if _frontend_dist is not None:
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
