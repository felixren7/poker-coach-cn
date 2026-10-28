# AGENTS.md

## 项目

“河牌之前”是中文德州扑克学习/训练系统。目标不是预测输赢，而是建立“规则 → 概率 → 范围 → 决策 → 复盘”的能力。

技术栈：Node.js 20+、原生 ES Modules、零运行时依赖、`node:test`、`localStorage`。没有构建步骤。

## 命令

```bash
npm start       # http://127.0.0.1:5188；端口冲突自动 +1
npm test        # node --test tests/*.test.js
PORT=6188 npm start
```

浏览器冒烟脚本在 `tools/`，依赖开发者自行启动的 Chrome CDP（默认 9223）与应用服务；它们不是产品运行时依赖。

## 不可违反的边界

1. **规则、概率、策略、内容、UI 分层。** 规则引擎不导入内容/UI；内容不把策略文案散落在组件里。
2. **策略与电脑对手不能读取隐藏信息。** 只使用 `getPublicView(table, seat)`：自己的底牌、公共牌、筹码、行动历史；不能读 `deck`、`burned`、其他玩家 `hole`、未来公共牌。
3. **复盘重做使用决策时快照。** 结果信息必须单独标注“事后可知”；不能用未来公共牌/对手暗牌重做或评分。
4. **评分不接收结果。** 不能根据最终公共牌或单手输赢反推决策好坏。
5. **不伪造策略精度。** 没有可靠求解器时，不输出精确 EV 损失、GTO 频率或“唯一最优”；文案标注“教学基线/简化假设”。
6. **推荐答案必须合法。** 内容测试会用引擎重算每个 `answer.recommended` / `answer.acceptable`；新增题目必须通过。
7. **概率口径。** 区分补牌完成概率、摊牌权益、最终赢池概率；权益模拟必须说明对手范围、模拟次数与估算性质；补牌不重复计算。
8. **筹码守恒。** 引擎修改后必须保持整数筹码、无重复牌、无负筹码、未跟注退回、边池/分池正确。

## 关键文件

- `src/engine/table.js`：状态机、合法操作、短全部全下重开权、边池、结算；改这里先看 `tests/engine.test.js`。
- `src/engine/handEval.js`：牌力；所有手牌名称/比较的单一来源。
- `src/engine/odds.js` / `ranges.js`：公式与范围权益；新增公式必须加测试。
- `src/engine/strategy.js`：教学基线；任何输出都要带 assumptions，不读隐藏信息。
- `src/engine/bots.js`：规则型对手；只消费公开视图。
- `src/content/questions.js`：34 道结构化题；`makeSpot` 构造 6 人快照。
- `src/content/lessons.js`：5 阶段 10 课；demo/practice 引用题目。
- `src/training/scenario.js`：题目快照 → 引擎状态；推荐答案合法性依赖它。
- `src/training/scoring.js`：四类判定。
- `src/state/store.js`：localStorage schema、复习、错题、模拟记录。
- `src/views/simulator.js`：完整牌局、机器人循环、active 恢复、结果面板。
- `src/views/review.js` + `src/training/replay.js`：逐街复盘与重做。

## 内容约定

- 题目必须包含：`id`、`phase`、`lessonId`、`family`、`tags`、`difficulty`、`type`、`title`、`prompt`、`explanation.summary`、3 条 `hints`、`teachingGoal`、`source`。
- 行动题：`spot`、`answer.recommended`；可选 `answer.acceptable`；`explanation` 尽量包含 hand/range/factors/sizing/alternatives/mistakes/future。
- 题干必须给全：位置、人数、有效筹码、底池、待跟注、此前行动、对手范围或“未知”、合法操作提示（界面由引擎计算）。
- 每道题必须被某节课 `demoQuestionId` 或 `practiceQuestionIds` 引用。
- 术语用 `{{glossary-id}}`；新增术语同步 `src/content/glossary.js`。
- 所有策略例子注明适用环境：6-max、100BB、无前注/抽水；不要套用到锦标赛/短筹码。
- 中文默认；首次术语提供中文解释与英文缩写。

## 修改流程

1. 读相关引擎/内容/测试；不要假设现有实现存在（本项目从空目录搭建）。
2. 规则/概率改动先写或更新测试，再改实现。
3. UI 改动检查桌面与手机（390px）布局；模拟牌局行动面板在手机固定底部。
4. 跑 `npm test`；必要时用 `tools/` 的 CDP 脚本做真实浏览器冒烟。
5. 更新 README 的“已知限制/验证结果”如果能力边界或测试数量变化。

## 测试口径

- `tests/engine.test.js`：规则/边池/全下/筹码守恒/80 手随机。
- `tests/handEval.test.js`：牌型/踢脚/轮子顺/最佳五张。
- `tests/odds.test.js`：公式、组合数、权益模拟误差。
- `tests/strategy.test.js`：起手牌、听牌去重、牌面、教练公开信息边界。
- `tests/content.test.js`：题目结构、局面自洽、答案合法性、课程引用、术语。
- `tests/scoring.test.js`、`tests/store.test.js`、`tests/replay.test.js`：评分/复习/持久化/重放/隐藏信息。

不要通过删除断言或放宽合法性来让测试通过；先修实现或题目数据。
