"""
Technical Agent
Analisa chart: tren, RSI, MACD, Moving Average, support/resistance, volume
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.base_agent import BaseAgent, AgentResult, AgentMessage


SYSTEM_PROMPT = """Kamu adalah Technical Analysis Agent untuk saham Indonesia dan saham luar negeri.

TUGAS:
Analisa kondisi teknikal saham berdasarkan indikator-indikator teknis yang umum digunakan.

EVALUASI:
- Tren: Apakah saham dalam uptrend / downtrend / sideways?
- RSI (Relative Strength Index): Overbought (>70) / Oversold (<30) / Normal
- MACD: Bullish crossover / Bearish crossover / Divergence
- Moving Average: Posisi harga terhadap MA20, MA50, MA200 (Golden Cross / Death Cross)
- Volume: Konfirmasi volume terhadap pergerakan harga
- Support & Resistance: Level kunci yang perlu diperhatikan
- Candlestick Pattern: Pola yang teridentifikasi (jika relevan)

UNTUK IPO:
- Analisa harga penawaran vs range valuasi teknikal sektor sejenis
- Potensi price discovery pasca listing
- Performa saham IPO sejenis di BEI dalam 6 bulan terakhir

SCORING:
- 75-100: Setup teknikal sangat bagus, momentum positif
- 55-74: Teknikal netral-positif, tunggu konfirmasi
- 40-54: Teknikal netral atau mixed signal
- 0-39: Teknikal buruk, tren negatif

OUTPUT: Jawab HANYA dengan JSON valid berikut, tanpa teks apapun sebelum atau sesudah JSON:
{
  "signal": "BULLISH|NEUTRAL|BEARISH",
  "score": <integer 0-100>,
  "summary": "<2-3 kalimat dengan level harga spesifik>",
  "details": {
    "trend": "<deskripsi tren utama>",
    "rsi": "<kondisi RSI>",
    "macd": "<kondisi MACD>",
    "moving_average": "<kondisi MA>",
    "volume": "<kondisi volume>",
    "pattern": "<pola candlestick yang relevan>"
  },
  "key_levels": {
    "support1": "<Rp X.XXX>",
    "support2": "<Rp X.XXX>",
    "resistance1": "<Rp X.XXX>",
    "resistance2": "<Rp X.XXX>"
  },
  "entry_zone": "<range harga entry yang disarankan>",
  "recommendation": "<satu kalimat rekomendasi dari perspektif teknikal>"
}"""


class TechnicalAgent(BaseAgent):
    name = "TechnicalAgent"
    description = "Analisa chart, indikator teknikal, level support/resistance, dan momentum harga"

    def run(self, ticker: str, context: dict) -> AgentResult:
        mode = context.get("mode", "listed")
        is_ipo = mode == "ipo"

        self.send_message(AgentMessage(
            sender="OrchestratorAgent",
            receiver=self.name,
            content={"ticker": ticker, "task": "technical_analysis", "mode": mode},
            msg_type="task"
        ))

        user_msg = f"""Lakukan analisa teknikal untuk saham: {ticker}
Tipe: {'IPO / Pre-IPO' if is_ipo else 'Saham Listed / Global'}

Berikan analisa berdasarkan kondisi teknikal yang kamu ketahui.
Sebutkan level support, resistance, dan zona entry yang konkret.
Jika ini IPO, analisa potensi pergerakan harga pasca listing."""

        try:
            raw = self._call_llm(SYSTEM_PROMPT, user_msg)
            data = self._extract_json(raw)

            key_levels = data.get("key_levels", {})
            result = AgentResult(
                agent_name=self.name,
                signal=data.get("signal", "NEUTRAL"),
                score=int(data.get("score", 50)),
                summary=data.get("summary", ""),
                details={
                    "trend": data.get("details", {}).get("trend", "-"),
                    "rsi": data.get("details", {}).get("rsi", "-"),
                    "macd": data.get("details", {}).get("macd", "-"),
                    "moving_average": data.get("details", {}).get("moving_average", "-"),
                    "volume": data.get("details", {}).get("volume", "-"),
                    "pattern": data.get("details", {}).get("pattern", "-"),
                    "key_levels": key_levels,
                    "entry_zone": data.get("entry_zone", "-"),
                    "recommendation": data.get("recommendation", "-"),
                },
                raw_response=raw,
            )

        except Exception as e:
            result = AgentResult(
                agent_name=self.name,
                signal="NEUTRAL",
                score=50,
                summary=f"Analisa teknikal tidak tersedia: {str(e)}",
                details={},
                success=False,
                error_msg=str(e),
            )

        self.send_message(AgentMessage(
            sender=self.name,
            receiver="OrchestratorAgent",
            content=result.to_dict(),
            msg_type="result"
        ))

        return result
