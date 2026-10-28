/**
 * 结构化题库。
 *
 * 每道题的 spot 都是“决策时刻”的完整快照：6 名玩家、位置、筹码、本轮投入、
 * 有效筹码、底池、行动历史、当前合法操作与对手范围假设。规则合法性由引擎重新计算，
 * 不依赖题目的推荐答案。
 */

const POSITIONS = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];

const SOURCE =
  '教学基线（非求解器）：6-max 无限注德州扑克，100BB 有效筹码，SB 0.5BB / BB 1BB，无前注、无抽水、虚拟筹码。策略来自简化范围与启发式，不声称 GTO、精确 EV 损失或唯一最优。';
const RULES_SOURCE =
  '依据标准无限注德州扑克规则：52 张牌、6 人桌、无前注、无抽水、虚拟筹码。花色不参与非同一牌型的比较。';
const MATH_SOURCE =
  '数学计算题。题干中会明确补牌、底池、跟注额与假设；结果不把“补牌完成概率”冒充“最终获胜概率”。';

function makePlayers(street, overrides = {}) {
  const players = {};
  for (const pos of POSITIONS) {
    const o = overrides[pos] || {};
    const committed = o.committed ?? 0;
    const stack = o.stack ?? 200 - committed;
    players[pos] = {
      committed,
      stack,
      streetBet: o.streetBet ?? (street === 'preflop' ? committed : 0),
      folded: Boolean(o.folded),
      allIn: o.allIn ?? stack === 0
    };
  }
  return players;
}

function makeSpot({
  street = 'preflop',
  board = [],
  heroPos,
  heroCards,
  overrides = {},
  currentBet,
  lastRaiseSize,
  canRaise = true,
  actionLog = [],
  villainRange = '未知（没有可靠的对手倾向信息）',
  note = ''
}) {
  const players = makePlayers(street, overrides);
  const maxStreetBet = Math.max(0, ...Object.values(players).map((p) => p.streetBet));
  return {
    street,
    board,
    heroPos,
    heroCards,
    players,
    currentBet: currentBet ?? maxStreetBet,
    lastRaiseSize: lastRaiseSize ?? (street === 'preflop' ? 2 : maxStreetBet || 2),
    canRaise,
    actionLog,
    villainRange,
    note
  };
}

const post = (pos, amount) => ({ street: 'preflop', pos, action: 'post', amount });
const fold = (street, pos) => ({ street, pos, action: 'fold' });
const check = (street, pos) => ({ street, pos, action: 'check' });
const call = (street, pos, amount) => ({ street, pos, action: 'call', amount });
const raise = (street, pos, to) => ({ street, pos, action: 'raise', to });
const bet = (street, pos, to) => ({ street, pos, action: 'bet', to });

const standardBlinds = [post('SB', 1), post('BB', 2)];

export const QUESTIONS = [
  // ---------------------------------------------------------------- 第一阶段
  {
    id: 'q_best_five_royal',
    phase: 1,
    lessonId: 'L2',
    family: 'best-five',
    tags: ['hand-ranking', 'best-five'],
    difficulty: 1,
    type: 'best-five',
    title: '把七张牌拼成最大五张',
    prompt: '你手持 A♥ K♥，公共牌 Q♥ J♥ 10♥ 2♣ 3♦。选出你的最佳五张。',
    cards: { hero: ['Ah', 'Kh'], board: ['Qh', 'Jh', 'Th', '2c', '3d'] },
    explanation: {
      summary:
        '最佳五张是 A♥ K♥ Q♥ J♥ 10♥，构成皇家同花顺（A 高同花顺），使用了两张底牌。',
      hand: '五张红桃且从 10 到 A 连续，这是最高牌型；四张 A 或普通同花都比不过它。',
      factors: [
        '先检查是否有五张同花色，再检查这些牌是否连续。',
        '同花顺同时满足“同花”和“顺子”，牌型等级最高。',
        '最佳五张可以使用 0、1 或 2 张底牌；本例使用 2 张。'
      ],
      mistakes: [
        '只看到“A 高”而忽略同花顺。',
        '坚持必须使用两张底牌，或把 2♣、3♦ 拼进来破坏连续与同花。'
      ],
      future: '若把公共牌换成 Q♥ J♥ 9♥ 2♣ 3♦，A♥K♥ 仍然是 A 高同花，但不再是顺子。'
    },
    hints: [
      '先数一数公共牌和底牌里同花色有几张。',
      '同花顺是“同花”和“顺子”同时成立，等级最高。',
      '把 A♥ K♥ 与 Q♥ J♥ 10♥ 放在一起看。'
    ],
    teachingGoal: '从七张牌中选出最佳五张，并识别同花顺。',
    source: RULES_SOURCE
  },
  {
    id: 'q_compare_kicker',
    phase: 1,
    lessonId: 'L2',
    family: 'compare-kicker',
    tags: ['hand-ranking'],
    difficulty: 1,
    type: 'compare',
    title: '同样是三条，谁赢？',
    prompt: '公共牌 A♣ A♦ 9♠ 7♥ 4♣。比较玩家 A 与玩家 B 的最佳五张。',
    compare: {
      board: ['Ac', 'Ad', '9s', '7h', '4c'],
      A: { name: '玩家 A', hole: ['Ah', 'Kc'] },
      B: { name: '玩家 B', hole: ['As', 'Qc'] },
      correct: 'A'
    },
    explanation: {
      summary: '玩家 A 用 K 踢脚取胜。两人都是三条 A，但 A 的第五张牌 K 大于 B 的 Q。',
      hand:
        'A 的最佳五张：A♥ A♣ A♦ K♣ 9♠；B 的最佳五张：A♠ A♣ A♦ Q♣ 9♠。',
      factors: [
        '主要牌型相同（都是三条 A），继续比较踢脚。',
        'A 的 K 踢脚压过 B 的 Q 踢脚；9 相同，7、4 更靠后，不再影响结果。',
        '花色不影响大小；A♥ 与 A♠ 只是不同花色。'
      ],
      mistakes: ['看到自己有一张 A 就以为必胜。', '把“三条 A”当成完整比较，忽略踢脚。'],
      future: '如果公共牌换成 A♣ A♦ K♠ K♥ 4♣，双方都能用公共牌的两张 K 组成 A 带 K 的葫芦，这时不是比踢脚，而是平局。'
    },
    hints: [
      '先确认双方的主要牌型是否相同。',
      '主要牌型相同就要逐张比较踢脚。',
      '把双方的最佳五张分别写出来：A♥A♣A♦K♣9♠ 与 A♠A♣A♦Q♣9♠。'
    ],
    teachingGoal: '理解踢脚在牌型相同时的决定作用。',
    source: RULES_SOURCE
  },
  {
    id: 'q_compare_wheel',
    phase: 1,
    lessonId: 'L2',
    family: 'compare-wheel',
    tags: ['hand-ranking'],
    difficulty: 2,
    type: 'compare',
    title: 'A2345 是不是顺子？',
    prompt: '公共牌 K♠ 9♠ 5♦ 4♣ 2♥。玩家 A 手持 A♦ 3♣，玩家 B 手持 K♥ 9♦。谁赢？',
    compare: {
      board: ['Ks', '9s', '5d', '4c', '2h'],
      A: { name: '玩家 A', hole: ['Ad', '3c'] },
      B: { name: '玩家 B', hole: ['Kh', '9d'] },
      correct: 'A'
    },
    explanation: {
      summary:
        '玩家 A 获胜。A 可以当作 1，组成 A-2-3-4-5 的 5 高顺子，顺子大于两对。',
      hand:
        'A 的最佳五张：A♦ 2♥ 3♣ 4♣ 5♦，是 5 高顺子；B 的最佳五张：K♠ K♥ 9♠ 9♦ 5♦，是 K 和 9 两对。',
      factors: [
        'A2345 是合法顺子，A 在此充当 1；它是所有顺子中最小的（5 高）。',
        '顺子的牌型等级高于两对，因此 A 获胜。',
        '若 A 换成 6（6-5-4-3-2），就是 6 高顺子，仍然大于两对。'
      ],
      mistakes: ['误以为 A 只能当最大牌，认为 A2345 不是顺子。', '只看到 B 的两对，忘记顺子等级更高。'],
      future: '如果公共牌是 K♠ 9♠ 5♦ 4♣ 3♥，A♦2♣ 也能组成 A2345；若牌面有 6，则顺子高点会改变。'
    },
    hints: [
      'A 在 A2345 中可以当作 1。',
      '先分别写出双方的最佳五张。',
      '顺子 > 两对；A 的顺子是 5 高。'
    ],
    teachingGoal: '掌握 A2345 顺子与牌型等级比较。',
    source: RULES_SOURCE
  },
  {
    id: 'q_compare_tie',
    phase: 1,
    lessonId: 'L2',
    family: 'compare-tie',
    tags: ['hand-ranking'],
    difficulty: 2,
    type: 'compare',
    title: '公共牌已经最大，谁赢？',
    prompt:
      '公共牌 A♠ K♦ Q♣ J♥ 10♠。玩家 A 手持 2♣ 3♦，玩家 B 手持 4♥ 4♠。结果是什么？',
    compare: {
      board: ['As', 'Kd', 'Qc', 'Jh', 'Ts'],
      A: { name: '玩家 A', hole: ['2c', '3d'] },
      B: { name: '玩家 B', hole: ['4h', '4s'] },
      correct: 'tie'
    },
    explanation: {
      summary: '平局。双方都可以完全使用公共牌组成 A 高顺子，底牌没有让任何一方更强。',
      hand: '双方最佳五张都是 A♠ K♦ Q♣ J♥ 10♠。B 的一对 4 只是第七、第八张牌，无法塞进最佳五张。',
      factors: [
        '最佳五张可以使用 0 张底牌；公共牌本身已经构成 A 高顺子。',
        'B 的一对 4 若强行使用，会破坏顺子，反而更差。',
        '牌型与五张牌完全一致时平分底池；花色不参与比较。'
      ],
      mistakes: ['认为有对子就一定比公共牌强。', '忽略“最佳五张”可以完全不使用底牌。'],
      future: '如果公共牌换成 A♠ K♦ Q♣ J♥ 9♠，A 的高牌与 B 的一对 4 就要重新比较，B 会赢。'
    },
    hints: [
      '先看公共牌本身是什么牌型。',
      '最佳五张不一定需要底牌。',
      '双方能否都使用 A-K-Q-J-10 这五张？'
    ],
    teachingGoal: '理解公共牌打满与平局分池。',
    source: RULES_SOURCE
  },
  {
    id: 'q_legal_bb_facing_raise',
    phase: 1,
    lessonId: 'L1',
    family: 'legal-preflop',
    tags: ['legal-action', 'rules-flow', 'position'],
    difficulty: 1,
    type: 'legal',
    title: '大盲面对加注，哪些操作合法？',
    prompt: '你在 BB，面对 BTN 加注到 2.5BB。选出当前所有合法操作（可多选）。',
    spot: makeSpot({
      street: 'preflop',
      heroPos: 'BB',
      heroCards: ['9c', '8c'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 5, streetBet: 5 },
        SB: { committed: 1, folded: true },
        BB: { committed: 2 }
      },
      currentBet: 5,
      lastRaiseSize: 3,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB')
      ],
      villainRange: 'BTN 的简化开池范围较宽；这是翻牌前，尚未看到公共牌。'
    }),
    explanation: {
      summary: '合法操作是弃牌、跟注、加注；不能过牌，也不能用“下注”这个词。',
      hand: '你当前只有 9♣8♣ 高牌，尚未成牌；本阶段的重点是操作是否合法，而不是这手牌该不该玩。',
      range: '此处不需要推断对手具体牌，只需要知道当前最高下注是 5。',
      factors: [
        '面对已有下注时，不能过牌（check）。',
        '你需要跟注 5 − 2 = 3 枚筹码；这是合法跟注。',
        '当前最高下注 5、上次完整加注增量为 3，所以最小加注到 8。',
        '弃牌永远合法；即使你有能跟注的筹码，也可以放弃。'
      ],
      sizing: '加注要说明“加到多少”：最小加到 8（4BB）；不是“额外加 3”。',
      alternatives: [
        '跟注：投入 3，保留继续游戏的权利。',
        '加注：至少加到 8；你的全部筹码也可全下。',
        '弃牌：放弃本手牌。'
      ],
      mistakes: ['想点“过牌”，但面前有下注时不允许。', '把“下注”与“加注”混为一谈。'],
      future: '若你加注，行动会回到原加注者 BTN 继续响应；SB 已经弃牌，你身后没有其他未行动的玩家。'
    },
    hints: [
      '先看当前最高下注与你自己已经投入了多少。',
      '面对下注时，过牌不合法；可用的基本选择是弃牌、跟注、加注。',
      '跟注差额是 3；最小加注到 8。'
    ],
    teachingGoal: '根据当前下注识别合法操作与最小加注。',
    source: RULES_SOURCE
  },
  {
    id: 'q_choice_preflop_order',
    phase: 1,
    lessonId: 'L1',
    family: 'action-order',
    tags: ['rules-flow', 'position'],
    difficulty: 1,
    type: 'choice',
    title: '翻牌前谁先行动？',
    prompt: '6 人桌，盲注已下。翻牌前第一个行动的是哪个位置？',
    options: [
      { id: 'utg', text: 'UTG（枪口位）' },
      { id: 'hj', text: 'HJ（劫位）' },
      { id: 'co', text: 'CO（关位）' },
      { id: 'bb', text: 'BB（大盲）' }
    ],
    correct: ['utg'],
    explanation: {
      summary: 'UTG 先行动。翻牌前的行动顺序是 UTG → HJ → CO → BTN → SB → BB。',
      factors: [
        '庄位（BTN）顺时针接下来是 SB、BB。',
        '大盲之后的第一位是 UTG，因此它是翻牌前第一个行动者。',
        '翻牌后的行动顺序改为从 SB 开始：SB → BB → UTG → HJ → CO → BTN。'
      ],
      mistakes: ['把翻牌前和翻牌后的行动顺序混淆。', '以为 BTN 永远第一个行动。'],
      future: '记住大盲有“最后选项”：翻牌前如果无人加注，BB 仍可在所有人跟注后过牌或加注。'
    },
    hints: [
      '从庄位顺时针数：BTN、SB、BB、UTG……',
      '翻牌前从大盲左手第一位开始。',
      '翻牌后则从庄位左手第一位（SB）开始。'
    ],
    teachingGoal: '记住 6 人桌翻牌前/翻牌后的行动顺序。',
    source: RULES_SOURCE
  },
  {
    id: 'q_legal_flop_no_bet',
    phase: 1,
    lessonId: 'L1',
    family: 'legal-postflop',
    tags: ['legal-action', 'rules-flow'],
    difficulty: 2,
    type: 'legal',
    title: '翻牌无人下注，哪些操作合法？',
    prompt: '翻牌 K♠ 7♦ 2♣，轮到你（BB）先行动，当前无人下注。选出所有合法操作。',
    spot: makeSpot({
      street: 'flop',
      board: ['Ks', '7d', '2c'],
      heroPos: 'BB',
      heroCards: ['9c', '8c'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 5 },
        SB: { committed: 1, folded: true },
        BB: { committed: 5 }
      },
      currentBet: 0,
      lastRaiseSize: 2,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3)
      ],
      villainRange: 'BTN 的简化开池范围；翻牌 K-7-2 彩虹面。'
    }),
    explanation: {
      summary: '合法操作是弃牌、过牌、下注；没有“跟注”或“加注”，因为当前无人下注。',
      hand: '你有 9♣8♣，目前是 9 高牌；本阶段先掌握合法操作。',
      range: '对手范围未知；无人下注时，行动顺序从 SB 开始，你在 BB，BTN 最后行动。',
      factors: [
        '当前最高本轮投入为 0，所以可以过牌，也可以主动下注。',
        '没有需要跟的注，因此“跟注”不合法。',
        '加注必须发生在有人下注之后；此处应叫“下注”。',
        '下注最小为一个大盲（2 枚筹码），最大为你的全部后手。'
      ],
      sizing: '下注额是你本轮额外投入的总数；例如下注 4 就是投入 4 枚筹码。',
      alternatives: ['过牌：不投入，把行动交给下一位。', '下注：至少 2 枚筹码。', '弃牌：放弃本手牌。'],
      mistakes: ['在无人下注时点“跟注”。', '认为过牌等于弃牌。'],
      future: '若你下注，BTN 可以弃牌、跟注或加注；若你过牌，BTN 也可以过牌结束本轮。'
    },
    hints: [
      '当前最高下注是多少？',
      '无人下注时，跟注没有对象。',
      '合法选项：弃牌、过牌、下注（至少 1BB）。'
    ],
    teachingGoal: '区分过牌/下注与跟注/加注的适用条件。',
    source: RULES_SOURCE
  },

  // ---------------------------------------------------------------- 第二阶段
  {
    id: 'q_preflop_aa_utg',
    phase: 2,
    lessonId: 'L3',
    family: 'preflop-aa',
    tags: ['hand-selection', 'preflop-open', 'position'],
    difficulty: 1,
    type: 'action',
    title: 'UTG 拿到 AA 怎么开池？',
    prompt: '6 人桌，你在 UTG 首先行动，手持 A♥ A♠，后面五人都未行动。你的默认动作是？',
    spot: makeSpot({
      street: 'preflop',
      heroPos: 'UTG',
      heroCards: ['Ah', 'As'],
      overrides: { SB: { committed: 1 }, BB: { committed: 2 } },
      currentBet: 2,
      lastRaiseSize: 2,
      actionLog: standardBlinds,
      villainRange: '其他玩家尚未行动，范围未知。'
    }),
    answer: {
      recommended: [{ type: 'raise', minTo: 4, maxTo: 6 }],
      acceptable: [{ type: 'raise', minTo: 7, maxTo: 12 }],
      note: '2–3BB 开池是简化默认；更大尺度也可接受，但会改变对手跟注范围。'
    },
    explanation: {
      summary: '默认加注到 2–3BB（4–6 枚筹码）。AA 是最强起手牌，应主动做大底池。',
      hand: 'A♥A♠ 是口袋对子，翻牌前约对任意一手随机牌有 85% 权益；但翻牌后仍可能被追上。',
      range: '后面五人都未行动；主动加注可以缩小对手范围并建立底池。',
      factors: [
        'UTG 身后还有五名玩家，平跟会让多人便宜看翻牌，AA 在多路底池更易被反超。',
        '开池加注能获得价值，并让对手用较弱范围跟注。',
        '100BB 无前注环境下，2.5–3BB 是常见的简化开池尺度；更大尺度不是错误，但会收紧对手跟注范围。'
      ],
      sizing: '加注到 5（2.5BB）是默认；加注到 6（3BB）也合理。',
      alternatives: [
        '加注到 7–12：更大尺度，可能获得更少跟注但单次投入更多；归为合理取舍。',
        '跟注（跛入）：不推荐，容易让五名对手便宜看翻牌。'
      ],
      mistakes: ['因为“怕把人吓跑”而平跟。', '认为 AA 翻牌前必胜，忽略翻后风险。'],
      future: '翻牌出现 KQJ 或同花面时，AA 只是超对/高对，仍需根据对手行动重新评估。'
    },
    hints: [
      '先判断手牌在翻牌前的强度等级。',
      '你在 UTG，后面还有五名玩家；平跟会怎样？',
      '默认加注到约 2.5–3BB。'
    ],
    teachingGoal: '用强起手牌主动开池，并理解尺度与对手范围的关系。',
    source: SOURCE
  },
  {
    id: 'q_preflop_72o_btn',
    phase: 2,
    lessonId: 'L4',
    family: 'facing-raise-junk',
    tags: ['hand-selection', 'facing-raise', 'position'],
    difficulty: 1,
    type: 'action',
    title: '位置好就能玩 72o 吗？',
    prompt: 'UTG 加注到 2.5BB，HJ、CO 弃牌，你在 BTN 手持 7♦ 2♣。默认动作是？',
    spot: makeSpot({
      street: 'preflop',
      heroPos: 'BTN',
      heroCards: ['7d', '2c'],
      overrides: {
        UTG: { committed: 5, streetBet: 5 },
        HJ: { folded: true },
        CO: { folded: true },
        SB: { committed: 1 },
        BB: { committed: 2 }
      },
      currentBet: 5,
      lastRaiseSize: 3,
      actionLog: [
        ...standardBlinds,
        raise('preflop', 'UTG', 5),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO')
      ],
      villainRange: 'UTG 早期位置开池范围较紧，通常包含强对子、强 A×、强同花大牌；不是随机牌。'
    }),
    answer: {
      recommended: [{ type: 'fold' }],
      acceptable: [],
      note: '72o 是简化评分中最差的起手牌之一；位置不能弥补牌力与可玩性。'
    },
    explanation: {
      summary: '弃牌。72o 几乎没有可玩性，面对 UTG 的紧范围，跟注会长期亏损。',
      hand: '7♦2♣ 非同花、不连张、最高牌只有 7；翻牌后很难成强牌，且被压制时不易察觉。',
      range: 'UTG 在早期位置的范围较紧；你即使有位置，也很难用 72o 实现权益。',
      factors: [
        '跟注 5 需要投入 2.5BB，底池赔率约 5/(8+5)=38.5%，对最差起手牌远远不够。',
        '位置只在牌力接近、可玩性足够时才有价值；72o 翻牌后大多只能击中一对 7 或 2，踢脚极差。',
        '用垃圾牌跟注会制造“看起来在打牌、实际在送筹码”的假象。'
      ],
      sizing: '弃牌不投入更多筹码；已投入的盲注属于沉没成本。',
      alternatives: ['没有合理的加注/跟注理由；若你想练习诈唬，应选择有阻断牌和可玩性的牌，而不是 72o。'],
      mistakes: ['因为“在按钮位”就跟注任意两张牌。', '把“底池赔率看起来还行”当成可以玩垃圾牌的理由。'],
      future: '如果你在 BTN 面对的是极宽的小盲全下，72o 的赔率可能需要重新计算；但面对 UTG 开池，默认弃牌。'
    },
    hints: [
      '先看起手牌本身：72o 能组成什么强牌？',
      'UTG 的开池范围比 BTN 紧得多。',
      '位置不是无视牌力的通行证；默认弃牌。'
    ],
    teachingGoal: '理解位置不能弥补极端弱的起手牌。',
    source: SOURCE
  },
  {
    id: 'q_preflop_ato_utg',
    phase: 2,
    lessonId: 'L3',
    family: 'preflop-ato-position',
    tags: ['position', 'hand-selection', 'preflop-open'],
    difficulty: 2,
    type: 'action',
    title: 'ATo 在 UTG：同一手牌的艰难版本',
    prompt: '你在 UTG 首先行动，手持 A♠ T♦。盲注 0.5/1BB，后面五人都未行动。默认动作是？',
    spot: makeSpot({
      street: 'preflop',
      heroPos: 'UTG',
      heroCards: ['As', 'Td'],
      overrides: { SB: { committed: 1 }, BB: { committed: 2 } },
      currentBet: 2,
      lastRaiseSize: 2,
      actionLog: standardBlinds,
      villainRange: '其他玩家尚未行动；UTG 身后有五人。'
    }),
    answer: {
      recommended: [{ type: 'fold' }],
      acceptable: [{ type: 'raise', minTo: 4, maxTo: 6 }],
      note: '简化新手基线偏紧，默认弃牌；部分简化/求解范围会低频率开池，因此加注列为可接受但需理解条件。'
    },
    explanation: {
      summary: '默认弃牌。ATo 在 UTG 容易被 AJ+、AQ、AK 与强对子压制，位置又最差。',
      hand: 'A♠T♦ 有 A 高和 T 踢脚；能击中顶对，但踢脚问题明显，且非同花减少可玩性。',
      range: 'UTG 的紧范围让你在翻牌后经常“击中却不够好”；这不是一手适合在五人未行动时扩大底池的牌。',
      factors: [
        'A× 的踢脚问题：击中 A 时，对手的 AJ/AQ/AK 都压制你。',
        'UTG 位置最差，翻牌后要最先行动，难以实现权益。',
        '简化新手范围优先选择更强的高张、同花大牌与对子；ATo 属于边缘牌。'
      ],
      sizing: '若你选择开池，2–3BB 是常见尺度；不要用大额加注把弱范围放大。',
      alternatives: [
        '加注 2–3BB：部分范围会混合开池，但不是默认；需要你有清晰的翻后计划。',
        '跟注（跛入）：不推荐，会让盲注便宜看牌且翻后更难打。'
      ],
      mistakes: ['看到 A 就无条件开池。', '忽略“踢脚问题”与身后未行动人数。'],
      future: '同一手 ATo 在 BTN 且前面都弃牌时，开池会合理得多；位置改变了同一手牌的价值。'
    },
    hints: [
      '这手牌击中 A 时，踢脚 T 可能被哪些牌压制？',
      '你在 UTG，后面还有五个人没行动。',
      '新手简化基线默认弃牌；若开池只应小尺度。'
    ],
    teachingGoal: '用同一手牌理解位置与踢脚如何改变翻前决策。',
    source: SOURCE
  },
  {
    id: 'q_preflop_ato_btn',
    phase: 2,
    lessonId: 'L3',
    family: 'preflop-ato-position',
    tags: ['position', 'hand-selection', 'preflop-open'],
    difficulty: 2,
    type: 'action',
    title: 'ATo 在 BTN：位置改变决策',
    prompt: 'UTG、HJ、CO 都弃牌，你在 BTN 手持 A♠ T♦，只有 SB、BB 未行动。默认动作是？',
    spot: makeSpot({
      street: 'preflop',
      heroPos: 'BTN',
      heroCards: ['As', 'Td'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        SB: { committed: 1 },
        BB: { committed: 2 }
      },
      currentBet: 2,
      lastRaiseSize: 2,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO')
      ],
      villainRange: '只剩 SB、BB 未行动；他们的防守范围通常比 UTG 开池范围宽，但仍包含强牌。'
    }),
    answer: {
      recommended: [{ type: 'raise', minTo: 4, maxTo: 6 }],
      acceptable: [{ type: 'raise', minTo: 7, maxTo: 10 }],
      note: 'BTN 开池可更宽；2.5–3BB 是默认。'
    },
    explanation: {
      summary: '默认加注到 2–3BB。前面都弃牌，ATo 在 BTN 可以主动开池偷盲并争取位置优势。',
      hand: '同一手 A♠T♦，在 BTN 只需面对两个盲注位，身后未行动玩家从五个变成两个。',
      range: 'SB/BB 的防守范围更宽，ATo 的 A 高与 T 踢脚在对抗盲注防守时更有用；但仍不是无条件强牌。',
      factors: [
        'BTN 翻牌后最后行动，位置优势最大。',
        'SB/BB 会用较宽范围防守，ATo 对抗这些范围的表现好于对抗 UTG 的紧范围。',
        '开池能直接赢下盲注，也能在翻牌后继续施压。'
      ],
      sizing: '默认 2.5BB（5 枚筹码）；3BB 也合理。',
      alternatives: [
        '更大开池 7–10 枚：可接受，但会改变盲注的防守范围。',
        '弃牌：过于保守，放弃明显的位置与偷盲机会。'
      ],
      mistakes: ['把 UTG 的弃牌结论直接套到 BTN。', '因为“只是 ATo”就在按钮位放弃开池。'],
      future: '若 BB 是极松的跟注站，你可以用更线性的价值范围开池；若盲注极激进，则需要收紧并准备应对 3bet。'
    },
    hints: [
      '和上一题相比，身后未行动的玩家少了几个？',
      'BTN 翻牌后最后行动。',
      '默认小尺度开池，约 2.5–3BB。'
    ],
    teachingGoal: '通过 ATo 的对照题理解位置对开池范围的影响。',
    source: SOURCE
  },
  {
    id: 'q_preflop_kqs_sb_3bet',
    phase: 2,
    lessonId: 'L4',
    family: 'preflop-3bet',
    tags: ['three-bet', 'facing-raise', 'position'],
    difficulty: 3,
    type: 'action',
    title: 'SB 的 KQs 面对 BTN 开池',
    prompt: 'BTN 开池到 2.5BB，其余人弃牌，你在 SB 手持 K♠ Q♠，BB 还未行动。默认动作是？',
    spot: makeSpot({
      street: 'preflop',
      heroPos: 'SB',
      heroCards: ['Ks', 'Qs'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 5, streetBet: 5 },
        SB: { committed: 1 },
        BB: { committed: 2 }
      },
      currentBet: 5,
      lastRaiseSize: 3,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5)
      ],
      villainRange: 'BTN 的开池范围较宽；SB 的 KQs 对其有较好的阻挡与可玩性。'
    }),
    answer: {
      recommended: [{ type: 'raise', minTo: 13, maxTo: 18 }],
      acceptable: [{ type: 'call' }],
      note: '再加注到约 6.5–9BB；跟注也可接受，但你在 SB、翻牌后先行动，位置劣势明显。'
    },
    explanation: {
      summary: '默认再加注到约 7.5BB（15 枚筹码）。KQs 有同花、连张与高张潜力，适合作为半诈唬/价值 3bet。',
      hand: 'K♠Q♠ 是强同花大牌，但不是坚果；它能压制 BTN 范围中的许多 K×、Q× 与同花牌。',
      range: 'BTN 的宽开池范围包含大量较弱牌；3bet 可以立即赢下底池，也能在被跟注时保持可玩性。',
      factors: [
        'SB 翻牌后先行动，跟注会让位置劣势放大；3bet 可以降低实现权益的难度。',
        'KQs 有同花与顺子潜力，被跟注后不是“纯空气”。',
        'BB 还未行动；3bet 也能降低 BB 便宜入池的概率。'
      ],
      sizing: '再加注到 15（7.5BB）是默认；13–18 枚是合理范围。',
      alternatives: [
        '跟注 4：可接受，保留对手较弱范围，但在 SB 位置劣势明显。',
        '弃牌：过于保守；KQs 对 BTN 宽范围有足够可玩性。'
      ],
      mistakes: ['因为“只是 KQ”就弃牌。', '只用 AA/KK 3bet，导致范围过于可预测。'],
      future: '若 BTN 4bet，你需要根据其 4bet 范围重新评估；KQs 通常不适合在 100BB 下无条件跟注 4bet。'
    },
    hints: [
      'KQs 在翻牌前有什么可玩性？',
      '你在 SB，翻牌后将先行动；跟注会放大位置劣势。',
      '默认再加注到约 7.5BB；跟注是可接受的替代。'
    ],
    teachingGoal: '用有可玩性的强牌理解 3bet 的目的与尺度。',
    source: SOURCE
  },
  {
    id: 'q_preflop_55_bb',
    phase: 2,
    lessonId: 'L4',
    family: 'preflop-bb-defense',
    tags: ['bb-defense', 'implied-odds', 'facing-raise'],
    difficulty: 3,
    type: 'action',
    title: 'BB 的 55 面对 BTN 开池',
    prompt: 'BTN 开池到 2.5BB，SB 弃牌，你在 BB 手持 5♥ 5♦。默认动作是？',
    spot: makeSpot({
      street: 'preflop',
      heroPos: 'BB',
      heroCards: ['5h', '5d'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 5, streetBet: 5 },
        SB: { committed: 1, folded: true },
        BB: { committed: 2 }
      },
      currentBet: 5,
      lastRaiseSize: 3,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB')
      ],
      villainRange: 'BTN 的宽开池范围；BB 关闭行动，可用较宽范围防守。'
    }),
    answer: {
      recommended: [{ type: 'call' }],
      acceptable: [
        { type: 'fold' },
        { type: 'raise', minTo: 13, maxTo: 18 }
      ],
      note: '默认跟注，利用 100BB 深度与暗三条潜力；浅筹码/高抽水时弃牌更合理。再加注属于进阶混合打法。'
    },
    explanation: {
      summary: '默认跟注 3 枚筹码。55 主要靠翻牌击中暗三条，100BB 深度提供了隐含赔率。',
      hand: '5♥5♦ 是小口袋对子；翻牌击中三条的概率约为 1/8，但击中后通常能赢较大底池。',
      range: 'BTN 的宽开池范围包含许多会被 5 高暗三条压制的牌；BB 已投入 1BB，只需再补 1.5BB。',
      factors: [
        '跟注 3，底池将变为 11；立即底池赔率约 3/11=27.3%，单看翻牌命中率并不够。',
        '隐含赔率来自击中小暗三条后从对手强牌（如顶对/超对）赢到的后续筹码。',
        '有效筹码 100BB、无抽水，适合用小对子跟注；若有效筹码只有 30BB，隐含赔率会明显下降。'
      ],
      sizing: '跟注 3（1.5BB）；不要因为“便宜”而用 55 做大额跟注。',
      alternatives: [
        '弃牌：在浅筹码、抽水高或对手开池范围极紧时合理。',
        '再加注到 13–18：进阶混合打法，可获取弃牌权益，但被跟注后 55 很难实现权益。'
      ],
      mistakes: ['只看“翻牌中三条概率 1/8”就弃牌，忽略隐含赔率。', '用 55 跟注过大的加注，破坏隐含赔率。'],
      future: '翻牌未击中时，55 通常应过牌/弃牌；不要因为投入了 1.5BB 就追到底。'
    },
    hints: [
      '55 主要靠什么牌型赢钱？',
      '你还需要跟注多少？跟注后底池多大？',
      '100BB 深度下，小对子通常有隐含赔率；默认跟注。'
    ],
    teachingGoal: '把隐含赔率、有效筹码与翻牌前跟注联系起来。',
    source: SOURCE
  },

  // ---------------------------------------------------------------- 第三阶段
  {
    id: 'q_postflop_kq_dry',
    phase: 3,
    lessonId: 'L5',
    family: 'top-pair-contrast',
    tags: ['made-hand', 'board-texture', 'pot-control'],
    difficulty: 2,
    type: 'action',
    title: '干燥面上的顶对，面对小注',
    prompt:
      'BTN 翻前开池到 2.5BB，BB 跟注。翻牌 K♦ 8♠ 3♥，BB 过牌，BTN 下注 2BB（约 36% 底池）。你在 BB 手持 K♣ Q♦。默认动作是？',
    spot: makeSpot({
      street: 'flop',
      board: ['Kd', '8s', '3h'],
      heroPos: 'BB',
      heroCards: ['Kc', 'Qd'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 9, streetBet: 4 },
        SB: { committed: 1, folded: true },
        BB: { committed: 5 }
      },
      currentBet: 4,
      lastRaiseSize: 4,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3),
        check('flop', 'BB'),
        bet('flop', 'BTN', 4)
      ],
      villainRange:
        'BTN 的宽开池范围在 K-8-3 干燥面上会持续下注：K×、口袋对子、部分 A 高与空气；并非每次都是 K。'
    }),
    answer: {
      recommended: [{ type: 'call' }],
      acceptable: [{ type: 'raise', minTo: 10, maxTo: 18 }],
      note: '默认跟注，保留对手的较弱下注；加注会让他弃掉更差的牌。'
    },
    explanation: {
      summary: '默认跟注。顶对 Q 踢脚在干燥面对小尺度持续下注足够强，但不应急于加注。',
      hand: 'K♣Q♦ 击中顶对 K，Q 踢脚；在 K-8-3 彩虹干燥面上，这通常是强牌。',
      range: 'BTN 的持续下注范围很宽：K×、88/33、口袋对子、A 高、后门听牌与空气。你领先其中很多。',
      factors: [
        '牌面干燥：很少有强听牌，对手下注 2BB 只占约 36% 底池，范围可以很宽。',
        '跟注让对手继续保持诈唬/较弱 K×；加注通常只会被更强牌跟注。',
        '底池赔率约 4/(15+4)=21.1%，但翻牌圈还有两张公共牌，不能只用这个比例判断最终胜负。'
      ],
      sizing: '跟注 4（2BB）。若加注，10–18 枚是合理范围，但会收缩对手的继续范围。',
      alternatives: [
        '加注到 10–18：可接受，偏保护/价值，但让更差的牌弃牌，且面对更强牌时投入更大。',
        '弃牌：过紧；你领先 BTN 持续下注范围中的大量组合。'
      ],
      mistakes: ['看到顶对就无脑加注。', '因为“只有一对”就弃牌，忽略牌面干燥与对手宽范围。'],
      future: '转牌若出现 A、Q 或第二张方块，需要根据对手是否继续下注重新评估；顶对不是无条件跟到底。'
    },
    hints: [
      '先判断你的成牌与踢脚。',
      '牌面是干燥还是湿润？对手的下注尺度大吗？',
      '顶对在干燥面对小注通常跟注；加注会赶走更差的牌。'
    ],
    teachingGoal: '在干燥面用顶对做出有条件的跟注，而不是机械加注/弃牌。',
    source: SOURCE
  },
  {
    id: 'q_postflop_kq_wet_multiway',
    phase: 3,
    lessonId: 'L5',
    family: 'top-pair-contrast',
    tags: ['multiway', 'board-texture', 'made-hand', 'pot-control'],
    difficulty: 3,
    type: 'action',
    title: '同样顶对，换成湿润多人底池',
    prompt:
      'UTG 开池 2.5BB，BTN 跟注，BB 跟注。翻牌 K♥ 9♥ 8♥，BB 过牌，UTG 下注 4BB，BTN 跟注。你在 BB 手持 K♣ Q♦（无红桃）。默认动作是？',
    spot: makeSpot({
      street: 'flop',
      board: ['Kh', '9h', '8h'],
      heroPos: 'BB',
      heroCards: ['Kc', 'Qd'],
      overrides: {
        UTG: { committed: 13, streetBet: 8 },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 13, streetBet: 8 },
        SB: { committed: 1, folded: true },
        BB: { committed: 5 }
      },
      currentBet: 8,
      lastRaiseSize: 8,
      actionLog: [
        ...standardBlinds,
        raise('preflop', 'UTG', 5),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        call('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3),
        check('flop', 'BB'),
        bet('flop', 'UTG', 8),
        call('flop', 'BTN', 8)
      ],
      villainRange:
        'UTG 早期位置开池、BTN 冷跟，两人范围都偏强。K♥9♥8♥ 单花面上，两人范围包含大量同花、暗三条、两对与强听牌。'
    }),
    answer: {
      recommended: [{ type: 'fold' }],
      acceptable: [],
      note: '顶对无红桃、多人底池、单花面、面对下注+跟注，默认弃牌。'
    },
    explanation: {
      summary:
        '弃牌。顶对 Q 踢脚在单花面、多人底池中相对牌力不足，且你没有红桃可以改进。',
      hand: 'K♣Q♦ 是顶对 K、Q 踢脚；但牌面 K♥9♥8♥ 已经三张红桃，你没有任何红桃。',
      range: 'UTG 下注、BTN 跟注后，两人范围都向强牌集中：同花、顺子、暗三条、两对与强听牌。你的顶对只领先诈唬。',
      factors: [
        '多人底池：面对下注+跟注，诈唬概率显著降低；至少一方有强牌的概率上升。',
        '单花面且你无该花色：成同花的补牌与你无关，转牌/河牌还可能继续发出红桃。',
        '反向隐含赔率：你击中两对/三条仍可能输给同花；继续游戏容易被更强牌榨取。',
        '底池赔率约 8/(32+8)=20%，但这不是“20% 就能跟”的证明；还需估计对两人范围的胜率。'
      ],
      sizing: '弃牌，不再投入。',
      alternatives: [
        '加注：只会被更强的同花/顺子/暗三条跟注，不能保护你免受反超。',
        '跟注：仅在你手持 A♥K♣（顶对+坚果同花听牌）或明确读牌时才有讨论空间。'
      ],
      mistakes: ['把“顶对”当成固定强度的牌，不看牌面与人数。', '在单花面用无红桃的顶对跟注大注。'],
      future: '如果你手持 A♥K♣，你有顶对 + 坚果同花听牌，转牌计划会完全不同；这正是同类手牌不同牌面的对比。'
    },
    hints: [
      '你的顶对是什么踢脚？牌面有几张红桃？',
      '翻牌后是两人还是三人？面对下注+跟注意味着什么？',
      '单花面、无红桃、多人底池：默认弃牌。'
    ],
    teachingGoal: '避免“顶对一定跟注”，学会结合牌面、人数与相对牌力。',
    source: SOURCE
  },
  {
    id: 'q_postflop_combo_draw_bet',
    phase: 3,
    lessonId: 'L6',
    family: 'combo-draw',
    tags: ['draw', 'semi-bluff', 'board-texture', 'sizing'],
    difficulty: 3,
    type: 'action',
    title: '同花 + 两头顺，翻牌要不要下注？',
    prompt:
      'BTN 开池 2.5BB，BB 跟注。翻牌 9♥ 8♣ 2♥，BB 过牌。你在 BTN 手持 7♥ 6♥，当前无人下注。默认动作是？',
    spot: makeSpot({
      street: 'flop',
      board: ['9h', '8c', '2h'],
      heroPos: 'BTN',
      heroCards: ['7h', '6h'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 5 },
        SB: { committed: 1, folded: true },
        BB: { committed: 5 }
      },
      currentBet: 0,
      lastRaiseSize: 2,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3),
        check('flop', 'BB')
      ],
      villainRange: 'BB 的防守范围较宽，包含大量对子、9×、8×、同花听牌与顺子听牌。'
    }),
    answer: {
      recommended: [{ type: 'bet', min: 5, max: 7 }],
      acceptable: [
        { type: 'check' },
        { type: 'bet', min: 8, max: 12 }
      ],
      note: '默认小到中等尺度下注（约 45–65% 底池）；过牌也可接受，保留免费看牌。'
    },
    explanation: {
      summary:
        '默认下注 5–7 枚（约 45–65% 底池）。15 张补牌配合弃牌权益，适合半诈唬；过牌也合理。',
      hand: '7♥6♥ 在 9♥8♣2♥ 上同时有同花听牌与两头顺听牌；不同补牌共 15 张。',
      range: 'BB 的防守范围很宽，包含许多会弃牌的高牌、弱对子与后门牌；下注可以立即赢下底池，也能做大成牌后的底池。',
      factors: [
        '同花 9 张补牌 + 两头顺 8 张 − 重叠 2 张（5♥、T♥）= 15 张不同补牌。',
        '从翻牌到河牌，15 张补牌的完成概率约 54.1%；这是完成概率，不是“54.1% 必胜”。',
        '下注有弃牌权益；被跟注后仍有强听牌，属于半诈唬而非纯诈唬。',
        '过牌可以免费看转牌，但放弃立即赢下底池的机会。'
      ],
      sizing: '下注 5–7（2.5–3.5BB，约 45–65% 底池）；更大 8–12 也可接受，但风险与波动更高。',
      alternatives: [
        '过牌：可接受，保留底池较小与免费看牌。',
        '下注 8–12：更大尺度施压，但被加注时需要重新评估。'
      ],
      mistakes: ['把 15 张补牌直接当成 15 张“必胜牌”。', '只因为“还没成牌”就永远过牌。'],
      future: '转牌若完成同花/顺子，可继续价值下注；若发出对子 9/8/2，成花仍可能输给葫芦，需要降低强度。'
    },
    hints: [
      '分别数同花与顺子的补牌，再扣掉重叠。',
      '你现在还没成牌，但有多少张牌可以让你成强牌？',
      '有弃牌权益时，强听牌可以半诈唬；默认小到中尺度。'
    ],
    teachingGoal: '用组合听牌理解半诈唬、补牌重叠与下注尺度。',
    source: SOURCE
  },
  {
    id: 'q_postflop_set_raise',
    phase: 3,
    lessonId: 'L6',
    family: 'set',
    tags: ['made-hand', 'value-bet', 'board-texture'],
    difficulty: 3,
    type: 'action',
    title: '击中暗三条，面对持续下注',
    prompt:
      'BTN 开池 2.5BB，BB 跟注。翻牌 7♥ K♠ 2♦，BB 过牌，BTN 下注 2BB。你在 BB 手持 7♣ 7♦。默认动作是？',
    spot: makeSpot({
      street: 'flop',
      board: ['7h', 'Ks', '2d'],
      heroPos: 'BB',
      heroCards: ['7c', '7d'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 9, streetBet: 4 },
        SB: { committed: 1, folded: true },
        BB: { committed: 5 }
      },
      currentBet: 4,
      lastRaiseSize: 4,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3),
        check('flop', 'BB'),
        bet('flop', 'BTN', 4)
      ],
      villainRange:
        'BTN 的宽开池范围在 K-7-2 干燥面上持续下注：K×、口袋对子、A 高与空气；K× 会给你支付。'
    }),
    answer: {
      recommended: [{ type: 'raise', minTo: 12, maxTo: 18 }],
      acceptable: [{ type: 'call' }],
      note: '默认加注获取价值；跟注（慢打）也可接受，但会错过对 K× 的直接支付。'
    },
    explanation: {
      summary: '默认加注到 12–18 枚。暗三条 7 在干燥 K 高面上很强，应从 K× 与超对获取价值。',
      hand: '7♣7♦ + 公共牌 7♥ = 暗三条 7；你几乎只输给 KK（对手很少）与极少数后门顺子/同花。',
      range: 'BTN 的下注范围包含大量 K×；这些牌通常会继续，给你支付。干燥面上对手的听牌很少。',
      factors: [
        '你的牌力远超顶对；加注能做大底池并从 K×/AA 等牌获得价值。',
        '牌面干燥，对手很难有强听牌，慢打让对手免费看转牌的成本较低。',
        '如果对手是极紧的范围，跟注控池也可以；但在宽 BTN 范围下，默认加注更好。'
      ],
      sizing: '加注到 12–18（6–9BB），约为底池的 2/3 到略高于底池。',
      alternatives: [
        '跟注 4：可接受，慢打并让对手继续诈唬；但会错过 K× 的直接支付，且转牌可能让对手范围变强。',
        '弃牌：明显错误，你持有强成牌。'
      ],
      mistakes: ['认为“三条一定慢打”。', '在干燥面用强牌只跟注，错过价值。'],
      future: '转牌若是 A 或 K，对手范围中的顶对/两对更强；你仍持有三条，但需要根据对手加注重新评估。'
    },
    hints: [
      '你击中了什么牌型？它输给哪些很少的组合？',
      '牌面干燥还是湿润？对手范围里有多少会支付的 K×？',
      '默认加注获取价值；跟注慢打也可接受。'
    ],
    teachingGoal: '用强成牌理解价值下注与慢打的条件。',
    source: SOURCE
  },
  {
    id: 'q_postflop_btn_tptk_bet',
    phase: 3,
    lessonId: 'L6',
    family: 'value-bet',
    tags: ['value-bet', 'made-hand', 'board-texture', 'sizing'],
    difficulty: 2,
    type: 'action',
    title: 'BTN 的顶对顶踢脚，过牌到你',
    prompt:
      'BTN 开池 2.5BB，BB 跟注。翻牌 Q♦ 8♠ 3♠，BB 过牌。你在 BTN 手持 A♣ Q♣，当前无人下注。默认动作是？',
    spot: makeSpot({
      street: 'flop',
      board: ['Qd', '8s', '3s'],
      heroPos: 'BTN',
      heroCards: ['Ac', 'Qc'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 5 },
        SB: { committed: 1, folded: true },
        BB: { committed: 5 }
      },
      currentBet: 0,
      lastRaiseSize: 2,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3),
        check('flop', 'BB')
      ],
      villainRange: 'BB 的防守范围较宽，包含 Q×、8×、3×、同花听牌、后门听牌与空气。'
    }),
    answer: {
      recommended: [{ type: 'bet', min: 5, max: 7 }],
      acceptable: [{ type: 'check' }, { type: 'bet', min: 8, max: 11 }],
      note: '默认约半池价值下注；过牌控池也可接受，但会错过从 Q×/8× 获取价值。'
    },
    explanation: {
      summary: '默认下注 5–7（约 45–65% 底池）。顶对顶踢脚在 Q-8-3 两同花面上是明确的价值牌。',
      hand: 'A♣Q♣ 击中顶对 Q，A 踢脚；同时有后门梅花听牌（转牌+河牌都出梅花）。',
      range: 'BB 的防守范围包含较弱的 Q×、8×、口袋对子、同花/顺子听牌与空气；你的顶对顶踢脚领先其中大量组合。',
      factors: [
        '价值：较弱的 Q×（QJ、QT）、8× 与口袋对子可能跟注。',
        '保护：牌面有两张黑桃，让同花听牌跟注需要付费。',
        '尺度：半池左右既能获取价值，也不会把对手范围压得太窄。',
        '过牌控池也可接受，尤其是在对手喜欢过牌-加注时。'
      ],
      sizing: '下注 5–7（2.5–3.5BB，约 45–65% 底池）；8–11 也可接受但更大。',
      alternatives: ['过牌：控池/诱导，但让对手免费看转牌并错过价值。', '更大下注：可接受，但会收缩对手继续范围。'],
      mistakes: ['总是用顶对过牌“怕被反超”。', '在干燥/两同花面用过大尺度把更差的牌赶走。'],
      future: '转牌若是黑桃，牌面变湿；你需要根据对手是否过牌-加注/领先下注重新评估顶对。'
    },
    hints: [
      '你的成牌与踢脚是什么？',
      '对手范围中有哪些更差的牌会跟注？',
      '有两张黑桃的牌面，下注也能让听牌付费；默认约半池。'
    ],
    teachingGoal: '识别价值下注机会并选择合理尺度。',
    source: SOURCE
  },
  {
    id: 'q_choice_board_texture',
    phase: 3,
    lessonId: 'L5',
    family: 'board-texture',
    tags: ['board-texture'],
    difficulty: 2,
    type: 'choice',
    title: '哪块翻牌面最湿润？',
    prompt: '下列翻牌面中，哪一块最湿润、通常最需要谨慎对待？',
    options: [
      { id: 'a', text: 'K♠ 7♦ 2♣' },
      { id: 'b', text: 'J♥ 8♥ 7♣' },
      { id: 'c', text: 'Q♠ Q♦ 4♣' },
      { id: 'd', text: 'A♦ 9♠ 3♥' }
    ],
    correct: ['b'],
    explanation: {
      summary:
        'J♥ 8♥ 7♣ 最湿润：两张红桃带来同花听牌，J-8-7 高度连张带来大量顺子听牌。',
      factors: [
        'K♠7♦2♣ 与 A♦9♠3♥ 是彩虹、较不连张，听牌组合少。',
        'Q♠Q♦4♣ 是成对面，结构不同：三条/葫芦可能性上升，但同花/顺子听牌较少。',
        'J♥8♥7♣ 同时有两同花与连张，双方范围中的强听牌与强成牌都更多。'
      ],
      mistakes: ['只看牌面高低，不看同花与连张。', '把成对面等同于最湿润面。'],
      future: '湿润面不等于“必须过牌”；还要结合双方范围、位置与下注尺度。'
    },
    hints: [
      '同花听牌需要几张同花色？',
      '顺子听牌与牌的连续程度有关。',
      '同时满足“两同花”和“连张”的牌面最湿润。'
    ],
    teachingGoal: '从同花、连张、成对三个维度识别牌面质地。',
    source: SOURCE
  },

  // ---------------------------------------------------------------- 第四阶段
  {
    id: 'q_math_pot_odds',
    phase: 4,
    lessonId: 'L7',
    family: 'pot-odds',
    tags: ['pot-odds', 'equity'],
    difficulty: 2,
    type: 'numeric',
    title: '计算底池赔率的盈亏平衡权益',
    prompt:
      '对手下注前底池为 100。对手下注 50，你需要跟注 50。跟注后底池变为 200。所需盈亏平衡权益是多少？（输入百分数，例如 25）',
    numeric: { answer: 25, tolerance: 0.1, unit: '%', placeholder: '例如 25' },
    explanation: {
      summary: '盈亏平衡权益 = 跟注额 ÷ 跟注后底池 = 50 ÷ 200 = 25%。',
      factors: [
        '底池赔率只描述当前这一注：跟注 50 去赢跟注后的 200。',
        '25% 是“立即盈亏平衡”权益；如果还有后续下注，不能只用它决定整手牌。',
        '这里的 100 是“对手下注前”的底池；不要把对手下注的 50 排除在最终底池之外。'
      ],
      mistakes: ['用 50/150=33.3%：漏掉了自己跟注后的 50。', '把底池赔率 2:1 误写成权益 50%。'],
      future: '若对手下注 100 到 100 的底池，你跟注 100，最终底池 300，盈亏平衡权益 = 100/300 = 33.3%。'
    },
    hints: [
      '先把跟注后的底池算出来。',
      '公式：跟注额 ÷ 跟注后底池。',
      '跟注 50，最终底池 100+50+50=200。'
    ],
    teachingGoal: '准确计算并解释底池赔率。',
    source: MATH_SOURCE
  },
  {
    id: 'q_math_flush_draw_river',
    phase: 4,
    lessonId: 'L7',
    family: 'draw-probability',
    tags: ['outs', 'equity'],
    difficulty: 3,
    type: 'numeric',
    title: '9 张补牌，看到河牌的完成概率',
    prompt:
      '翻牌圈你有同花听牌，假设 9 张补牌都能让你完成同花，且暂不考虑对手反超。从翻牌看到河牌，完成同花的概率是多少？（输入百分数，保留一位小数）',
    numeric: { answer: 35.0, tolerance: 0.5, unit: '%', placeholder: '例如 35.0' },
    explanation: {
      summary: '约 35.0%。计算：1 − (38/47) × (37/46) ≈ 0.3497。',
      factors: [
        '翻牌后未见牌 47 张，9 张补牌；转牌不中的概率是 38/47。',
        '若转牌未中，河牌未见牌剩 46 张，其中仍有 9 张补牌；再乘 37/46。',
        '两个事件都未发生的概率约 65.0%，所以至少出现一张补牌的概率约 35.0%。'
      ],
      mistakes: [
        '把单街概率 9/47≈19.1% 当成两街概率。',
        '把“完成同花”当成“赢得底池”：对手可能有葫芦/更大同花，或河牌让你成花但对手成葫芦。'
      ],
      future: '若只差转牌一张，9 张补牌的概率是 9/46≈19.6%；若你在转牌圈，概率会低得多。'
    },
    hints: [
      '先算两张牌都不中的概率，再用 1 减去它。',
      '翻牌后未见 47 张，转牌后未见 46 张。',
      '公式：1 − (38/47) × (37/46)。'
    ],
    teachingGoal: '区分单街与两街补牌完成概率，并说明它不是胜率。',
    source: MATH_SOURCE
  },
  {
    id: 'q_math_double_count',
    phase: 4,
    lessonId: 'L7',
    family: 'outs-overlap',
    tags: ['outs', 'draw'],
    difficulty: 3,
    type: 'numeric',
    title: '别把重叠补牌算两次',
    prompt:
      '你的底牌是 7♥ 6♥，翻牌 9♥ 8♣ 2♥。同花听牌 9 张补牌，两头顺听牌 8 张补牌，其中 5♥、T♥ 同时属于两种听牌。不同的补牌总数是多少？',
    numeric: { answer: 15, tolerance: 0, unit: '张', placeholder: '输入张数' },
    explanation: {
      summary: '15 张。8 + 9 − 2 = 15；把 5♥、T♥ 重复计算会得到错误的 17 张。',
      factors: [
        '同花补牌：剩余 9 张红桃。',
        '两头顺补牌：5 和 T 各 4 张，共 8 张。',
        '5♥、T♥ 同时完成同花与顺子，只能算一次；所以 9+8−2=15。',
        '这 15 张是“完成顺子/同花”的不同牌；不代表 15 张都能让你赢。'
      ],
      mistakes: ['直接把 9+8 得到 17。', '把重叠的 5♥、T♥ 只算进同花或只算进顺子，另一种算法也会出错。'],
      future: '如果牌面有对子，某些补牌可能让对手成葫芦；此时“补牌数”与“获胜补牌数”要进一步区分。'
    },
    hints: [
      '列出同花补牌与顺子补牌。',
      '哪两张牌同时出现在两份清单里？',
      '用 8+9 再减去重叠的 2 张。'
    ],
    teachingGoal: '避免补牌重复计算，理解补牌与获胜补牌的差异。',
    source: MATH_SOURCE
  },
  {
    id: 'q_postflop_gutshot_fold',
    phase: 4,
    lessonId: 'L8',
    family: 'draw-price',
    tags: ['pot-odds', 'implied-odds', 'draw'],
    difficulty: 3,
    type: 'action',
    title: '卡顺面对半池下注：追还是不追？',
    prompt:
      'BTN 开池 2.5BB，BB 跟注。翻牌 K♥ 7♦ 5♠，BB 过牌，BTN 下注 3BB（约 55% 底池）。你在 BB 手持 9♣ 8♣。默认动作是？',
    spot: makeSpot({
      street: 'flop',
      board: ['Kh', '7d', '5s'],
      heroPos: 'BB',
      heroCards: ['9c', '8c'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 11, streetBet: 6 },
        SB: { committed: 1, folded: true },
        BB: { committed: 5 }
      },
      currentBet: 6,
      lastRaiseSize: 6,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3),
        check('flop', 'BB'),
        bet('flop', 'BTN', 6)
      ],
      villainRange: 'BTN 的宽开池范围在 K-7-5 彩虹面上持续下注，包含 K×、口袋对子、A 高与空气。'
    }),
    answer: {
      recommended: [{ type: 'fold' }],
      acceptable: [],
      note: '卡顺只有 4 张补牌，立即赔率不足；没有明确隐含赔率/读牌时默认弃牌。'
    },
    explanation: {
      summary: '弃牌。你只有 4 张卡顺补牌，跟注 6 去赢 23 的底池赔率不够，且对手范围并非全在支付。',
      hand: '9♣8♣ 在 K♥7♦5♠ 上需要 6 完成 5-6-7-8-9 顺子；只有 4 张 6。',
      range: 'BTN 的持续下注范围包含 K×、强对子与空气；你击中顺子时，并不保证他有一手愿意支付大注的牌。',
      factors: [
        '底池 17，对手下注 6，你跟注后底池 23；盈亏平衡权益 = 6/23 ≈ 26.1%。',
        '4 张补牌在转牌圈的概率约 8.5%，到河牌约 16.5%，低于 26.1%。',
        '即使考虑隐含赔率，你也需要对手在成顺时支付；他范围中的 K× 可能在你成顺时放慢，空气则不会支付。',
        '“可能追到”不等于“值得跟注”；补牌完成概率也不是胜率。'
      ],
      sizing: '弃牌，不再投入。',
      alternatives: [
        '跟注：只有在对手极可能在你成顺时支付、且你有明确读牌/位置优势时才可能改善；默认不作为教学基线。',
        '加注：把 4 张补牌变成半诈唬，但对手范围偏强时会频繁被跟注/反加。'
      ],
      mistakes: ['只看到“有顺子听牌”就跟注。', '把两张牌内 16.5% 的完成概率与单街 8.5% 混淆。'],
      future: '如果转牌发出 6，你成顺；但若牌面同时出现红桃/对子，仍需重新评估对手的更大顺子/葫芦。'
    },
    hints: [
      '你是卡顺还是两头顺？有多少张补牌？',
      '算一下跟注后的底池与所需权益。',
      '4 张补牌到河牌约 16.5%，低于 26.1% 的底池赔率要求。'
    ],
    teachingGoal: '用补牌完成概率与底池赔率判断听牌是否值得跟注。',
    source: SOURCE
  },
  {
    id: 'q_postflop_combo_draw_raise',
    phase: 4,
    lessonId: 'L8',
    family: 'combo-draw',
    tags: ['semi-bluff', 'draw', 'pot-odds'],
    difficulty: 4,
    type: 'action',
    title: '组合听牌面对下注：跟还是加？',
    prompt:
      'BTN 开池 2.5BB，BB 跟注。翻牌 9♥ 8♣ 2♥，BB 过牌，BTN 下注 3BB。你在 BB 手持 7♥ 6♥。默认动作是？',
    spot: makeSpot({
      street: 'flop',
      board: ['9h', '8c', '2h'],
      heroPos: 'BB',
      heroCards: ['7h', '6h'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 11, streetBet: 6 },
        SB: { committed: 1, folded: true },
        BB: { committed: 5 }
      },
      currentBet: 6,
      lastRaiseSize: 6,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3),
        check('flop', 'BB'),
        bet('flop', 'BTN', 6)
      ],
      villainRange: 'BTN 的宽开池范围在 9-8-2 两同花面上持续下注，包含 9×、8×、口袋对子、同花/顺子听牌与空气。'
    }),
    answer: {
      recommended: [{ type: 'raise', minTo: 18, maxTo: 26 }],
      acceptable: [{ type: 'call' }],
      note: '默认加注施压；跟注也可接受，保留较小底池与位置劣势下的实现方式。'
    },
    explanation: {
      summary:
        '默认加注到 18–26（约 9–13BB）。15 张补牌 + 弃牌权益使这手组合听牌适合半诈唬；跟注也可接受。',
      hand: '7♥6♥ 在 9♥8♣2♥ 上有同花听牌与两头顺听牌，共 15 张不同补牌。',
      range: 'BTN 的持续下注范围较宽；加注可以让他弃掉大量 9×/8×/空气，同时你被跟注后仍有强听牌。',
      factors: [
        '15 张补牌从翻牌到河牌的完成概率约 54.1%（不是必胜概率）。',
        '加注把弃牌权益与成牌权益叠加：对手弃牌你立刻赢；被跟注你仍可反超。',
        '跟注保留较小底池、减少波动，但让对手便宜看转牌。',
        '加注尺度需要让对手的弱牌难以继续；18–26 枚约 9–13BB。'
      ],
      sizing: '加注到 18–26（9–13BB）；约 2.3–3.3 倍对手下注。',
      alternatives: [
        '跟注 6：可接受，保留底池与摊牌价值，但放弃弃牌权益。',
        '弃牌：过度保守；你对 BTN 宽范围有足够权益与可玩性。'
      ],
      mistakes: ['把 15 张补牌当成 15 张必胜牌。', '只因为“听牌”就无条件跟注，忽略加注的弃牌权益。'],
      future: '转牌若完成同花/顺子，继续价值下注；若发出 9/8 对子，成花可能输给葫芦，需降低强度。'
    },
    hints: [
      '先数不同补牌：同花 9 + 顺子 8 − 重叠 2。',
      '被跟注后你还有多少张补牌？对手有多少弱牌会弃给加注？',
      '默认用小到中尺度加注半诈唬；跟注也可接受。'
    ],
    teachingGoal: '把补牌、底池赔率与半诈唬结合起来做多街计划。',
    source: SOURCE
  },
  {
    id: 'q_choice_resulting',
    phase: 4,
    lessonId: 'L8',
    family: 'resulting',
    tags: ['resulting', 'review', 'variance'],
    difficulty: 2,
    type: 'choice',
    title: '赢了就代表决策正确吗？',
    prompt:
      '你在河牌用一手较弱的牌跟注，对手亮出诈唬，你赢下底池。下列哪项说法最合理？',
    options: [
      { id: 'a', text: '因为赢了，所以这个跟注一定正确。' },
      { id: 'b', text: '决策好坏应看当时可知的信息、范围假设与赔率，而不是这一手的结果。' },
      { id: 'c', text: '只有输了才说明决策错误。' },
      { id: 'd', text: '只要长期赢钱，单手决策就不需要复盘。' }
    ],
    correct: ['b'],
    explanation: {
      summary: '选 B。单手结果受发牌与波动影响，不能反向证明决策好坏。',
      factors: [
        '决策时你不知道对手的真实牌；只能基于范围、赔率与行动历史判断。',
        '对手这次恰好诈唬，不代表他范围中诈唬比例足够高；也不代表跟注长期为正 EV。',
        '反之，正确跟注后对手亮出强牌，也不代表决策错误。'
      ],
      mistakes: ['用“这手赢了/输了”评价决策。', '忽略长期样本与范围假设。'],
      future: '复盘时先还原“当时可知信息”，再检查范围与赔率；最后才看结果，并把它标注为事后信息。'
    },
    hints: [
      '决策时你能看到对手的底牌吗？',
      '这一手的结果能代表长期频率吗？',
      '把“决策质量”和“结果”分开。'
    ],
    teachingGoal: '识别结果偏差，用过程而不是单手输赢评价决策。',
    source: SOURCE
  },

  {
    id: 'q_turn_gutshot_fold',
    phase: 4,
    lessonId: 'L8',
    family: 'draw-price',
    tags: ['draw', 'pot-odds', 'implied-odds', 'turn-river'],
    difficulty: 3,
    type: 'action',
    title: '转牌只剩一张：卡顺还值得追吗？',
    prompt:
      'BTN 开池 2.5BB，BB 跟注。翻牌 K♥ 7♦ 5♠，BB 过牌，BTN 下注 2BB，BB 跟注。转牌 2♣，BB 过牌，BTN 下注 5BB（约 53% 底池）。你在 BB 手持 9♣ 8♣。默认动作是？',
    spot: makeSpot({
      street: 'turn',
      board: ['Kh', '7d', '5s', '2c'],
      heroPos: 'BB',
      heroCards: ['9c', '8c'],
      overrides: {
        UTG: { folded: true },
        HJ: { folded: true },
        CO: { folded: true },
        BTN: { committed: 19, streetBet: 10 },
        SB: { committed: 1, folded: true },
        BB: { committed: 9 }
      },
      currentBet: 10,
      lastRaiseSize: 10,
      actionLog: [
        ...standardBlinds,
        fold('preflop', 'UTG'),
        fold('preflop', 'HJ'),
        fold('preflop', 'CO'),
        raise('preflop', 'BTN', 5),
        fold('preflop', 'SB'),
        call('preflop', 'BB', 3),
        check('flop', 'BB'),
        bet('flop', 'BTN', 4),
        call('flop', 'BB', 4),
        check('turn', 'BB'),
        bet('turn', 'BTN', 10)
      ],
      villainRange:
        'BTN 在 K-7-5-2 彩虹面连续下注，范围包含 K×、口袋对子、部分诈唬；但转牌后继续下注的牌更偏强。'
    }),
    answer: {
      recommended: [{ type: 'fold' }],
      acceptable: [],
      note: '只剩河牌一张，4 张卡顺补牌的完成概率约 8.7%，低于 25.6% 的底池赔率要求。'
    },
    explanation: {
      summary: '弃牌。转牌圈只剩一张牌，卡顺 4 张补牌约 8.7%，底池赔率要求约 25.6%，默认不值得追。',
      hand: '9♣8♣ 在 K♥7♦5♠2♣ 上仍需 6 完成 5-6-7-8-9 顺子；只有 4 张 6。',
      range: 'BTN 在转牌继续下注的范围比翻牌更偏强；你成顺时，他未必还有一手愿意支付大注的牌。',
      factors: [
        '当前底池 29，对手下注 10，你跟注后底池 39；盈亏平衡权益 = 10/39 ≈ 25.6%。',
        '转牌圈只剩河牌一张；4 张补牌的完成概率是 4/46 ≈ 8.7%。',
        '隐含赔率需要对手在你成顺时支付大量筹码；在没有明确读牌时，不能把“可能追到”当成“值得跟注”。',
        '翻牌圈的小注跟注可以用小成本 + 隐含赔率解释；到了转牌，成本/剩余牌数已经改变。'
      ],
      sizing: '弃牌，不再投入。',
      alternatives: [
        '跟注：只有在对手范围极宽、且你确信成顺后能赢得大量额外筹码时才可重新评估；默认不作为教学基线。',
        '加注：把 4 张补牌变成诈唬，但对手转牌范围偏强，风险更高。'
      ],
      mistakes: ['沿用翻牌圈的“有听牌就跟”。', '把两张牌内的完成概率套到只剩一张的转牌圈。'],
      future: '如果河牌发出 6，你成顺；但若牌面同时成同花/葫芦，仍需重新评估。'
    },
    hints: [
      '现在是翻牌还是转牌？还剩几张公共牌？',
      '4 张补牌在河牌完成的概率是多少？',
      '算底池赔率：29 的底池、10 的下注、10 的跟注。'
    ],
    teachingGoal: '理解街数变化如何改变补牌完成概率与跟注价值。',
    source: SOURCE
  },
  {
    id: 'q_river_texture_choice',
    phase: 4,
    lessonId: 'L8',
    family: 'street-texture',
    tags: ['board-texture', 'range', 'turn-river'],
    difficulty: 3,
    type: 'choice',
    title: '河牌完成同花，顶对还要无脑跟吗？',
    prompt:
      '翻牌 K♥ 9♥ 8♦，你手持 K♣ Q♦（无红桃）在 BB 跟注。转牌 4♣，河牌 3♥。对手在河牌下大注。相比翻牌时，最合理的调整是？',
    options: [
      { id: 'a', text: '顶对仍然很强，无条件跟注。' },
      { id: 'b', text: '降低跟注频率，更重视对手范围中的同花、强两对/三条、下注尺度与底池赔率。' },
      { id: 'c', text: '立即全下诈唬，因为牌面很吓人。' },
      { id: 'd', text: '只要底池赔率超过 20%，就必须跟注。' }
    ],
    correct: ['b'],
    explanation: {
      summary:
        '选 B。河牌发出第三张红桃后，顶对无红桃的相对牌力下降，更接近抓诈唬；要结合对手范围、尺度与赔率。',
      hand: 'K♣Q♦ 在 K♥9♥8♦4♣3♥ 上仍是顶对 K，但牌面已有三张红桃，且你没有红桃。',
      range:
        '对手转牌/河牌继续下注的范围会包含更多同花、强两对/三条；顶对不再是“无条件价值牌”。',
      factors: [
        '河牌改变牌面结构：第三张同花让对手范围中的同花组合变得重要。',
        '你的顶对无红桃，既没有同花阻断，也没有同花听牌；更多是抓诈唬。',
        '底池赔率只是必要条件之一，还要估计对手范围中价值与诈唬的比例。',
        '不能因为“我有一对 K”就忽略牌面、人数与下注尺度。'
      ],
      mistakes: ['把翻牌圈的顶对强度直接套到河牌。', '认为底池赔率达标就必须跟注。'],
      future: '若你手持 A♥K♣（顶对 + 坚果同花阻断），对手的坚果同花组合被减少，河牌决策会不同；这正是牌面与阻断牌的交互。'
    },
    hints: [
      '河牌发出第三张红桃后，谁的范围受益？',
      '你有红桃吗？顶对还是价值牌吗？',
      '顶对可能降级为抓诈唬；需要范围、尺度与赔率一起看。'
    ],
    teachingGoal: '理解河牌如何改变牌面结构、相对牌力与范围判断。',
    source: SOURCE
  },

  // ---------------------------------------------------------------- 第五阶段
  {
    id: 'q_choice_range_advantage',
    phase: 5,
    lessonId: 'L9',
    family: 'range-advantage',
    tags: ['range-advantage', 'range', 'board-texture'],
    difficulty: 3,
    type: 'choice',
    title: 'A 高牌面，谁有范围优势？',
    prompt: 'BTN 开池，BB 跟注。翻牌 A♠ 7♦ 3♣。在简化假设下，谁通常拥有更强/更有利的整体范围？',
    options: [
      { id: 'btn', text: 'BTN（翻前加注者）' },
      { id: 'bb', text: 'BB（翻前跟注者）' },
      { id: 'same', text: '双方完全相同' },
      { id: 'unknown', text: '无法判断' }
    ],
    correct: ['btn'],
    explanation: {
      summary: '通常 BTN 有范围优势：它的开池范围包含更多 AA、AK、AQ 与强 A×，A 高牌面更契合其范围。',
      factors: [
        'BTN 翻前加注范围里有更多强 A× 与高对子；BB 的跟注范围更宽、更 capped（上限较低）。',
        'A-7-3 彩虹面减少了 BB 的强听牌，BTN 的强牌更容易保持优势。',
        '范围优势不等于每手牌都领先；具体组合仍要看双方实际范围与行动线。'
      ],
      mistakes: ['把范围优势理解为“BTN 每手牌都更强”。', '忽略翻前行动对范围结构的塑造。'],
      future: '不同牌面会改变范围优势：低连张面可能更有利于 BB 的防守范围；需要逐牌面分析。'
    },
    hints: [
      '谁的范围里有更多 AA、AK、AQ？',
      'BB 的跟注范围通常比 BTN 的开池范围更宽还是更窄？',
      'A 高牌面更契合谁的范围？'
    ],
    teachingGoal: '理解范围优势来自翻前行动与牌面的交互，而不是单手牌。',
    source: SOURCE
  },
  {
    id: 'q_math_combos_ak',
    phase: 5,
    lessonId: 'L9',
    family: 'combos',
    tags: ['combos', 'blockers', 'range'],
    difficulty: 3,
    type: 'numeric',
    title: 'AK 一共有多少种组合？',
    prompt: '不考虑阻断牌，AK（包括同花与非同花）一共有多少种两张牌的底牌组合？',
    numeric: { answer: 16, tolerance: 0, unit: '种', placeholder: '输入组合数' },
    explanation: {
      summary: '16 种：4 种同花 AK + 12 种非同花 AK。',
      factors: [
        '同花：4 种花色，每种一张 A 与一张同花色的 K，共 4 种。',
        '非同花：A 有 4 种花色，K 有 4 种花色，排除同花色 4 种，共 4×4−4=12 种。',
        '未计阻断时，对子有 6 种组合，同花有 4 种，非同花有 12 种。'
      ],
      mistakes: ['把 AK 只算成 4 种同花。', '把同花与非同花重复计算。'],
      future: '若 A♠ 已被阻断，AK 只剩 3×4=12 种；若 A♠、K♠ 都被阻断，只剩 9 种。'
    },
    hints: [
      '同花 AK 有几种花色？',
      '非同花 AK 有多少种花色组合？',
      '4 种同花 + 12 种非同花。'
    ],
    teachingGoal: '掌握组合数基础，为阻断牌与范围分析做准备。',
    source: MATH_SOURCE
  },
  {
    id: 'q_choice_blocker',
    phase: 5,
    lessonId: 'L9',
    family: 'blockers',
    tags: ['blockers', 'combos', 'range'],
    difficulty: 4,
    type: 'choice',
    title: '手中的 A♠ 会怎样影响对手的坚果同花？',
    prompt:
      '公共牌已经有两张黑桃，你手里有 A♠。相比你手里没有 A♠，这通常会怎样影响对手范围中 A♠X♠ 坚果同花的组合数？',
    options: [
      { id: 'decrease', text: '减少' },
      { id: 'increase', text: '增加' },
      { id: 'same', text: '完全不变' },
      { id: 'riveronly', text: '只在河牌才影响' }
    ],
    correct: ['decrease'],
    explanation: {
      summary: '减少。A♠ 在你手里，对手就不可能再持有包含 A♠ 的 A♠X♠ 组合。',
      factors: [
        '阻断牌通过“拿走一张牌”减少对手范围中的特定组合数。',
        'A♠ 是坚果同花的关键牌；对手的 A♠X♠ 组合会因它被阻断而减少。',
        '阻断牌的影响取决于对手范围；不能仅凭“有阻断牌”就断定必须诈唬。',
        '阻断牌也会影响对手的跟注/弃牌范围，需要结合行动线。'
      ],
      mistakes: ['认为阻断牌越多，对手就一定没有强牌。', '忽略对手范围中非坚果同花的组合。'],
      future: '在河牌诈唬时，持有坚果阻断牌通常比持有无关牌更适合作为诈唬候选；但仍需评估对手范围与弃牌倾向。'
    },
    hints: [
      'A♠ 在你手里，对手还能拿到哪些 A♠X♠ 组合？',
      '阻断牌减少的是“组合数”，不是所有同花。',
      '坚果同花组合会减少，但对手仍可能有其他同花。'
    ],
    teachingGoal: '理解阻断牌对组合数与范围的影响。',
    source: SOURCE
  },
  {
    id: 'q_choice_exploit_station',
    phase: 5,
    lessonId: 'L10',
    family: 'exploit',
    tags: ['exploit', 'value-bet'],
    difficulty: 3,
    type: 'choice',
    title: '面对跟注站，怎么调整？',
    prompt: '对手是“跟注站”：很少弃牌、很少诈唬。基于这个稳定倾向，最合理的调整是？',
    options: [
      { id: 'a', text: '增加纯诈唬频率。' },
      { id: 'b', text: '用更薄的价值下注，减少纯诈唬。' },
      { id: 'c', text: '只玩 AA。' },
      { id: 'd', text: '无条件用三倍底池下注。' }
    ],
    correct: ['b'],
    explanation: {
      summary: '选 B。对手很少弃牌，诈唬的弃牌权益很低；应更多用成牌做价值下注，并减少纯诈唬。',
      factors: [
        '诈唬依赖对手弃牌；跟注站不弃牌，纯诈唬的收益下降。',
        '价值下注可以从他过宽的跟注范围中获得更多支付，包括较薄的成牌。',
        '尺度仍需结合牌面与对手范围，不是无条件三倍底池。',
        '这是针对性调整，不是 GTO 默认；对手倾向变化后要重新评估。'
      ],
      mistakes: ['看到“跟注站”就疯狂诈唬。', '把针对性调整当成固定规则，忽略牌面与范围。'],
      future: '若对手开始过度弃牌，你的诈唬频率才应上升；观察与调整是双向的。'
    },
    hints: [
      '诈唬靠什么赚钱？',
      '对手很少弃牌时，哪种下注更容易被支付？',
      '减少诈唬，增加价值下注。'
    ],
    teachingGoal: '根据对手稳定倾向做出有依据的针对性调整。',
    source: SOURCE
  },
  {
    id: 'q_choice_mixed_strategy',
    phase: 5,
    lessonId: 'L10',
    family: 'mixed-strategy',
    tags: ['gto', 'mixed-strategy'],
    difficulty: 4,
    type: 'choice',
    title: '为什么同一手牌会有“混合策略”？',
    prompt: '为什么同一个起手牌/同一类牌在相同局面下，策略表可能给出不同动作（混合策略）？',
    options: [
      { id: 'a', text: '因为随机犯错，所以随便选。' },
      { id: 'b', text: '为了让对手无法通过固定倾向剥削，并使边缘牌在不同动作间保持无差异。' },
      { id: 'c', text: '因为发牌是随机的，所以不需要理由。' },
      { id: 'd', text: '只有锦标赛才需要混合策略。' }
    ],
    correct: ['b'],
    explanation: {
      summary: '选 B。混合策略用频率让对手无法通过固定倾向获利，并让边缘牌在多个动作间保持接近无差异。',
      factors: [
        '如果你的同一类牌永远只做一个动作，对手可以针对性剥削。',
        '混合策略不是随机乱选；它背后有频率与范围结构。',
        '实战中不必背精确频率；理解“为什么混合”比机械模仿更重要。',
        '针对特定对手时，可以偏离混合策略以获取更高收益。'
      ],
      mistakes: ['把混合策略等同于随机失误。', '认为只有 GTO 才需要频率，针对性打法不需要。'],
      future: '学习高阶时，先理解范围与频率的逻辑，再逐步接触求解器输出；不要一开始就背复杂频率。'
    },
    hints: [
      '如果对手知道你的固定习惯，会怎样利用？',
      '混合策略是为了让对手无法确定你的牌。',
      '关键词：不可剥削、频率、无差异。'
    ],
    teachingGoal: '理解 GTO 混合策略的直觉，而不是背诵频率。',
    source: SOURCE
  },
  {
    id: 'q_choice_sample_size',
    phase: 5,
    lessonId: 'L10',
    family: 'sample-size',
    tags: ['variance', 'sample-size', 'review'],
    difficulty: 3,
    type: 'choice',
    title: '200 手牌赢了 15BB，能说明什么？',
    prompt: '你打了 200 手牌，赢了 15 个大盲。下列哪种解读最合理？',
    options: [
      { id: 'a', text: '已经证明你是长期赢家。' },
      { id: 'b', text: '样本太小，不能据此判断长期赢率；应关注决策质量、复盘和更多样本。' },
      { id: 'c', text: '说明你的策略一定正确。' },
      { id: 'd', text: '说明下风期已经结束。' }
    ],
    correct: ['b'],
    explanation: {
      summary: '选 B。200 手牌远不足以判断长期赢率；短期输赢受波动主导。',
      factors: [
        '德州扑克的波动很大，几百手牌的输赢可能只是随机结果。',
        '长期赢率需要更大样本；同时要区分“结果”与“决策质量”。',
        '复盘应关注可重复的决策错误、知识标签与修正，而不是短期筹码曲线。',
        '本产品不会用虚拟筹码收益来认定“进阶高手”。'
      ],
      mistakes: ['用 200 手牌的成绩给自己贴“长期赢家/输家”标签。', '只看筹码曲线，不复盘决策。'],
      future: '用更大样本、同类型局与明确的决策指标评估进步；把波动与水平分开。'
    },
    hints: [
      '200 手牌能覆盖多少种发牌与局面？',
      '短期结果主要由什么驱动？',
      '关注决策质量与样本量，而不是单手/短期输赢。'
    ],
    teachingGoal: '建立正确的样本量、波动与复盘观念。',
    source: SOURCE
  },
  {
    id: 'q_choice_range_inference',
    phase: 5,
    lessonId: 'L9',
    family: 'range-inference',
    tags: ['range', 'position', 'hand-selection'],
    difficulty: 4,
    type: 'choice',
    title: '从行动推断范围：谁最窄？',
    prompt: 'UTG 开池，CO 跟注，BTN 弃牌，BB 跟注。翻牌前谁的范围通常最窄、最强？',
    options: [
      { id: 'utg', text: 'UTG（翻前开池者）' },
      { id: 'co', text: 'CO（冷跟者）' },
      { id: 'bb', text: 'BB（大盲防守者）' },
      { id: 'same', text: '三人完全相同' }
    ],
    correct: ['utg'],
    explanation: {
      summary: '通常 UTG 的范围最窄、最强；早期位置开池需要更强的手牌，跟注者/大盲防守范围更宽。',
      factors: [
        'UTG 身后还有五名玩家，位置最差，因此开池范围通常最紧。',
        'CO 冷跟的范围可以包含较多中等同花/连张与对子，但强度上限通常低于 UTG 的开池范围。',
        'BB 已投入盲注，防守范围最宽，包含大量边缘牌。',
        '这是简化假设；具体范围取决于玩家倾向与筹码深度。'
      ],
      mistakes: ['认为跟注者的范围一定比开池者强。', '忽略位置与已投入盲注对范围的影响。'],
      future: '翻牌后要根据行动进一步收窄范围；范围推断是动态的，不是翻前一张表。'
    },
    hints: [
      '谁在翻前位置最差、身后未行动玩家最多？',
      'BB 为什么能用更宽范围防守？',
      '开池者通常比跟注者/防守者更窄。'
    ],
    teachingGoal: '用位置与前序行动推断范围宽窄。',
    source: SOURCE
  }
];

export const QUESTION_MAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id) {
  return QUESTION_MAP[id] || null;
}

export function questionsByPhase(phase) {
  return QUESTIONS.filter((q) => q.phase === phase);
}

export function questionsForLesson(lessonId) {
  return QUESTIONS.filter((q) => q.lessonId === lessonId);
}
