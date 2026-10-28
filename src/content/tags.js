/**
 * 知识标签：题目的覆盖范围、错题归因与能力进度都以此为准。
 */
export const TAG_GROUPS = [
  { id: 'rules', name: '规则与牌型' },
  { id: 'preflop', name: '翻牌前' },
  { id: 'postflop', name: '翻牌后' },
  { id: 'math', name: '概率与数学' },
  { id: 'advanced', name: '高阶与心态' }
];

export const TAGS = {
  'rules-flow': { name: '行动流程', group: 'rules', phase: 1 },
  'hand-ranking': { name: '牌型比较', group: 'rules', phase: 1 },
  'best-five': { name: '最佳五张', group: 'rules', phase: 1 },
  'legal-action': { name: '合法操作', group: 'rules', phase: 1 },
  position: { name: '位置意识', group: 'preflop', phase: 2 },
  'hand-selection': { name: '起手牌选择', group: 'preflop', phase: 2 },
  'preflop-open': { name: '翻前开池', group: 'preflop', phase: 2 },
  'facing-raise': { name: '面对加注', group: 'preflop', phase: 2 },
  'three-bet': { name: '再加注', group: 'preflop', phase: 2 },
  'bb-defense': { name: '大盲防守', group: 'preflop', phase: 2 },
  'made-hand': { name: '成牌识别', group: 'postflop', phase: 3 },
  draw: { name: '听牌识别', group: 'postflop', phase: 3 },
  'board-texture': { name: '牌面质地', group: 'postflop', phase: 3 },
  'value-bet': { name: '价值下注', group: 'postflop', phase: 3 },
  'semi-bluff': { name: '半诈唬', group: 'postflop', phase: 3 },
  multiway: { name: '多人底池', group: 'postflop', phase: 3 },
  'pot-control': { name: '控池', group: 'postflop', phase: 3 },
  sizing: { name: '下注尺度', group: 'postflop', phase: 3 },
  'turn-river': { name: '转牌与河牌', group: 'postflop', phase: 4 },
  outs: { name: '补牌计算', group: 'math', phase: 4 },
  'pot-odds': { name: '底池赔率', group: 'math', phase: 4 },
  'implied-odds': { name: '隐含赔率', group: 'math', phase: 4 },
  equity: { name: '权益概念', group: 'math', phase: 4 },
  resulting: { name: '结果偏差', group: 'math', phase: 4 },
  range: { name: '范围推断', group: 'advanced', phase: 5 },
  'range-advantage': { name: '范围优势', group: 'advanced', phase: 5 },
  blockers: { name: '阻断牌', group: 'advanced', phase: 5 },
  combos: { name: '组合数', group: 'advanced', phase: 5 },
  exploit: { name: '针对性调整', group: 'advanced', phase: 5 },
  gto: { name: 'GTO 与混合策略', group: 'advanced', phase: 5 },
  'mixed-strategy': { name: '混合策略', group: 'advanced', phase: 5 },
  variance: { name: '波动', group: 'advanced', phase: 5 },
  'sample-size': { name: '样本量', group: 'advanced', phase: 5 },
  review: { name: '复盘方法', group: 'advanced', phase: 5 }
};

export const TAG_IDS = Object.keys(TAGS);

export function tagName(id) {
  return TAGS[id]?.name || id;
}

export function tagsByGroup(group) {
  return Object.entries(TAGS)
    .filter(([, meta]) => meta.group === group)
    .map(([id, meta]) => ({ id, ...meta }));
}
