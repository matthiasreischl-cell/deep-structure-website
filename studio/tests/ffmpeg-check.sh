#!/bin/sh
# Unabhängige Messung mit FFmpeg ebur128 (BS.1770, True Peak 4-fach überabgetastet)
for f in "$@"; do
  ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true:framelog=quiet -f null - 2>&1 \
    | awk -v f="$f" '/I:/{I=$2} /LRA:/{L=$2} /Peak:/{P=$2} END{printf "%s\n  Integrierte Lautheit: %s LUFS\n  Loudness Range:       %s LU\n  True Peak:            %s dBTP\n", f, I, L, P}'
done
