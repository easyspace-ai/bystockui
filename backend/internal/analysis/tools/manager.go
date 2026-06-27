package tools

import (
	"sync"

	"github.com/cloudwego/eino/components/tool"
)

var (
	globalTools     []tool.BaseTool
	globalToolsOnce sync.Once
)

// InitGlobalTools 初始化全局工具集
func InitGlobalTools(dataDir string) error {
	var err error
	globalToolsOnce.Do(func() {
		stockTools, initErr := NewStockTools(dataDir)
		if initErr != nil {
			err = initErr
			return
		}
		allTools := stockTools.GetAllTools()
		
		// 添加东财工具
		eastmoneyTools := NewEastMoneyTools()
		allTools = append(allTools, eastmoneyTools.GetAllTools()...)
		
		// 添加同花顺工具
		thstools := NewTHSTools()
		allTools = append(allTools, thstools.GetAllTools()...)
		
		globalTools = allTools
	})
	return err
}

// GetGlobalTools 获取全局工具集
func GetGlobalTools() []tool.BaseTool {
	return globalTools
}
