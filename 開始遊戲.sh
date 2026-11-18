#!/usr/bin/env bash
cd "$(dirname "$0")"
PORT="${1:-8000}"
echo "請用瀏覽器打開：http://127.0.0.1:${PORT}/"
echo "（唔好直接雙擊 index.html，本地 file:// 可能載唔到圖片同音樂。）"
exec python3 -m http.server "$PORT"
