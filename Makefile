NPM ?= npm
DOCKER_COMPOSE ?= docker compose
REMOVE ?= rm -rf

.PHONY: build start start\:dev test test\:cov lint format docker-up docker-down docker-build clean

build:
	$(NPM) run build

start:
	$(NPM) run start

start\:dev:
	$(NPM) run start:dev

test:
	$(NPM) run test

test\:cov:
	$(NPM) run test:cov

lint:
	$(NPM) run lint

format:
	$(NPM) run format

docker-up:
	$(DOCKER_COMPOSE) up -d

docker-down:
	$(DOCKER_COMPOSE) down

docker-build:
	$(DOCKER_COMPOSE) build

clean:
	$(REMOVE) dist coverage
