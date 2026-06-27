package hotmoney

import (
	"aistock/backend/internal/workbench/domain/stock"
	"aistock/backend/internal/workbench/ports"
)

// RepoSearcher adapts StockRepository to StockSearcher.
type RepoSearcher struct {
	repo ports.StockRepository
}

func NewRepoSearcher(repo ports.StockRepository) *RepoSearcher {
	if repo == nil {
		return nil
	}
	return &RepoSearcher{repo: repo}
}

func (r *RepoSearcher) Search(keyword string) ([]StockMatch, error) {
	infos, err := r.repo.Search(keyword)
	if err != nil {
		return nil, err
	}
	out := make([]StockMatch, 0, len(infos))
	for _, info := range infos {
		out = append(out, stockInfoToMatch(info))
	}
	return out, nil
}

func stockInfoToMatch(info stock.StockInfo) StockMatch {
	return StockMatch{
		Code:   info.Code,
		Name:   info.Name,
		Market: info.Market,
	}
}
