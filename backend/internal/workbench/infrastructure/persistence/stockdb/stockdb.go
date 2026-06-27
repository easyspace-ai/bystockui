package stockdb

import (
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"aistock/backend/internal/workbench/domain/stock"
)

func InitStockDatabase(dir string) (*gorm.DB, error) {
	dbPath := filepath.Join(dir, "stock.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// 自动迁移所有表
	if err := db.AutoMigrate(
		&stock.StockInfo{},
		&stock.DailyKLineCache{},
		&stock.FollowedStock{},
		&stock.StockAlarm{},
		&stock.AllStockInfo{},
		&stock.StockGroup{},
		&stock.StockGroupItem{},
	); err != nil {
		return nil, err
	}

	return db, nil
}
