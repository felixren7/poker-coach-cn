/**
 * 术语表。正文用 {{term-id}} 标记，首次出现时可点击查看中文解释、英文与例子。
 */
export const GLOSSARY = [
  {
    id: 'position',
    term: '位置',
    en: 'Position',
    definition: '你相对于庄位、在行动顺序中的先后。越靠后行动，越能先看到前面玩家的选择。',
    example: 'BTN 在翻牌后最后行动，能看到所有对手的选择后再决定。'
  },
  {
    id: 'btn',
    term: '庄位',
    en: 'Button (BTN)',
    definition: '每手牌顺时针轮转的“按钮位”。翻牌后通常最后行动，是桌上最有利的位置。',
    example: '6 人桌中，庄位左手第一位是小盲，第二位是大盲。'
  },
  {
    id: 'sb',
    term: '小盲',
    en: 'Small Blind (SB)',
    definition: '庄位左手第一位，翻牌前被迫投入半个大盲，翻牌后最先行动。',
    example: '大盲 2BB 时，小盲投入 1BB。'
  },
  {
    id: 'bb',
    term: '大盲',
    en: 'Big Blind (BB)',
    definition: '庄位左手第二位，被迫投入一个完整大盲；翻牌前最后行动，翻牌后第二个行动。',
    example: '本产品默认 100BB 有效筹码，大盲为 2 枚虚拟筹码。'
  },
  {
    id: 'utg',
    term: '枪口位',
    en: 'Under the Gun (UTG)',
    definition: '6 人桌翻牌前第一个行动的座位，在大盲左手第一位。位置越早，身后未行动的玩家越多。',
    example: 'UTG 开池时，后面还有 HJ、CO、BTN、SB、BB 五名玩家。'
  },
  {
    id: 'hj',
    term: '劫位',
    en: 'Hijack (HJ)',
    definition: 'UTG 之后、CO 之前的位置，属于中前位。',
    example: '行动顺序：UTG → HJ → CO → BTN → SB → BB。'
  },
  {
    id: 'co',
    term: '关位',
    en: 'Cutoff (CO)',
    definition: '庄位右手边的位置，翻牌后倒数第二个行动，适合比前位更宽地开池。',
    example: 'CO 的起手牌范围通常比 UTG 宽，但比 BTN 窄。'
  },
  {
    id: 'blind',
    term: '盲注',
    en: 'Blinds',
    definition: '小盲和大盲在发牌前被迫投入的筹码，用来制造初始底池并确定翻牌前的最低跟注额。',
    example: '小盲 1、大盲 2 时，翻牌前最低加注到 4。'
  },
  {
    id: 'ante',
    term: '前注',
    en: 'Ante',
    definition: '每手牌所有玩家额外投入的强制筹码。它会让底池更大、策略更激进。本产品默认无前注。',
    example: '有前注时，偷盲和跟注的赔率都会变化，不能直接套用无前注策略。'
  },
  {
    id: 'pot',
    term: '底池',
    en: 'Pot',
    definition: '本手牌所有玩家已经投入的筹码总和。底池属于最终赢家，而不是当前下注者。',
    example: '对手下注后底池为 150，你跟注 50，跟注后底池变为 200。'
  },
  {
    id: 'effective-stack',
    term: '有效筹码',
    en: 'Effective Stack',
    definition: '对抗双方中较短的那一方后手筹码；它决定这手牌最多能赢/输多少，也影响隐含赔率。',
    example: '你有 100BB，对手有 40BB，本手牌的有效筹码是 40BB。'
  },
  {
    id: 'preflop',
    term: '翻牌前',
    en: 'Preflop',
    definition: '发完两张底牌、尚未发公共牌的下注轮。',
    example: 'UTG 加注到 2.5BB，BB 跟注，进入翻牌。'
  },
  {
    id: 'flop',
    term: '翻牌',
    en: 'Flop',
    definition: '第一次发出三张公共牌的下注轮。',
    example: '翻牌 K♦ 8♠ 3♥，BB 过牌，BTN 下注。'
  },
  {
    id: 'turn',
    term: '转牌',
    en: 'Turn',
    definition: '第四张公共牌及对应的下注轮。',
    example: '转牌让同花听牌完成，牌力结构会明显变化。'
  },
  {
    id: 'river',
    term: '河牌',
    en: 'River',
    definition: '第五张、也是最后一张公共牌及最后一个下注轮。之后若仍未弃牌则摊牌。',
    example: '河牌后没有更多公共牌，听牌要么完成，要么失败。'
  },
  {
    id: 'showdown',
    term: '摊牌',
    en: 'Showdown',
    definition: '最后一轮下注结束后，仍在局玩家亮牌，用最佳五张比较大小。',
    example: '两人都跟注河牌下注，摊牌比较牌型。'
  },
  {
    id: 'action',
    term: '行动',
    en: 'Action',
    definition: '轮到你时选择弃牌、过牌、跟注、下注、加注或全下。',
    example: '面对下注时，你不能过牌，只能弃牌、跟注或加注。'
  },
  {
    id: 'fold',
    term: '弃牌',
    en: 'Fold',
    definition: '放弃本手牌已投入的筹码，不再参与争夺底池。',
    example: '面对大额下注且几乎没有胜算时，弃牌可以止损。'
  },
  {
    id: 'check',
    term: '过牌',
    en: 'Check',
    definition: '无人下注时，把行动权交给下一位玩家，不投入筹码。面对下注时不能过牌。',
    example: '翻牌 BB 先行动且无人下注，可以选择过牌。'
  },
  {
    id: 'call',
    term: '跟注',
    en: 'Call',
    definition: '投入与当前最高下注相同的筹码，继续留在底池中。',
    example: '底池 100，对手下注 50，你跟注 50。'
  },
  {
    id: 'bet',
    term: '下注',
    en: 'Bet',
    definition: '本轮尚无人下注时，主动投入筹码。最小下注通常是一个大盲。',
    example: '翻牌无人下注，你下注 6BB。'
  },
  {
    id: 'raise',
    term: '加注',
    en: 'Raise',
    definition: '在已有下注的基础上提高本轮最高投入额。界面中的“加到多少”指你本轮总投入，不是额外增加的金额。',
    example: '对手下注到 5BB，你加注到 15BB，额外投入 10BB。'
  },
  {
    id: 'all-in',
    term: '全下',
    en: 'All-in',
    definition: '把当前所有后手筹码投入底池。可以是不足额的跟注、下注或加注。',
    example: '你有 20BB，面对 25BB 下注，全下跟注后进入边池规则。'
  },
  {
    id: 'min-raise',
    term: '最小加注',
    en: 'Minimum Raise',
    definition: '一次完整加注至少要等于上一次下注/加注的增量。不足额全下可能不重新开放已行动玩家的加注权。',
    example: '大盲 2BB，UTG 加注到 5BB（增量 3BB），下一次最小加注到 8BB。'
  },
  {
    id: 'hand-ranking',
    term: '牌型',
    en: 'Hand Ranking',
    definition: '从高到低：同花顺、四条、葫芦、同花、顺子、三条、两对、一对、高牌。',
    example: '葫芦可以打败同花，但打不过四条。'
  },
  {
    id: 'kicker',
    term: '踢脚',
    en: 'Kicker',
    definition: '当主要牌型相同时，用来比较大小的剩余牌。踢脚越大越有利。',
    example: '公共牌 A-9-7-4-2，A♥A♦ 与 A♠K♣ 都是三条 A，但后者的 K 踢脚更大。'
  },
  {
    id: 'tie',
    term: '平局',
    en: 'Tie',
    definition: '双方最佳五张完全等值时平分底池；花色不参与大小比较。',
    example: '公共牌本身构成 A 高顺子，双方都无法改进时平局。'
  },
  {
    id: 'best-five',
    term: '最佳五张',
    en: 'Best Five',
    definition: '从两张底牌和五张公共牌中选出最大的五张。可以使用 0、1 或 2 张底牌。',
    example: '公共牌已经构成顺子，而底牌没有帮助时，最佳五张可以完全不使用底牌。'
  },
  {
    id: 'wheel',
    term: 'A2345 顺子',
    en: 'Wheel',
    definition: 'A 可以当作 1，组成 A-2-3-4-5，这是最小的顺子（5 高）。',
    example: 'A♦ 3♣ + 公共牌 5♦ 4♣ 2♥ 构成 5 高顺子。'
  },
  {
    id: 'range',
    term: '范围',
    en: 'Range',
    definition: '一名玩家在某个行动线中可能持有的所有牌组合，而不是某一手确定的牌。',
    example: 'BTN 开池范围可能包含 22+、A2s+、K9s+、QTs+、JTs、ATo+ 等。'
  },
  {
    id: 'equity',
    term: '权益',
    en: 'Equity',
    definition: '在给定对手范围和发牌假设下，你摊牌时赢得底池的份额（平局按一半计）。它不是“补牌完成概率”。',
    example: '翻牌同花听牌对一手随机牌约有 35% 权益，但对更强范围可能更低。'
  },
  {
    id: 'outs',
    term: '补牌',
    en: 'Outs',
    definition: '能让你的牌力提升到目标牌型的未见牌。计算时要避免重复计算重叠补牌，而且补牌不等于必胜。',
    example: '同花听牌通常有 9 张补牌；同花顺双听时两张牌可能同时属于两种听牌。'
  },
  {
    id: 'pot-odds',
    term: '底池赔率',
    en: 'Pot Odds',
    definition: '跟注额 ÷ 跟注后底池，得到立即盈亏平衡所需的权益。它只描述当前这一注，不包含后续下注。',
    example: '对手下注前底池 100，下注 50，你跟注 50；跟注后底池 200，盈亏平衡权益 = 50/200 = 25%。'
  },
  {
    id: 'implied-odds',
    term: '隐含赔率',
    en: 'Implied Odds',
    definition: '把未来街道还能赢到的筹码算进来后的赔率。它依赖对手范围、牌面、后手深度和你能否在成牌时获得支付。',
    example: '翻牌卡顺的立即赔率不够，但若对手会在成顺时支付大量筹码，隐含赔率可能改善。'
  },
  {
    id: 'reverse-implied-odds',
    term: '反向隐含赔率',
    en: 'Reverse Implied Odds',
    definition: '你完成听牌后仍可能输给更大牌，或被迫支付更多筹码的风险。',
    example: '在单花面用非坚果同花听牌跟注，成花后仍可能输给更大的同花。'
  },
  {
    id: 'ev',
    term: '期望值',
    en: 'Expected Value (EV)',
    definition: '同一决策在长期重复无数次后的平均结果。正 EV 不代表单手一定赢。',
    example: '一个 +2BB EV 的跟注，可能在这一次输掉底池。'
  },
  {
    id: 'board-texture',
    term: '牌面质地',
    en: 'Board Texture',
    definition: '公共牌的同花可能、连张程度、是否成对、高低结构等特征，它影响双方范围与下注尺度。',
    example: 'J♥ 8♥ 7♣ 是湿润、连张且两同花的牌面；K♠ 7♦ 2♣ 相对干燥。'
  },
  {
    id: 'made-hand',
    term: '成牌',
    en: 'Made Hand',
    definition: '当前已经组成的牌型，例如一对、两对、三条、顺子。',
    example: '翻牌 K-8-3，你手持 KQ，当前成牌是顶对。'
  },
  {
    id: 'draw',
    term: '听牌',
    en: 'Draw',
    definition: '尚未成牌，但后续公共牌可以让你完成强牌。听牌需要结合补牌数与赔率评估。',
    example: '四张同花等第五张同花是听牌。'
  },
  {
    id: 'top-pair',
    term: '顶对',
    en: 'Top Pair',
    definition: '用底牌中的一张与公共牌最大点数配对。踢脚大小和牌面质地决定它有多强。',
    example: '公共牌 K-8-3，KQ 是顶对 Q 踢脚。'
  },
  {
    id: 'overpair',
    term: '超对',
    en: 'Overpair',
    definition: '口袋对子大于公共牌所有点数，例如 99 在 8-5-2 的牌面上。',
    example: 'TT 在 9-7-3 牌面是超对。'
  },
  {
    id: 'set',
    term: '暗三条',
    en: 'Set',
    definition: '用口袋对子与公共牌中的一张同点数牌组成三条，通常非常隐蔽。',
    example: '手持 77，翻牌 7-K-2，你击中暗三条。'
  },
  {
    id: 'two-pair',
    term: '两对',
    en: 'Two Pair',
    definition: '两组不同点数的对子，比较时先比大对，再比小对，最后比踢脚。',
    example: 'KQ 在 K-9-Q 牌面构成 K 和 Q 两对。'
  },
  {
    id: 'trips',
    term: '明三条',
    en: 'Trips',
    definition: '公共牌中有一对，你手里有一张同点数牌，组成三条。它与暗三条的隐蔽性和组合数不同。',
    example: '公共牌 K-K-7，你手持 KQ，组成明三条 K。'
  },
  {
    id: 'flush-draw',
    term: '同花听牌',
    en: 'Flush Draw',
    definition: '已有四张同花色牌，等第五张同花。通常有 9 张补牌，但成花不一定赢。',
    example: '手持 A♥5♥，翻牌 K♥9♥3♣ 是同花听牌。'
  },
  {
    id: 'straight-draw',
    term: '顺子听牌',
    en: 'Straight Draw',
    definition: '已有四张连续或接近连续的牌，等一张完成顺子。',
    example: '手持 76，翻牌 9-8-2，听 5 或 T 完成顺子。'
  },
  {
    id: 'oesd',
    term: '两头顺听牌',
    en: 'Open-ended Straight Draw (OESD)',
    definition: '两端都能完成顺子的听牌，通常有 8 张补牌。',
    example: '手持 76，翻牌 9-8-2，5 和 T 都能完成顺子。'
  },
  {
    id: 'gutshot',
    term: '卡顺听牌',
    en: 'Gutshot',
    definition: '只缺中间一张牌完成顺子，通常有 4 张补牌。',
    example: '手持 98，翻牌 7-5-K，只有 6 能完成 5-6-7-8-9。'
  },
  {
    id: 'cbet',
    term: '持续下注',
    en: 'Continuation Bet (C-bet)',
    definition: '翻牌前加注者在翻牌后继续下注。它的目的可能是价值、保护或诈唬，取决于牌面与范围。',
    example: 'BTN 翻前加注，翻牌 K-8-3 继续下注 1/3 底池。'
  },
  {
    id: 'semi-bluff',
    term: '半诈唬',
    en: 'Semi-bluff',
    definition: '用听牌下注或加注：对手弃牌你立刻赢；被跟注时你仍有补牌可以反超。',
    example: '同花 + 两头顺听牌时加注，既有弃牌权益又有成牌机会。'
  },
  {
    id: 'value-bet',
    term: '价值下注',
    en: 'Value Bet',
    definition: '预期被更差的牌跟注而下注，目的是从对手的较弱范围中获取筹码。',
    example: '顶对顶踢脚在干燥牌面下注，让较差的 K 或 Q 跟注。'
  },
  {
    id: 'pot-control',
    term: '控池',
    en: 'Pot Control',
    definition: '用中等强度牌选择较小尺度或过牌，避免把底池做得过大、让自己在后续街道难以决策。',
    example: '中等顶对在湿润多人底池过牌，控制底池大小。'
  },
  {
    id: 'multiway',
    term: '多人底池',
    en: 'Multiway Pot',
    definition: '翻牌后仍有三人或以上参与。相比单挑，成牌需要更强，诈唬更容易被跟注。',
    example: '三人底池中，顶对弱踢脚面对下注和跟注通常应更谨慎。'
  },
  {
    id: 'range-advantage',
    term: '范围优势',
    en: 'Range Advantage',
    definition: '在某个牌面上，一方整体范围中强牌/坚果组合更多，因而可以更频繁地施压。',
    example: 'BTN 开池、BB 跟注，A-7-3 牌面通常对 BTN 的范围更有利。'
  },
  {
    id: 'nut-advantage',
    term: '坚果优势',
    en: 'Nut Advantage',
    definition: '一方范围中包含更多当前最强牌型（坚果）的组合。坚果优势大时，超池下注等激进尺度更常见。',
    example: '某牌面上只有一方能持有最多的最强同花组合，这就是坚果优势。'
  },
  {
    id: 'blocker',
    term: '阻断牌',
    en: 'Blocker',
    definition: '你手中的牌减少了对手持有某些组合的数量。阻断牌会影响诈唬与跟注的价值，但效果取决于对手范围。',
    example: '你手里有 A♠，对手持有 A♠X♠ 坚果同花的组合数就减少了。'
  },
  {
    id: 'combo',
    term: '组合数',
    en: 'Combos',
    definition: '某个起手牌类别包含的具体两张牌组合数量。未计阻断时：对子 6 种、同花 4 种、非同花 12 种。',
    example: 'AK 共有 16 种组合（4 同花 + 12 非同花）；A♠ 被阻断后只剩 12 种。'
  },
  {
    id: 'gto',
    term: 'GTO',
    en: 'Game Theory Optimal',
    definition: '一种以不可被剥削为目标的策略框架。它不等于“唯一正确”，也不保证在特定对手身上收益最大。',
    example: 'GTO 会混合下注与过牌；针对跟注站时，减少诈唬可能更赚钱。'
  },
  {
    id: 'mixed-strategy',
    term: '混合策略',
    en: 'Mixed Strategy',
    definition: '同一类牌在相同局面按一定频率选择不同动作，目的是让对手无法通过固定倾向剥削，并保持边缘牌无差异。',
    example: '同一手边缘牌有时下注、有时过牌，而不是每次都做同一个动作。'
  },
  {
    id: 'exploit',
    term: '针对性调整',
    en: 'Exploit',
    definition: '根据对手的稳定倾向偏离默认策略，例如对跟注站减少诈唬、增加薄价值下注。',
    example: '对手很少弃牌时，减少纯诈唬，更多用成牌下注。'
  },
  {
    id: 'variance',
    term: '波动',
    en: 'Variance',
    definition: '短期结果围绕长期期望的随机起伏。少量牌局的输赢不能证明策略好坏。',
    example: '连续输掉几个 70% 权益的底池，不代表决策错误。'
  },
  {
    id: 'sample-size',
    term: '样本量',
    en: 'Sample Size',
    definition: '用于判断长期表现的手牌数量。德州扑克波动很大，几百手通常不足以证明长期赢率。',
    example: '200 手牌赢 15BB 不能证明你是长期赢家。'
  },
  {
    id: 'resulting',
    term: '结果偏差',
    en: 'Resulting',
    definition: '用最终输赢反推决策好坏。正确做法是看决策时可知的信息、范围假设与赔率。',
    example: '跟注后对手亮出诈唬并赢下底池，不代表这个跟注在当时一定正确。'
  },
  {
    id: 'review',
    term: '复盘',
    en: 'Review',
    definition: '在牌局结束后，基于当时可知的信息检查决策过程，区分好决策与好结果。',
    example: '重做关键决策，记录知识标签与下次复习时间。'
  },
  {
    id: 'spr',
    term: '筹码底池比',
    en: 'Stack-to-Pot Ratio (SPR)',
    definition: '有效后手筹码 ÷ 当前底池。SPR 越小，成牌后越容易全下；SPR 越大，隐含赔率与后续决策越重要。',
    example: '有效后手 90BB、底池 10BB 时，SPR 为 9。'
  }
];

export const GLOSSARY_MAP = Object.fromEntries(GLOSSARY.map((entry) => [entry.id, entry]));

export function getTerm(id) {
  return GLOSSARY_MAP[id] || null;
}
