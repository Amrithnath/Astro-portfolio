GOBIN ?= $(shell go env GOPATH)/bin

.PHONY: proto generate lint test build run migrate-up migrate-status

proto generate:
	PATH="$(GOBIN):$(PATH)" buf generate

lint:
	golangci-lint run ./...

test:
	go test ./...

build:
	go build ./cmd/wedding-api

run:
	go run ./cmd/wedding-api

migrate-up:
	go run ./cmd/migrate up

migrate-status:
	go run ./cmd/migrate status
