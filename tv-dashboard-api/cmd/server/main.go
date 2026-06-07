// Command server runs the TV dashboard API.
//
// One binary hosts every dashboard API module (music, system, …) under
// /api/<domain>/…. Configuration is environment variables only — see
// internal/config and the README.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"tv-dashboard-api/internal/config"
	"tv-dashboard-api/internal/server"
)

// version is stamped at build time:
//
//	go build -ldflags "-X main.version=$(git describe --tags --always)" ./cmd/server
var version = "dev"

func main() {
	// Optional .env in the working directory; real env vars take precedence.
	config.LoadDotEnv(".env")
	cfg := config.FromEnv()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           server.New(cfg, log, version),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	go func() {
		log.Info("listening", "addr", cfg.Addr, "version", version)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown on Ctrl-C / SIGTERM so in-flight requests finish.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("shutdown failed", "error", err)
	}
}
