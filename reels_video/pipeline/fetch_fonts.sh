#!/bin/bash
# Скачивает шрифты (Google Fonts, OFL) в src/ — они не хранятся в репозитории.
set -e
DIR="$(cd "$(dirname "$0")/../src" && pwd)"
curl -sL -o "$DIR/Montserrat.ttf"    "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf"
curl -sL -o "$DIR/Inter.ttf"         "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf"
curl -sL -o "$DIR/JetBrainsMono.ttf" "https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
ls -la "$DIR"/*.ttf
