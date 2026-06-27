# aistock 提交前构建：前端打包 → 同步到 backend/internal/webui/webdist（随 Git 提交）
#
# 用法:
#   make release          # 仅前端 build + sync（提交前执行）
#   make run              # 本地开发跑后端
#   pm2 start ecosystem.config.cjs   # 服务器上跑后端（需先 go build，见 help）

ROOT     := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
FRONTEND := $(ROOT)/frontend
BACKEND  := $(ROOT)/backend
WEBDIST  := $(BACKEND)/internal/webui/webdist
BINARY   := $(BACKEND)/bin/aistock-server
GO_LDFLAGS ?= -s -w

.PHONY: help frontend-install frontend-build frontend-sync release backend-build run clean distclean pm2-start pm2-restart pm2-stop

help:
	@echo "aistock 构建:"
	@echo "  make release        前端 pnpm build + 同步到 $(WEBDIST)（提交前执行，静态文件进 Git）"
	@echo "  make backend-build  可选：编译后端到 backend/bin/aistock-server（服务器 PM2 用）"
	@echo "  make run            本地 go run ./cmd/server"
	@echo ""
	@echo "提交前:"
	@echo "  make release"
	@echo "  git add backend/internal/webui/webdist && git commit"
	@echo ""
	@echo "服务器:"
	@echo "  git pull && cd backend && go mod download"
	@echo "  cp .env.example .env   # 配置 AI_DATA_DIR 等"
	@echo "  go build -o bin/aistock-server ./cmd/server   # 或 make backend-build"
	@echo "  cd .. && pm2 start ecosystem.config.cjs"

frontend-install:
	cd "$(FRONTEND)" && pnpm install --frozen-lockfile

frontend-build:
	cd "$(FRONTEND)" && pnpm run build

frontend-sync:
	bash "$(ROOT)/scripts/sync-frontend-dist.sh"

# 提交前默认流程：只打包前端，不打 Go 二进制
release: frontend-install frontend-build frontend-sync
	@echo "OK — webdist 已更新: $(WEBDIST)"
	@echo "下一步: git add backend/internal/webui/webdist && git commit"

# 服务器可选：在 backend 目录生成可执行文件供 PM2 使用
backend-build:
	@mkdir -p "$(BACKEND)/bin"
	cd "$(BACKEND)" && go build -ldflags="$(GO_LDFLAGS)" -o bin/aistock-server ./cmd/server
	@echo "binary: $(BINARY)"

run:
	cd "$(BACKEND)" && go run ./cmd/server

clean:
	rm -rf "$(FRONTEND)/dist"

distclean: clean
	rm -f "$(BINARY)"
	rm -f "$(ROOT)/release.tar.gz"

pm2-start:
	pm2 start "$(ROOT)/ecosystem.config.cjs"

pm2-restart:
	pm2 restart aistock

pm2-stop:
	pm2 stop aistock
