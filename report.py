"""
Report Generator
Menghasilkan laporan terstruktur dari hasil analisa multi-agent
Format: terminal (rich), JSON, dan ringkasan teks
"""

import json
import os
from datetime import datetime
from core.orchestrator import AnalysisSession


def _signal_color(signal: str) -> str:
    """Return ANSI color code berdasarkan sinyal"""
    s = signal.upper()
    if s in ("BULLISH", "LOW", "BELI"):
        return "\033[92m"   # hijau
    elif s in ("BEARISH", "HIGH", "JUAL"):
        return "\033[91m"   # merah
    elif s in ("CAUTION", "MEDIUM", "TUNGGU"):
        return "\033[93m"   # kuning
    return "\033[97m"       # putih


RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[96m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
RED = "\033[91m"
MAGENTA = "\033[95m"


def _bar(score: int, width: int = 20) -> str:
    """Buat progress bar ASCII"""
    filled = int((score / 100) * width)
    bar = "█" * filled + "░" * (width - filled)
    return bar


def print_report(session: AnalysisSession):
    """Print laporan lengkap ke terminal dengan formatting"""

    final = session.final_result
    if not final:
        print(f"{RED}Error: tidak ada hasil analisa.{RESET}")
        return

    d = final.details
    verdict = d.get("verdict", "TUNGGU")
    verdict_color = _signal_color(verdict)

    W = 70  # lebar terminal

    print()
    print(f"{CYAN}{'═' * W}{RESET}")
    print(f"{BOLD}{CYAN}  STOCKMIND AI — LAPORAN ANALISA MULTI-AGENT{RESET}")
    print(f"{DIM}  Powered by Ollama · {session.mode.upper()} · {datetime.now().strftime('%d %b %Y %H:%M')}{RESET}")
    print(f"{CYAN}{'═' * W}{RESET}")
    print()

    # ── Header ──────────────────────────────────────────────────────────
    company = d.get("company_name", session.ticker)
    sector  = d.get("sector", "-")
    print(f"  {BOLD}{session.ticker}{RESET}  {company}")
    print(f"  {DIM}Sektor: {sector}  |  Tipe: {'🚀 IPO/Pre-IPO' if session.mode == 'ipo' else '📋 Listed / Global'}{RESET}")
    print()

    # ── Verdict ─────────────────────────────────────────────────────────
    confidence = d.get("confidence", 50)
    composite  = d.get("composite_score", 50)

    print(f"  ┌{'─'*18}┐")
    print(f"  │  {verdict_color}{BOLD}  {verdict:^12}  {RESET}  │   COMPOSITE SCORE  {BOLD}{composite:.0f}/100{RESET}")
    print(f"  └{'─'*18}┘   Confidence: {_bar(confidence, 16)} {confidence}%")
    print()

    # ── Harga ────────────────────────────────────────────────────────────
    curr  = d.get("current_price", "N/A")
    tgt   = d.get("target_price", "N/A")
    sl    = d.get("stop_loss", "N/A")
    up    = d.get("upside_potential", "")
    dn    = d.get("downside_risk", "")
    horiz = d.get("time_horizon", "")

    print(f"  {'─'*66}")
    print(f"  {'HARGA SAAT INI':<20} {'TARGET':<20} {'STOP LOSS':<20}")
    print(f"  {YELLOW}{curr:<20}{RESET} {GREEN}{tgt:<20}{RESET} {RED}{sl:<20}{RESET}")
    if up or dn:
        print(f"  {'':20} {GREEN}{up:<20}{RESET} {RED}{dn:<20}{RESET}")
    if horiz:
        print(f"  {DIM}Horizon investasi: {horiz}{RESET}")
    print()

    # ── Hasil per agent ─────────────────────────────────────────────────
    AGENT_INFO = {
        "fundamental": ("📊", "FUNDAMENTAL AGENT"),
        "technical":   ("📈", "TECHNICAL AGENT"),
        "sentiment":   ("📰", "SENTIMENT AGENT"),
        "risk":        ("⚠️ ", "RISK ASSESSMENT AGENT"),
    }

    print(f"  {'─'*66}")
    print(f"  {BOLD}HASIL ANALISA PER AGENT{RESET}")
    print()

    for key, (icon, label) in AGENT_INFO.items():
        result = session.agent_results.get(key)
        if not result:
            continue

        sig_color = _signal_color(result.signal)

        # Header agent
        print(f"  {icon} {BOLD}{label}{RESET}")
        print(f"     Signal: {sig_color}{result.signal}{RESET}  |  Score: {_bar(result.score, 14)} {result.score}/100")

        if not result.success:
            print(f"     {RED}[ERROR] {result.error_msg}{RESET}")
        else:
            # Summary
            summary = result.summary
            # Wrap panjang
            words = summary.split()
            line = "     "
            for word in words:
                if len(line) + len(word) > W - 2:
                    print(line)
                    line = "     " + word + " "
                else:
                    line += word + " "
            if line.strip():
                print(line)

            # Detail spesifik per agent
            if key == "fundamental":
                km = result.details.get("key_metrics", [])
                if km:
                    print(f"     {DIM}Key metrics: {' · '.join(km)}{RESET}")

            elif key == "technical":
                kl = result.details.get("key_levels", {})
                if kl:
                    s1 = kl.get("support1", "-")
                    r1 = kl.get("resistance1", "-")
                    print(f"     {DIM}Support: {GREEN}{s1}{RESET}{DIM}  |  Resistance: {RED}{r1}{RESET}")
                entry = result.details.get("entry_zone", "")
                if entry:
                    print(f"     {DIM}Entry zone: {entry}{RESET}")

            elif key == "sentiment":
                pos = result.details.get("catalysts_positive", [])
                neg = result.details.get("catalysts_negative", [])
                for c in pos[:2]:
                    print(f"     {GREEN}▲ {c}{RESET}")
                for c in neg[:2]:
                    print(f"     {RED}▼ {c}{RESET}")

            elif key == "risk":
                top = result.details.get("top_risks", [])
                for r in top[:3]:
                    sev = r.get("severity", "")
                    sev_c = _signal_color("HIGH" if sev == "HIGH" else "MEDIUM" if sev == "MEDIUM" else "LOW")
                    print(f"     {sev_c}[{sev}]{RESET} {r.get('risk','')} — {DIM}{r.get('description','')}{RESET}")

        print()

    # ── Decision Agent ───────────────────────────────────────────────────
    print(f"  {'─'*66}")
    print(f"  🧠 {BOLD}DECISION SYNTHESIS AGENT{RESET}")
    print()

    reasoning = d.get("reasoning", {})
    if reasoning:
        dom = reasoning.get("dominant_factor", "")
        cons = reasoning.get("signal_consensus", "")
        key_c = reasoning.get("key_consideration", "")
        if dom:
            print(f"  {DIM}Faktor dominan   : {RESET}{dom}")
        if cons:
            print(f"  {DIM}Konsensus sinyal  : {RESET}{cons}")
        if key_c:
            print(f"  {DIM}Pertimbangan utama: {RESET}{key_c}")
        print()

    summary_text = d.get("final_summary", final.summary)
    words = summary_text.split()
    line = "  "
    for word in words:
        if len(line) + len(word) > W - 2:
            print(line)
            line = "  " + word + " "
        else:
            line += word + " "
    if line.strip():
        print(line)
    print()

    # ── Action Plan ──────────────────────────────────────────────────────
    action = d.get("action_plan", {})
    if action:
        if_buy = action.get("if_buy", "")
        watch  = action.get("watch_for", "")
        if if_buy or watch:
            print(f"  {'─'*66}")
            print(f"  {BOLD}ACTION PLAN{RESET}")
            if if_buy:
                print(f"  {GREEN}➤ Jika beli:{RESET} {if_buy}")
            if watch:
                print(f"  {YELLOW}👁 Pantau  :{RESET} {watch}")
            print()

    # ── Footer ───────────────────────────────────────────────────────────
    print(f"  {'─'*66}")
    print(f"  {DIM}Waktu analisa : {session.duration:.1f}s  |  Model: {session.ticker}@{OLLAMA_MODEL}{RESET}")
    print(f"  {DIM}Agent messages: {len(session.message_log)} komunikasi{RESET}")
    print(f"  {'─'*66}")
    print(f"  {DIM}⚠ Hanya untuk edukasi. Bukan saran investasi. Do your own research.{RESET}")
    print(f"{CYAN}{'═' * W}{RESET}")
    print()


def save_json_report(session: AnalysisSession, output_dir: str = "reports") -> str:
    """Simpan laporan dalam format JSON terstruktur"""
    os.makedirs(output_dir, exist_ok=True)

    report = {
        "metadata": {
            "ticker": session.ticker,
            "mode": session.mode,
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": round(session.duration, 2),
            "model": OLLAMA_MODEL,
            "status": session.status,
        },
        "verdict": {
            "verdict": session.final_result.details.get("verdict", "N/A") if session.final_result else "N/A",
            "confidence": session.final_result.details.get("confidence", 0) if session.final_result else 0,
            "composite_score": session.final_result.details.get("composite_score", 0) if session.final_result else 0,
            "current_price": session.final_result.details.get("current_price", "N/A") if session.final_result else "N/A",
            "target_price": session.final_result.details.get("target_price", "N/A") if session.final_result else "N/A",
            "stop_loss": session.final_result.details.get("stop_loss", "N/A") if session.final_result else "N/A",
            "upside_potential": session.final_result.details.get("upside_potential", "N/A") if session.final_result else "N/A",
            "time_horizon": session.final_result.details.get("time_horizon", "N/A") if session.final_result else "N/A",
        },
        "agent_results": {
            k: v.to_dict() for k, v in session.agent_results.items()
        },
        "final_summary": session.final_result.details.get("final_summary", "") if session.final_result else "",
        "reasoning": session.final_result.details.get("reasoning", {}) if session.final_result else {},
        "action_plan": session.final_result.details.get("action_plan", {}) if session.final_result else {},
        "message_log": session.message_log,
    }

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(output_dir, f"{session.ticker}_{session.mode}_{ts}.json")

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    return filename


# Import untuk dipakai di report
try:
    from core.config import OLLAMA_MODEL
except ImportError:
    OLLAMA_MODEL = "qwen2.5:7b"
