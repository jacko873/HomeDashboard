VERSION ?= $(shell git describe --tags --always 2>/dev/null || echo dev)

.PHONY: run build test vet

run: ## run the server (ADDR=:8080 by default)
	go run ./cmd/server

build: ## build bin/server with the version stamped in
	go build -ldflags "-X main.version=$(VERSION)" -o bin/server ./cmd/server

test:
	go test ./...

vet:
	go vet ./...
