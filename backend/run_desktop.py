"""PyInstaller entry point (kept outside the `app` package so it can be
analyzed as a plain script; it just delegates to app.desktop.main)."""
from app.desktop import main

if __name__ == "__main__":
    main()
