from orchestrator import OrchestratorAgent
from report import print_report, save_json_report

ticker = input("Masukkan ticker saham (contoh: BBCA, TLKM): ").strip()
mode = input("Mode (listed/unlisted) [default: listed]: ").strip() or "listed"

agent = OrchestratorAgent(
    on_log=lambda msg, level="info": print(f"[{level.upper()}] {msg}")
)

print(f"\nMenganalisa {ticker}...\n")
session = agent.analyze(ticker, mode)

if session.final_result:
    print_report(session)
    filepath = save_json_report(session)
    print(f"\nLaporan JSON disimpan: {filepath}")
else:
    print("Analisa gagal.")