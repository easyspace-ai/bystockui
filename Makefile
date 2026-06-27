# aistock 发布构建：前端编译 → 同步到 backend embed → 编译单二进制
#
# 用法:
#   make release          # 构建 release/aistock-server（内含前端静态资源）
#   make package          # 生成 release.tar.gz 便于上传到服务器
#   pm2 start ecosystem.config.cjs
#
# 服务器: 将 release/ 目录上传后，复制 .env.example 为 .env 并填写，再 pm2 start

ROOT        := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
FRONTEND    := $(ROOT)/frontend
BACKEND     := $(ROOT)/backend
RELEASE     := $(ROOT)/release
BINARY      := aistock-server
GO_LDFLAGS  ?= -s -w

.PHONY: help frontend-install frontend-build frontend-sync backend-build release package clean distclean pm2-start pm2-restart pm2-stop

help:
	@echo "aistock release targets:"
	@echo "  make release       编译前端 + 同步 webdist + 编译 Go 二进制到 release/"
	@echo "  make package       在 release/ 就绪后打包 release.tar.gz"
	@echo "  make clean         清理 frontend/dist、release 二进制"
	@echo "  make distclean     clean + 清空 webdist 嵌入目录"
	@echo "  make pm2-start     pm2 start ecosystem.config.cjs"
	@echo "  make pm2-restart   pm2 restart aistock"
	@echo "  make pm2-stop      pm2 stop aistock"
	@echo ""
	@echo "服务器部署:"
	@echo "  1. make release && make package"
	@echo "  2. 上传 release.tar.gz，解压到例如 /opt/aistock/release"
	@echo "  3. cp .env.example .env && 编辑 AI_DATA_DIR、密钥等"
	@echo "  4. cd /opt/aistock && pm2 start ecosystem.config.cjs"

frontend-install:
	cd "$(FRONTEND)" && pnpm install --frozen-lockfile

frontend-build:
	cd "$(FRONTEND)" && pnpm run build

frontend-sync:
	bash "$(ROOT)/scripts/sync-frontend-dist.sh"

backend-build:
	@mkdir -p "$(RELEASE)/logs"
	cd "$(BACKEND)" && go build -ldflags="$(GO_LDFLAGS)" -o "$(RELEASE)/$(BINARY)" ./cmd/server
	@if [ ! -f "$(RELEASE)/.env.example" ]; then cp "$(BACKEND)/.env.example" "$(RELEASE)/.env.example"; fi
	@echo "binary: $(RELEASE)/$(BINARY)"

# 一键发布（必须先 sync 再 go build，前端通过 go:embed 打进二进制）
release: frontend-install frontend-build frontend-sync backend-build
	@echo "OK — run on server: cd $(RELEASE) && cp -n .env.example .env && pm2 start $(ROOT)/ecosystem.config.cjs"

package: release
	tar -czf "$(ROOT)/release.tar.gz" -C "$(RELEASE)" .
	@echo "created $(ROOT)/release.tar.gz"

clean:
	rm -rf "$(FRONTEND)/dist"
	rm -f "$(RELEASE)/$(BINARY)"

distclean: clean
	rm -rf "$(BACKEND)/internal/webui/webdist"
	rm -f "$(ROOT)/release.tar.gz"

pm2-start:
	pm2 start "$(ROOT)/ecosystem.config.cjs"

pm2-restart:
	pm2 restart aistock

pm2-stop:
	pm2 stop aistock
