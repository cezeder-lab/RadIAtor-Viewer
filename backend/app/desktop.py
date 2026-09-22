"""Desktop entry point: runs the FastAPI backend in a background thread and
opens it in a native window via pywebview, so the app feels like a normal
double-click Windows application instead of "open a terminal, run a
server, open a browser"."""
from __future__ import annotations

import socket
import threading
import time
import urllib.request

import uvicorn
import webview

from .main import app

HOST = "127.0.0.1"
PORT = 8000


def _port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) != 0


def _run_server() -> None:
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


def _wait_for_server(url: str, timeout: float = 10.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(url, timeout=0.5)
            return True
        except OSError:
            time.sleep(0.2)
    return False


def main() -> None:
    if not _port_available(HOST, PORT):
        raise RuntimeError(
            f"Port {PORT} is already in use. Close the other RadIAtor Viewer "
            "instance (or whatever else is using that port) and try again."
        )

    server_thread = threading.Thread(target=_run_server, daemon=True)
    server_thread.start()

    if not _wait_for_server(f"http://{HOST}:{PORT}/api/health"):
        raise RuntimeError("Backend server failed to start in time.")

    webview.create_window(
        "RadIAtor Viewer",
        f"http://{HOST}:{PORT}",
        width=1600,
        height=950,
        background_color="#000000",
    )
    webview.start()


if __name__ == "__main__":
    main()
