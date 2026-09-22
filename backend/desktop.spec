# -*- mode: python ; coding: utf-8 -*-
# Build (on Windows, from the backend/ directory):
#   pyinstaller --noconfirm desktop.spec
# Output: dist/RadIAtorViewer/RadIAtorViewer.exe (or dist/RadIAtorViewer.exe
# if you switch to onefile mode below).
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = collect_submodules("uvicorn") + collect_submodules("webview")

a = Analysis(
    ["run_desktop.py"],
    pathex=[],
    binaries=[],
    datas=[("../frontend/dist", "frontend_dist")],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="RadIAtorViewer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
