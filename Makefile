# Convenience targets for local development.
#
#   make dev   run the Go API + new dashboard frontend together (Ctrl-C stops both)
#   make api   run only the Go API (demo data)
#   make web   run only the frontend dev server
#
# Override ports/provider via env, e.g.:  API_PORT=18080 make dev

.PHONY: dev serve api web

# Robust single-port mode: build the frontend and let the Go API serve it
# alongside /api on ONE port (default 8000). No Vite, no HMR websocket — this
# loads reliably through a remote/coder localhost forward where the dev server
# does not. Forward only this one port.
serve:
	cd Home-Automation-TV-Dashboard && npm install && npm run build
	cd tv-dashboard-api && WEB_STATIC_DIR="$(CURDIR)/Home-Automation-TV-Dashboard/dist" ADDR=":$(or $(API_PORT),8000)" MUSIC_PROVIDER="$(or $(MUSIC_PROVIDER),demo)" go run ./cmd/server

dev:
	./dev.sh

api:
	cd tv-dashboard-api && ADDR=":$(or $(API_PORT),8000)" MUSIC_PROVIDER="$(or $(MUSIC_PROVIDER),demo)" go run ./cmd/server

web:
	cd Home-Automation-TV-Dashboard && npm run dev
