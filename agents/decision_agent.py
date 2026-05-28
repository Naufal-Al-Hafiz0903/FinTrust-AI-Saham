"""
Decision Synthesis Agent
Menggabungkan hasil semua agent → verdict final dengan reasoning transparan
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
from core.base_agent import BaseAgent, AgentResult, AgentMessage
from core.config import AGENT_WEIGHTS, VERDICT_THRESHOLDS


SYSTEM_PROMPT = """Kamu adalah Decision Synthesis Agent — pemimpin dan decision-maker dalam sistem multi-agent analisa saham Indonesia dan luar negeri.

TUGAS:
Terima hasil analisa dari 4 agent (Fundamental, Technical, Sentiment, Risk), lakukan reasoning mendalam, dan buat keputusan investasi final.

PROSES REASONING:
1. Review sinyal dari tiap agent: apakah konsisten atau konflik?
2. Pertimbangkan konteks: saham IPO vs listed punya kriteria berbeda
3. Identifikasi faktor penentu (tipping point): apa yang paling menentukan verdict?
4. Tentukan verdict: BELI / TUNGGU / JUAL
5. Hitung target harga dan stop loss berdasarkan level teknikal dan fundamental

PANDUAN VERDICT:
- BELI: Composite score ≥ 62, mayoritas sinyal positif, risiko terkelola
- TUNGGU: Composite score 42-61, sinyal mixed, atau butuh konfirmasi lebih
- JUAL: Composite score ≤ 41, fundamental/teknikal memburuk, atau risiko tinggi

PANDUAN TARGET & STOP LOSS:
- Target: gunakan resistance terdekat + proyeksi upside fundamental
- Stop Loss: gunakan support kuat terdekat atau -7% sampai -12% dari harga saat ini

OUTPUT: Jawab HANYA dengan JSON valid berikut:
{
  "company_name": "<nama lengkap perusahaan>",
  "sector": "<sektor industri>",
  "ticker": "<kode saham>",
  "stock_type": "listed|ipo",
  "current_price": "<Rp X.XXX>",
  "verdict": "BELI|TUNGGU|JUAL",
  "confidence": <integer 0-100>,
  "composite_score": <integer 0-100>,
  "target_price": "<Rp X.XXX>",
  "stop_loss": "<Rp X.XXX>",
  "upside_potential": "<+X%>",
  "downside_risk": "<-X%>",
  "time_horizon": "<jangka waktu investasi yang disarankan, misal: 3-6 bulan>",
  "reasoning": {
    "dominant_factor": "<faktor paling menentukan verdict>",
    "signal_consensus": "<apakah sinyal agent konsisten atau konflik?>",
    "key_consideration": "<hal paling penting yang harus diperhatikan investor>"
  },
  "final_summary": "<3-4 kalimat kesimpulan komprehensif yang menjelaskan alasan verdict, katalis, dan risiko utama>",
  "action_plan": {
    "if_buy": "<saran jika memutuskan beli: entry point, posisi sizing>",
    "watch_for": "<hal yang harus dipantau setelah beli/tunggu>"
  }
}"""


class DecisionAgent(BaseAgent):
    name = "DecisionAgent"
    description = "Sintesis semua analisa agent menjadi keputusan investasi final dengan reasoning transparan"

    def _compute_composite(self, agent_results: dict) -> float:
        """Hitung composite score berbobot dari semua agent"""
        total = 0.0
        total_weight = 0.0
        for agent_key, weight in AGENT_WEIGHTS.items():
            result = agent_results.get(agent_key)
            if result and result.success:
                total += result.score * weight
                total_weight += weight
        if total_weight == 0:
            return 50.0
        return total / total_weight

    def run(self, ticker: str, context: dict) -> AgentResult:
        mode = context.get("mode", "listed")
        agent_results: dict[str, AgentResult] = context.get("agent_results", {})

        # Hitung composite score dulu
        composite = self._compute_composite(agent_results)

        # Tentukan expected verdict berdasarkan composite
        expected_verdict = "TUNGGU"
        for verdict, (low, high) in VERDICT_THRESHOLDS.items():
            if low <= composite <= high:
                expected_verdict = verdict
                break

        # Siapkan ringkasan untuk LLM
        summaries = {}
        for k, r in agent_results.items():
            summaries[k] = {
                "signal": r.signal,
                "score": r.score,
                "summary": r.summary,
                "success": r.success,
            }

        self.send_message(AgentMessage(
            sender="OrchestratorAgent",
            receiver=self.name,
            content={
                "ticker": ticker,
                "composite_score": round(composite, 1),
                "expected_verdict": expected_verdict,
                "agent_summaries": summaries,
            },
            msg_type="task"
        ))

        user_msg = f"""Saham: {ticker} | Tipe: {'IPO/Pre-IPO' if mode == 'ipo' else 'Listed / Global'}
Composite Score (weighted): {composite:.1f}/100
Expected Verdict berdasarkan score: {expected_verdict}

=== HASIL AGENT ===
{json.dumps(summaries, indent=2, ensure_ascii=False)}

=== BOBOT AGENT ===
Fundamental: {AGENT_WEIGHTS['fundamental']*100:.0f}%
Technical:   {AGENT_WEIGHTS['technical']*100:.0f}%
Sentiment:   {AGENT_WEIGHTS['sentiment']*100:.0f}%
Risk:        {AGENT_WEIGHTS['risk']*100:.0f}%

Lakukan reasoning dan buat keputusan investasi final.
Perhatikan: jika sinyal bertentangan, jelaskan mana yang lebih dominan dan mengapa.
Berikan target harga dan stop loss yang realistis."""

        try:
            raw = self._call_llm(SYSTEM_PROMPT, user_msg)
            data = self._extract_json(raw)

            result = AgentResult(
                agent_name=self.name,
                signal=data.get("verdict", expected_verdict),
                score=int(data.get("confidence", int(composite))),
                summary=data.get("final_summary", ""),
                details={
                    "company_name":     data.get("company_name", ticker),
                    "sector":           data.get("sector", "-"),
                    "stock_type":       data.get("stock_type", mode),
                    "current_price":    data.get("current_price", "N/A"),
                    "verdict":          data.get("verdict", expected_verdict),
                    "confidence":       data.get("confidence", int(composite)),
                    "composite_score":  round(composite, 1),
                    "target_price":     data.get("target_price", "N/A"),
                    "stop_loss":        data.get("stop_loss", "N/A"),
                    "upside_potential": data.get("upside_potential", "N/A"),
                    "downside_risk":    data.get("downside_risk", "N/A"),
                    "time_horizon":     data.get("time_horizon", "N/A"),
                    "reasoning":        data.get("reasoning", {}),
                    "final_summary":    data.get("final_summary", ""),
                    "action_plan":      data.get("action_plan", {}),
                },
                raw_response=raw,
            )

        except Exception as e:
            result = AgentResult(
                agent_name=self.name,
                signal=expected_verdict,
                score=int(composite),
                summary=f"Sintesis keputusan menggunakan composite score: {composite:.1f}. ({str(e)})",
                details={
                    "verdict": expected_verdict,
                    "composite_score": round(composite, 1),
                    "confidence": int(composite),
                    "company_name": ticker,
                },
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
