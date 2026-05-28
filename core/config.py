"""
StockMind AI — Multi-Agent Stock Analysis System
Konfigurasi global dan konstanta
"""
import os
from dotenv import load_dotenv

# Load variabel dari file .env
load_dotenv()

# Konfigurasi LLM menggunakan Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Bobot tiap agent dalam keputusan final (total = 1.0)
AGENT_WEIGHTS = {
    "fundamental": 0.35,
    "technical":   0.25,
    "sentiment":   0.20,
    "risk":        0.20,
}

# Mapping skor ke sinyal
SIGNAL_THRESHOLDS = {
    "BULLISH": (65, 100),
    "NEUTRAL": (40, 64),
    "BEARISH": (0,  39),
}

# Mapping verdict berdasarkan composite score
VERDICT_THRESHOLDS = {
    "BELI":   (62, 100),
    "TUNGGU": (42, 61),
    "JUAL":   (0,  41),
}