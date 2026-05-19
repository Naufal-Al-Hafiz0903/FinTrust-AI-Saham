"""
StockMind AI — Multi-Agent Stock Analysis System
Konfigurasi global dan konstanta
"""

OLLAMA_HOST = "http://172.16.0.24:11434"
OLLAMA_MODEL = "qwen2.5:7b"

OLLAMA_OPTIONS = {
    "temperature": 0.2,
    "num_predict": 1024,
    "top_p": 0.9,
}

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
