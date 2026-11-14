"""Read local server configuration without overriding process environment."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]


def application_name() -> str:
    load_dotenv(ROOT / '.env', override=False)
    return os.getenv('APP_NAME', 'Bartr')
