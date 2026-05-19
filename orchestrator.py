"""
Orchestrator Agent
Otak sistem — mengkoordinasi semua agent, menjalankan paralel, mengumpulkan hasil
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import time
import threading
from dataclasses import dataclass, field
from typing import Callable

from core.base_agent import AgentMessage, AgentResult
from core.config import OLLAMA_HOST, OLLAMA_MODEL
from agents.fundamental_agent import FundamentalAgent
from agents.technical_agent import TechnicalAgent
from agents.sentiment_agent import SentimentAgent
from agents.risk_agent import RiskAgent
from agents.decision_agent import DecisionAgent


@dataclass
class AnalysisSession:
    """Satu sesi analisa lengkap"""
    ticker: str
    mode: str
    start_time: float = field(default_factory=time.time)
    end_time: float = 0.0
    agent_results: dict = field(default_factory=dict)
    final_result: AgentResult = None
    message_log: list = field(default_factory=list)
    status: str = "pending"  # pending | running | done | error

    @property
    def duration(self) -> float:
        if self.end_time:
            return self.end_time - self.start_time
        return time.time() - self.start_time


class OrchestratorAgent:
    """
    Koordinator utama sistem multi-agent.
    
    Alur kerja:
    1. Terima input dari user (ticker + mode)
    2. Distribusikan ke 4 agent secara PARALEL
    3. Tunggu semua agent selesai
    4. Kirim hasil ke Decision Agent untuk sintesis
    5. Return laporan final
    """

    name = "OrchestratorAgent"

    def __init__(
        self,
        host: str = OLLAMA_HOST,
        model: str = OLLAMA_MODEL,
        on_agent_start: Callable = None,
        on_agent_done: Callable = None,
        on_log: Callable = None,
    ):
        self.host = host
        self.model = model
        self.on_agent_start = on_agent_start or (lambda name: None)
        self.on_agent_done = on_agent_done or (lambda name, result: None)
        self.on_log = on_log or (lambda msg, level="info": None)

        # Inisialisasi semua agent
        self.agents = {
            "fundamental": FundamentalAgent(host, model),
            "technical":   TechnicalAgent(host, model),
            "sentiment":   SentimentAgent(host, model),
            "risk":        RiskAgent(host, model),
        }
        self.decision_agent = DecisionAgent(host, model)

    def _log(self, msg: str, level: str = "info"):
        self.on_log(msg, level)

    def _run_agent_threaded(
        self,
        agent_key: str,
        ticker: str,
        context: dict,
        results_dict: dict,
        errors_dict: dict,
    ):
        """Jalankan satu agent dalam thread terpisah"""
        agent = self.agents[agent_key]
        self._log(f"[{agent.name}] mulai analisa {ticker}...", "info")
        self.on_agent_start(agent.name)

        try:
            result = agent.run(ticker, context)
            results_dict[agent_key] = result
            self._log(
                f"[{agent.name}] selesai — signal: {result.signal}, score: {result.score}",
                "success" if result.success else "warning"
            )
        except Exception as e:
            error_result = AgentResult(
                agent_name=agent.name,
                signal="NEUTRAL",
                score=50,
                summary=f"Error: {str(e)}",
                details={},
                success=False,
                error_msg=str(e),
            )
            results_dict[agent_key] = error_result
            errors_dict[agent_key] = str(e)
            self._log(f"[{agent.name}] ERROR: {e}", "error")

        self.on_agent_done(agent.name, results_dict[agent_key])

    def analyze(self, ticker: str, mode: str = "listed") -> AnalysisSession:
        """
        Jalankan analisa lengkap untuk satu saham.
        Return: AnalysisSession dengan semua hasil.
        """
        session = AnalysisSession(ticker=ticker, mode=mode)
        session.status = "running"

        ticker = ticker.upper().strip()
        context = {"mode": mode, "ticker": ticker}

        self._log(f"=== ORCHESTRATOR: Mulai analisa {ticker} (mode: {mode}) ===", "info")
        self._log(f"Mengirim task ke 4 agent secara paralel...", "info")

        # Kirim task ke semua agent via message log
        for agent_key, agent in self.agents.items():
            agent.send_message(AgentMessage(
                sender=self.name,
                receiver=agent.name,
                content={"ticker": ticker, "mode": mode},
                msg_type="task"
            ))

        # Jalankan semua agent PARALEL dengan threading
        threads = []
        agent_results = {}
        errors = {}

        for agent_key in self.agents:
            t = threading.Thread(
                target=self._run_agent_threaded,
                args=(agent_key, ticker, context, agent_results, errors),
                daemon=True
            )
            threads.append(t)
            t.start()

        # Tunggu semua selesai
        for t in threads:
            t.join(timeout=180)  # max 3 menit per agent

        session.agent_results = agent_results
        self._log(f"Semua agent selesai. Mengirim ke Decision Agent...", "info")

        # Decision synthesis
        decision_context = {
            "mode": mode,
            "agent_results": agent_results,
        }
        self.on_agent_start(self.decision_agent.name)

        try:
            final = self.decision_agent.run(ticker, decision_context)
            session.final_result = final
            self._log(
                f"[DecisionAgent] Verdict: {final.details.get('verdict','?')} "
                f"| Confidence: {final.details.get('confidence','?')}%",
                "success"
            )
        except Exception as e:
            self._log(f"[DecisionAgent] ERROR: {e}", "error")
            session.status = "error"

        self.on_agent_done(self.decision_agent.name, session.final_result)

        # Kumpulkan semua message log
        for agent in self.agents.values():
            session.message_log.extend(agent.get_message_log())
        session.message_log.extend(self.decision_agent.get_message_log())

        session.end_time = time.time()
        session.status = "done"

        self._log(f"=== Analisa selesai dalam {session.duration:.1f}s ===", "success")
        return session
