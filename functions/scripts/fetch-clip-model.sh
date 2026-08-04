#!/usr/bin/env bash
# Fetch the CLIP model files bundled with analyzeMoodboard so the function
# loads them locally (env.localModelPath) instead of downloading from
# HuggingFace at runtime — which was getting rate-limited (429) on Cloud
# Functions' shared egress IP and crashing the call with an opaque INTERNAL.
#
# Run this once before deploying (files are gitignored — too large for git):
#   bash functions/scripts/fetch-clip-model.sh
#   firebase deploy --only functions:analyzeMoodboard
#
# dtype 'q8' in clipHelpers.js maps to the *_quantized.onnx variants.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR="models/Xenova/clip-vit-base-patch32"
BASE="https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main"
FILES=(
  config.json preprocessor_config.json tokenizer.json tokenizer_config.json
  vocab.json merges.txt special_tokens_map.json
  onnx/vision_model_quantized.onnx onnx/text_model_quantized.onnx
)
mkdir -p "$DIR/onnx"
for f in "${FILES[@]}"; do
  if [ -s "$DIR/$f" ]; then
    echo "skip (exists)  $f"
  else
    echo "fetch          $f"
    curl -L -sS --fail --create-dirs -o "$DIR/$f" "$BASE/$f"
  fi
done
echo "Done. Model at functions/$DIR ($(du -sh "$DIR" | cut -f1))"
