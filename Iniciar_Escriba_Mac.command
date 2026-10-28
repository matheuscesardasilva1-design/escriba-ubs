#!/bin/bash
cd "$(dirname "$0")"
PORT=8765

echo "============================================================================"
echo "  ESCRIBA MÉDICO UBS - SOAP & REGULAÇÃO ESTADUAL (Mac)"
echo "  Iniciando servidor local em http://localhost:$PORT/index.html"
echo "============================================================================"
echo ""
echo "Não feche esta janela enquanto estiver usando o programa."

# Abre o navegador após 1 segundo
(sleep 1 && open "http://localhost:$PORT/index.html") &

# Usa python3 nativo do macOS para servir em localhost
python3 -m http.server $PORT --bind 127.0.0.1
