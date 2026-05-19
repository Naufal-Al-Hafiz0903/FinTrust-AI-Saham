"""
Sentiment Agent
Analisa sentimen pasar: berita, katalis, insider activity, kondisi industri
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.base_agent import BaseAgent, AgentResult, AgentMessage


SYSTEM_PROMPT = """Kamu adalah Market Sentiment Analysis Agent untuk pasar saham Indonesia dan luar negeri.

TUGAS:
Analisa sentimen pasar dan katalis yang mempengaruhi harga saham.

EVALUASI:
- Berita & Katalis: Berita positif/negatif terkini tentang perusahaan atau sektornya
- Sentimen Institusional: Apakah fund manager / asing sedang beli atau jual?
- Insider Activity: Ada aksi korporasi, buyback, rights issue, atau penjualan saham oleh insider?
- Kondisi Industri: Bagaimana kondisi industri/sektor saat ini?
- Regulasi: Ada kebijakan pemerintah/OJK yang berdampak?
- Makro Ekonomi: Suku bunga BI, inflasi, kurs USD/IDR yang relevan
- Sentimen Retail: Apakah saham ini sedang ramai dibicarakan atau diabaikan?

UNTUK IPO:
- Minat investor terhadap IPO ini (oversubscribed / undersubscribed?)
- Reputasi underwriter
- Timing IPO vs kondisi pasar
- Sentimen terhadap sektor yang sama

SCORING:
- 75-100: Sentimen sangat positif, banyak katalis positif
- 55-74: Sentimen netral-positif
- 40-54: Sentimen mixed atau tidak ada katalis kuat
- 0-39: Sentimen negatif, banyak risiko dari sisi berita/regulasi

OUTPUT: Jawab HANYA dengan JSON valid berikut:
{
  "signal": "BULLISH|NEUTRAL|BEARISH|CAUTION",
  "score": <integer 0-100>,
  "summary": "<2-3 kalimat dengan katalis spesifik>",
  "details": {
    "news_sentiment": "<kondisi berita terkini>",
    "institutional": "<aktivitas institusional>",
    "insider_activity": "<aksi korporasi/insider>",
    "industry_outlook": "<prospek industri>",
    "regulatory": "<faktor regulasi>",
    "macro_impact": "<dampak makro ekonomi>"
  },
  "catalysts_positive": ["<katalis positif 1>", "<katalis positif 2>"],
  "catalysts_negative": ["<risiko/katalis negatif 1>", "<risiko/katalis negatif 2>"],
  "recommendation": "<satu kalimat rekomendasi dari perspektif sentimen>"
}"""


class SentimentAgent(BaseAgent):
    name = "SentimentAgent"
    description = "Analisa sentimen pasar, berita, katalis, dan kondisi industri"

    def run(self, ticker: str, context: dict) -> AgentResult:
        mode = context.get("mode", "listed")
        is_ipo = mode == "ipo"

        self.send_message(AgentMessage(
            sender="OrchestratorAgent",
            receiver=self.name,
            content={"ticker": ticker, "task": "sentiment_analysis", "mode": mode},
            msg_type="task"
        ))

        user_msg = f"""Analisa sentimen pasar untuk saham: {ticker}
Tipe: {'IPO / Pre-IPO' if is_ipo else 'Saham Listed / Global'}

Berikan analisa sentimen berdasarkan:
1. Kondisi bisnis dan berita yang kamu ketahui tentang perusahaan/sektor ini
2. Katalis positif dan negatif yang relevan
3. Konteks makro ekonomi Indonesia saat ini
4. Prospek industri ke depan"""

        try:
            raw = self._call_llm(SYSTEM_PROMPT, user_msg)
            data = self._extract_json(raw)

            result = AgentResult(
                agent_name=self.name,
                signal=data.get("signal", "NEUTRAL"),
                score=int(data.get("score", 50)),
                summary=data.get("summary", ""),
                details={
                    "news_sentiment": data.get("details", {}).get("news_sentiment", "-"),
                    "institutional": data.get("details", {}).get("institutional", "-"),
                    "insider_activity": data.get("details", {}).get("insider_activity", "-"),
                    "industry_outlook": data.get("details", {}).get("industry_outlook", "-"),
                    "regulatory": data.get("details", {}).get("regulatory", "-"),
                    "macro_impact": data.get("details", {}).get("macro_impact", "-"),
                    "catalysts_positive": data.get("catalysts_positive", []),
                    "catalysts_negative": data.get("catalysts_negative", []),
                    "recommendation": data.get("recommendation", "-"),
                },
                raw_response=raw,
            )

        except Exception as e:
            result = AgentResult(
                agent_name=self.name,
                signal="NEUTRAL",
                score=50,
                summary=f"Analisa sentimen tidak tersedia: {str(e)}",
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
