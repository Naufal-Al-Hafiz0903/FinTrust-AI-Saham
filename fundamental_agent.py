"""
Fundamental Agent
Analisa kesehatan keuangan: PER, PBV, ROE, DER, revenue growth, dividend
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.base_agent import BaseAgent, AgentResult, AgentMessage


SYSTEM_PROMPT = """Kamu adalah Fundamental Analysis Agent untuk saham Indonesia dan saham luar negeri.

TUGAS:
Analisa kondisi fundamental perusahaan berdasarkan pengetahuanmu tentang laporan keuangan, valuasi, dan kesehatan bisnis.

UNTUK SAHAM LISTED, evaluasi:
- Valuasi: PER (Price-to-Earnings), PBV (Price-to-Book Value)
- Profitabilitas: ROE, ROA, Net Profit Margin
- Leverage: Debt-to-Equity Ratio (DER)
- Pertumbuhan: Revenue YoY, Net Income YoY
- Dividen: Dividend Yield, Payout Ratio

UNTUK SAHAM IPO, evaluasi:
- Harga penawaran vs valuasi wajar (peer comparison)
- Track record keuangan 3 tahun terakhir
- Prospek pertumbuhan revenue
- Kualitas manajemen dan pemegang saham
- Use of proceeds (penggunaan dana IPO)

SCORING GUIDE:
- 75-100: Fundamental sangat kuat, layak beli
- 55-74: Fundamental baik dengan beberapa catatan
- 40-54: Fundamental netral, wait and see
- 0-39: Fundamental lemah, hindari

OUTPUT: Jawab HANYA dengan JSON valid berikut, tanpa teks tambahan apapun:
{
  "signal": "BULLISH|NEUTRAL|BEARISH",
  "score": <integer 0-100>,
  "summary": "<2-3 kalimat ringkasan dengan data spesifik>",
  "details": {
    "valuation": "<penilaian PER/PBV>",
    "profitability": "<penilaian ROE/margin>",
    "growth": "<penilaian pertumbuhan revenue/laba>",
    "leverage": "<penilaian utang>",
    "dividend": "<penilaian dividen jika ada>"
  },
  "key_metrics": ["<metrik penting 1>", "<metrik penting 2>", "<metrik penting 3>"],
  "recommendation": "<satu kalimat rekomendasi dari perspektif fundamental>"
}"""


class FundamentalAgent(BaseAgent):
    name = "FundamentalAgent"
    description = "Analisa kesehatan keuangan, valuasi, dan prospek bisnis perusahaan"

    def run(self, ticker: str, context: dict) -> AgentResult:
        mode = context.get("mode", "listed")
        is_ipo = mode == "ipo"

        # Kirim pesan ke log (simulasi komunikasi antar agent)
        self.send_message(AgentMessage(
            sender="OrchestratorAgent",
            receiver=self.name,
            content={"ticker": ticker, "task": "fundamental_analysis", "mode": mode},
            msg_type="task"
        ))

        user_msg = f"""Lakukan analisa fundamental untuk saham: {ticker}
Tipe: {'IPO / Pre-IPO' if is_ipo else 'Saham Listed / Global'}

Gunakan pengetahuanmu tentang perusahaan ini. Jika kamu mengenal perusahaan ini, berikan data spesifik.
Jika tidak mengenal, berikan analisa berdasarkan konteks nama/sektor yang tersirat dari ticker.
Berikan penilaian yang jujur dan terukur."""

        try:
            raw = self._call_llm(SYSTEM_PROMPT, user_msg)
            data = self._extract_json(raw)

            result = AgentResult(
                agent_name=self.name,
                signal=data.get("signal", "NEUTRAL"),
                score=int(data.get("score", 50)),
                summary=data.get("summary", ""),
                details={
                    "valuation": data.get("details", {}).get("valuation", "-"),
                    "profitability": data.get("details", {}).get("profitability", "-"),
                    "growth": data.get("details", {}).get("growth", "-"),
                    "leverage": data.get("details", {}).get("leverage", "-"),
                    "dividend": data.get("details", {}).get("dividend", "-"),
                    "key_metrics": data.get("key_metrics", []),
                    "recommendation": data.get("recommendation", "-"),
                },
                raw_response=raw,
            )

        except Exception as e:
            result = AgentResult(
                agent_name=self.name,
                signal="NEUTRAL",
                score=50,
                summary=f"Analisa fundamental tidak tersedia: {str(e)}",
                details={},
                success=False,
                error_msg=str(e),
            )

        # Balas ke orchestrator
        self.send_message(AgentMessage(
            sender=self.name,
            receiver="OrchestratorAgent",
            content=result.to_dict(),
            msg_type="result"
        ))

        return result
