package appenv

import (
	"os"
	"path/filepath"
	"strings"
)

// DataRootDir 统一数据根目录（环境变量 AI_DATA_DIR）。
// stock.db、行情缓存、分析工具产出等均放在该目录下（子项目可自行建子目录）。
// 未设置时返回空字符串；cmd/server 等对主库有强依赖处应 Fatal。
func DataRootDir() string {
	v := strings.TrimSpace(os.Getenv("AI_DATA_DIR"))
	if v == "" {
		return ""
	}
	return filepath.Clean(v)
}

// StockDatabaseDir 与 DataRootDir 相同；stock.db 位于该目录下。
func StockDatabaseDir() string {
	return DataRootDir()
}

// AnalysisDataDir AI 分析工具（Parquet / DuckDB 等）使用的目录，默认等于 DataRootDir。
func AnalysisDataDir(fallback string) string {
	if v := DataRootDir(); v != "" {
		return v
	}
	if strings.TrimSpace(fallback) == "" {
		fallback = "./data"
	}
	return fallback
}

// WorkspaceRoot 文档与索引等工作区根路径（OBSIDIAN_FS_ROOT，默认 /data/workspace）。
// 与统一数据根 AI_DATA_DIR 无关。
func WorkspaceRoot() string {
	if r := strings.TrimSpace(os.Getenv("OBSIDIAN_FS_ROOT")); r != "" {
		return filepath.Clean(r)
	}
	return filepath.Clean("/data/workspace")
}
