.PHONY: dev test

test:
	bash run_all_tests.sh

dev:
	brew services start redis 2>/dev/null || true
	python3.11 -m phoenix.server.main serve &
	python3.11 -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
