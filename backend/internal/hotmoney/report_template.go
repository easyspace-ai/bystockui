package hotmoney

// ReportLayoutSpec returns the HTML structure spec injected into the LLM prompt.
// Class names match frontend reportShell.ts for post-processing wrap.
func ReportLayoutSpec() string {
	bt := "`"
	return `
## HTML 报告输出规范（必须严格遵守）

### 输出形式
- 在 ` + bt + `html` + bt + ` 代码块中输出报告片段（从 hero 到免责声明），**不要**输出 <!DOCTYPE> / <html> / <head>；预览端会自动套用 UZI 深色 Bloomberg 外壳。
- 若已输出完整 HTML 也可，但片段形式优先。

### 固定章节 ID（与侧栏导航一一对应，禁止改名）
| id | 侧栏标题 |
|----|----------|
| section-info | 标的信息 |
| section-review | 游资速评 |
| section-emotion | 情绪周期 |
| section-fund | 龙虎&资金 |
| section-fund-holders | 机构持仓 |
| section-tech | 技术走势 |
| section-experts | 大佬观点 |
| section-radar | 22维雷达 |
| section-action | 操作建议 |
| section-disclaimer | 免责声明 |

### 必须包含的 DOM 结构（class 名一字不改）

1. **Hero 区** — div.bento-hero 内含三块：
   - .bento.name-card：.ticker-label、.stock-name、.stock-code、.concept-tags（概念 tag 列表）、.price-row（.price + .change.up 或 .change.down）、.metric-chips（至少 现价/涨跌幅/连板高度/换手率 四枚 .chip）
   - .bento.score-card：.score-label、.score-giant（0-100 综合分）、.score-verdict（一句话 verdict）
   - .bento.signal-card：妖股/游资信号徽章（.signal-badge + .signal-desc）

2. **各章节** — 每章以 div.section-head（带 id="section-xxx"）开头，内含 .section-tag（01 / INFO 等）、.section-title、.section-line，后跟 .section-body 卡片内容。

3. **机构持仓**（section-fund-holders，有数据时必填）— 引用系统「机构持仓」维度：机构家数、占流通比、变动；用表格或 .metric-chips 呈现，勿虚构基金经理姓名/5年业绩/净值曲线。

4. **22维雷达** — .dim-row 网格，每维 .dim-card 含 .dim-title、.dim-score .num、.dim-bar > .fill（style="width:N%"）；有真实数据则填具体指标，无则标注缺失。

5. **大佬观点** — .expert-grid 内至少 3 个 .expert-card（打板/低吸/趋势各一），含 .expert-name、.expert-style、.expert-quote。

6. **操作建议** — .battle-plan 四格 .plan-field：Entry / Position / Stop / Target。

7. **免责声明** — section-disclaimer 下 .disclaimer 小字灰色。

### 数据规则
- Hero 中的现价、涨跌幅、PE、市值、概念标签 **必须** 来自「报告头部结构化数据」；系统会在预览端自动注入这些数字，你仍须在 HTML 中输出 hero 结构，但数字应与结构化数据一致。
- 数字不可编造；缺失时显示「—」，勿写「待核实」占位。
- 涨跌幅：正数用 .change.up，负数用 .change.down。
`
}

// ReportNavItems returns sidebar nav entries for documentation in tests.
func ReportNavItems() []struct{ ID, Label string } {
	return []struct{ ID, Label string }{
		{"section-info", "标的信息"},
		{"section-review", "游资速评"},
		{"section-emotion", "情绪周期"},
		{"section-fund", "龙虎&资金"},
		{"section-fund-holders", "机构持仓"},
		{"section-tech", "技术走势"},
		{"section-experts", "大佬观点"},
		{"section-radar", "22维雷达"},
		{"section-action", "操作建议"},
	}
}
