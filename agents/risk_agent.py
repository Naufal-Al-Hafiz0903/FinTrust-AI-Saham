"""
Risk Assessment Agent
Identifikasi dan kuantifikasi risiko: volatilitas, bisnis, regulasi, makro, likuiditas
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.base_agent import BaseAgent, AgentResult, AgentMessage


SYSTEM_PROMPT = """Kamu adalah Risk Assessment Agent untuk investasi saham Indonesia dan luar negeri.

TUGAS:
Identifikasi, analisa, dan kuantifikasi semua risiko yang relevan untuk investasi di saham ini.

DIMENSI RISIKO:
1. Risiko Bisnis: Kompetisi, model bisnis, ketergantungan pada pelanggan/supplier utama
2. Risiko Keuangan: Utang tinggi, cash flow negatif, going concern
3. Risiko Regulasi: Potensi perubahan regulasi yang merugikan bisnis
4. Risiko Makro: Sensitivitas terhadap suku bunga, kurs, komoditas, siklus ekonomi
5. Risiko Likuiditas: Volume trading tipis, free float kecil, sulit jual saat butuh
6. Risiko Valuasi: Saham sudah terlalu mahal vs fundamental
7. Risiko Pasar: Beta tinggi, korelasi dengan IHSG/sektor
8. Risiko Spesifik: Risiko unik yang hanya berlaku untuk saham/sektor ini

UNTUK IPO, tambahan:
9. Risiko Lock-up: Pemegang saham lama bisa jual besar setelah masa lock-up
10. Risiko Harga Penawaran: Apakah IPO terlalu mahal vs fair value?
11. Risiko Underperformance: Statistik IPO di BEI yang underperform

SCORING (semakin tinggi = semakin BERISIKO):
- 0-30: Risiko rendah → sinyal LOW
- 31-55: Risiko sedang → sinyal MEDIUM
- 56-100: Risiko tinggi → sinyal HIGH

OUTPUT: Jawab HANYA dengan JSON valid berikut:
{
  "signal": "LOW|MEDIUM|HIGH",
  "score": <integer 0-100 (semakin tinggi = semakin berisiko)>,
  "risk_level": "RENDAH|SEDANG|TINGGI",
  "summary": "<2-3 kalimat ringkasan risiko utama>",
  "details": {
    "business_risk": "<penilaian risiko bisnis>",
    "financial_risk": "<penilaian risiko keuangan>",
    "regulatory_risk": "<penilaian risiko regulasi>",
    "macro_risk": "<penilaian risiko makro>",
    "liquidity_risk": "<penilaian risiko likuiditas>",
    "valuation_risk": "<penilaian risiko valuasi>"
  },
  "top_risks": [
    {"risk": "<nama risiko>", "severity": "HIGH|MEDIUM|LOW", "description": "<penjelasan singkat>"},
    {"risk": "<nama risiko>", "severity": "HIGH|MEDIUM|LOW", "description": "<penjelasan singkat>"},
    {"risk": "<nama risiko>", "severity": "HIGH|MEDIUM|LOW", "description": "<penjelasan singkat>"}
  ],
  "risk_mitigation": ["<cara mitigasi 1>", "<cara mitigasi 2>"],
  "recommendation": "<satu kalimat rekomendasi dari perspektif manajemen risiko>"
}"""


class RiskAgent(BaseAgent):
    name = "RiskAgent"
    description = "Identifikasi dan kuantifikasi risiko investasi dari berbagai dimensi"

    def run(self, ticker: str, context: dict) -> AgentResult:
        mode = context.get("mode", "listed")
        is_ipo = mode == "ipo"

        self.send_message(AgentMessage(
            sender="OrchestratorAgent",
            receiver=self.name,
            content={"ticker": ticker, "task": "risk_assessment", "mode": mode},
            msg_type="task"
        ))

        user_msg = f"""Lakukan penilaian risiko investasi untuk saham: {ticker}
Tipe: {'IPO / Pre-IPO' if is_ipo else 'Saham Listed / Global'}

Identifikasi semua dimensi risiko yang relevan.
Berikan penilaian jujur termasuk risiko yang sering diabaikan investor ritel.
Sebutkan cara mitigasi risiko yang praktis."""

        try:
            raw = self._call_llm(SYSTEM_PROMPT, user_msg)
            data = self._extract_json(raw)

            # Invert score untuk risk: HIGH risk = score rendah dalam composite
            raw_risk_score = int(data.get("score", 50))
            # Inverted: risk score 80 → contribution ke composite = 20
            inverted_score = 100 - raw_risk_score

            result = AgentResult(
                agent_name=self.name,
                signal=data.get("signal", "MEDIUM"),
                score=inverted_score,  # score yang dipakai composite (inverted)
                summary=data.get("summary", ""),
                details={
                    "risk_level": data.get("risk_level", "SEDANG"),
                    "raw_risk_score": raw_risk_score,
                    "business_risk": data.get("details", {}).get("business_risk", "-"),
                    "financial_risk": data.get("details", {}).get("financial_risk", "-"),
                    "regulatory_risk": data.get("details", {}).get("regulatory_risk", "-"),
                    "macro_risk": data.get("details", {}).get("macro_risk", "-"),
                    "liquidity_risk": data.get("details", {}).get("liquidity_risk", "-"),
                    "valuation_risk": data.get("details", {}).get("valuation_risk", "-"),
                    "top_risks": data.get("top_risks", []),
                    "risk_mitigation": data.get("risk_mitigation", []),
                    "recommendation": data.get("recommendation", "-"),
                },
                raw_response=raw,
            )

        except Exception as e:
            result = AgentResult(
                agent_name=self.name,
                signal="MEDIUM",
                score=50,
                summary=f"Penilaian risiko tidak tersedia: {str(e)}",
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
