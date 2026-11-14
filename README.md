# MWIActionProfit

银河奶牛放置（Milky Way Idle）的 Tampermonkey 脚本。
A Tampermonkey userscript for Milky Way Idle.

## 安装 / Install

1. 先装浏览器插件 [Tampermonkey](https://www.tampermonkey.net/)。
2. 点这个链接安装脚本：
   **[mwi-action-estimate.user.js](https://raw.githubusercontent.com/Sophophobia/MWIActionProfit/main/mwi-action-estimate.user.js)**
3. 刷新游戏页面。

以后有新版本，Tampermonkey 会自动更新（默认每天检查一次，也可以在 Tampermonkey 里手动点“检查更新”）。

## 功能 / Features

**行动面板**（在“持续时间～当前效率”右边的空白处显示）
- 完成设定次数后技能会到多少级、获得多少经验
- 产出总价（已扣 4% 市场税），以及扣掉原料成本后的数字
- 每小时入账
- 次数设为无限时：不耗材料的行动只显示每小时收益；要耗材料的行动按“用完现有材料”计算

**收益排行**（页面右侧的“📊 收益排行”按钮）
- 所有采集、生产行动按每小时收益排行
- 筛选：我能做的 / 全部；技能；技能下的分类（材料、脚部、手部……）
- 排序：按产值、按利润（扣原料）、按经验
- 卖价可选：直接卖给买单 / 自己挂卖单
- 名字跟随游戏语言（中文 / 英文）

## 计算说明

- 卖出：默认按最高买单价；没有买单的物品按 0 算并标红“无买单”
- 原料：按最低卖单价买入，只算这个行动直接消耗的材料，不往上追更原始的材料
- 市场价来自游戏定时发布的快照，排行顶部显示快照时间
- 没有扣除茶和饮料的消耗；冷门物品成交量可能很小

## License

MIT
