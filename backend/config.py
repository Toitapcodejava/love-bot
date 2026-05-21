import os
import yaml
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    anthropic_api_key: str
    voyage_api_key: str
    database_url: str
    app_shared_key: str
    chat_model: str = "claude-sonnet-4-6"
    extract_model: str = "claude-haiku-4-5-20251001"


settings = Settings()

ROOT = Path(__file__).parent.parent
PROMPTS = Path(__file__).parent / "prompts"


def load_seed() -> dict:
    return yaml.safe_load((ROOT / "seed.yaml").read_text(encoding="utf-8"))


def load_style() -> str:
    return (ROOT / "style.md").read_text(encoding="utf-8")


def load_prompt(name: str) -> str:
    return (PROMPTS / f"{name}.txt").read_text(encoding="utf-8")
