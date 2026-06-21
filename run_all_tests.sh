#!/usr/bin/env bash
set -e

echo "--- consistency check ---"
python3.11 -m backend.scripts.test_consistency

echo "--- gap-fill loop ---"
python3.11 -m backend.scripts.test_gap_fill

echo "--- armoriq block ---"
python3.11 -m backend.scripts.test_armoriq

echo "--- front fallback ---"
python3.11 -m backend.scripts.test_fallback

echo ""
echo "All tests passed."
