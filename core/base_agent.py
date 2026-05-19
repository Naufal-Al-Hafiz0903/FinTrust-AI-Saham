import json
import time
import requests
from typing import Any
from dataclasses import dataclass, field
from core.config import OLLAMA_HOST, OLLAMA_MODEL, OLLAMA_OPTIONS


@dataclass
class AgentMessage:
    """Pesan yang beredar antar agent"""
    sender: str
    receiver: str
    content: Any
    msg_type: str = "analysis"   # analysis | task | result | error
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "sender": self.sender,
            "receiver": self.receiver,
            "content": self.content,
            "msg_type": self.msg_type,
            "timestamp": self.timestamp,
        }


@dataclass
class AgentResult:
    """Hasil analisa dari satu agent"""
    agent_name: str
    signal: str          # BULLISH | NEUTRAL | BEARISH | CAUTION | HIGH | MEDIUM | LOW
    score: int           # 0–100
    summary: str
    details: dict
    raw_response: str = ""
    success: bool = True
    error_msg: str = ""

    def to_dict(self) -> dict:
        return {
            "agent": self.agent_name,
            "signal": self.signal,
            "score": self.score,
            "summary": self.summary,
            "details": self.details,
            "success": self.success,
        }


class BaseAgent:
    """
    Base class untuk semua agent.
    Setiap agent punya:
    - nama & deskripsi unik
    - system prompt spesifik
    - metode run() yang dipanggil orchestrator
    """

    name: str = "BaseAgent"
    description: str = "Agent dasar"

    def __init__(self, host: str = OLLAMA_HOST, model: str = OLLAMA_MODEL):
        self.host = host
        self.model = model
        self.options = OLLAMA_OPTIONS.copy()
        self._message_log: list[AgentMessage] = []

    def _call_llm(self, system_prompt: str, user_message: str, retries: int = 2) -> str:
        """
        Panggil Ollama /api/chat dengan retry logic.
        Return raw text dari model.
        """
        payload = {
            "model": self.model,
            "stream": False,
            "options": self.options,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
        }

        for attempt in range(retries + 1):
            try:
                resp = requests.post(
                    f"{self.host}/api/chat",
                    json=payload,
                    timeout=120,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["message"]["content"]
            except requests.exceptions.ConnectionError:
                raise ConnectionError(f"Tidak bisa konek ke Ollama: {self.host}")
            except requests.exceptions.Timeout:
                if attempt < retries:
                    time.sleep(2)
                    continue
                raise TimeoutError(f"Ollama timeout setelah {retries+1} percobaan")
            except Exception as e:
                if attempt < retries:
                    time.sleep(1)
                    continue
                raise RuntimeError(f"LLM error: {e}")

        return ""

    def _extract_json(self, text: str) -> dict:
        """
        Ekstrak JSON dari output LLM yang mungkin berisi teks tambahan.
        Coba beberapa strategi parsing.
        """
        # Coba fenced code block dulu
        import re
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if fenced:
            try:
                return json.loads(fenced.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Coba cari objek JSON langsung
        brace_match = re.search(r"\{[\s\S]*\}", text)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

        # Fallback: coba parse seluruh text
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            raise ValueError(f"Tidak bisa parse JSON dari response:\n{text[:300]}")

    def send_message(self, msg: AgentMessage):
        """Simpan pesan ke log komunikasi agent"""
        self._message_log.append(msg)

    def get_message_log(self) -> list[dict]:
        return [m.to_dict() for m in self._message_log]

    def run(self, ticker: str, context: dict) -> AgentResult:
        """Override di tiap subclass"""
        raise NotImplementedError(f"{self.name}.run() belum diimplementasi")
