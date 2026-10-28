/**
 * 课程内容：5 个阶段、10 节课。
 * 每节课只讲一个核心主题，先概念与示范，再进入独立练习。
 */

export const PHASES = [
  {
    id: 1,
    title: '认识规则',
    subtitle: '先能看懂一手牌',
    description: '牌桌、行动顺序、牌型、最佳五张与合法操作。完成后再进入翻前决策。',
    lessons: ['L1', 'L2']
  },
  {
    id: 2,
    title: '翻牌前决策',
    subtitle: '位置与起手牌',
    description: '理解对子、同花、连张与位置，用带有条件的简化范围做开池、跟注与再加注。',
    lessons: ['L3', 'L4']
  },
  {
    id: 3,
    title: '翻牌后基础',
    subtitle: '牌力是相对的',
    description: '成牌、听牌、牌面质地、价值下注、半诈唬与多人底池。避免“顶对一定跟注”。',
    lessons: ['L5', 'L6']
  },
  {
    id: 4,
    title: '概率与多街计划',
    subtitle: '可能追到 ≠ 值得追',
    description: '补牌、完成概率、底池赔率、权益、隐含赔率与多街计划。',
    lessons: ['L7', 'L8']
  },
  {
    id: 5,
    title: '高阶思考',
    subtitle: '范围、阻断牌与长期进步',
    description: '范围优势、组合数、阻断牌、下注尺度、针对性调整、波动与复盘。',
    lessons: ['L9', 'L10']
  }
];

export const LESSONS = [
  {
    id: 'L1',
    phase: 1,
    title: '牌桌、位置与行动',
    subtitle: '先搞清楚“现在轮到谁、能做什么”',
    minutes: 12,
    tags: ['rules-flow', 'legal-action', 'position'],
    prerequisites: [],
    demoQuestionId: 'q_legal_bb_facing_raise',
    practiceQuestionIds: ['q_choice_preflop_order', 'q_legal_flop_no_bet'],
    terms: ['position', 'btn', 'sb', 'bb', 'utg', 'hj', 'co', 'blind', 'pot', 'preflop', 'flop', 'turn', 'river', 'check', 'call', 'bet', 'raise', 'all-in'],
    sections: [
      {
        type: 'p',
        text: '本产品默认环境是：52 张牌、无限注德州扑克、6 人桌、每人 100BB 起始有效筹码、无前注、无抽水、虚拟筹码。所有策略示例都只在这个环境下讨论；换到锦标赛、短筹码或有前注的局面，需要重新评估。'
      },
      {
        type: 'h',
        text: '六个位置与行动顺序'
      },
      {
        type: 'p',
        text: '{{btn}} 每手牌顺时针轮转。6 人桌的位置顺序是 BTN（庄位）→ SB（小盲）→ BB（大盲）→ UTG（枪口位）→ HJ（劫位）→ CO（关位）。翻牌前的行动从 UTG 开始，翻牌后从 SB 开始。'
      },
      {
        type: 'list',
        items: [
          '{{sb}} 强制投入 0.5BB，{{bb}} 强制投入 1BB；这两个投入构成初始{{pot}}。',
          '翻牌前顺序：UTG → HJ → CO → BTN → SB → BB。大盲在所有人跟注后仍有“最后选项”。',
          '翻牌后顺序：SB → BB → UTG → HJ → CO → BTN。庄位翻牌后最后行动，是位置优势的来源。',
          '{{position}} 不是“坐在哪里”这么简单：越晚行动，你看到的信息越多。'
        ]
      },
      {
        type: 'table',
        headers: ['街道', '公共牌', '从谁开始行动'],
        rows: [
          ['{{preflop}}', '0 张', 'UTG（大盲左手第一位）'],
          ['{{flop}}', '3 张', 'SB（庄位左手第一位）'],
          ['{{turn}}', '4 张', 'SB'],
          ['{{river}}', '5 张', 'SB']
        ]
      },
      {
        type: 'h',
        text: '六种基本操作'
      },
      {
        type: 'table',
        headers: ['操作', '含义', '何时合法'],
        rows: [
          ['弃牌 Fold', '放弃本手牌', '轮到你时总是合法'],
          ['过牌 Check', '不投入，把行动交给下一位', '当前无人下注时'],
          ['跟注 Call', '补到与当前最高下注相同', '面对下注且你有足够筹码（不足则全下跟注）'],
          ['下注 Bet', '本轮尚无人下注时主动投入', '无人下注，且至少达到最小下注（通常 1BB）'],
          ['加注 Raise', '提高本轮最高投入额', '已有下注，且你的筹码允许'],
          ['全下 All-in', '投入全部后手', '可以作为跟注、下注或加注']
        ]
      },
      {
        type: 'callout',
        tone: 'info',
        title: '“加注到”与“额外投入”',
        text: '界面的“加注到”指你本轮最终的总投入，不是额外增加的金额。例如对手下注到 5BB，你加注到 15BB，你的额外投入是 10BB。做筹码计算时先统一口径，能避免大量错误。'
      },
      {
        type: 'callout',
        tone: 'warn',
        title: '最小加注与不足额全下',
        text: '一次完整加注的增量，至少要等于上一次下注/加注的增量。大盲 1BB、UTG 加到 2.5BB（增量 1.5BB）时，下一次最小加注到 4BB。若有人用不足一次完整加注的筹码全下，已经行动过的玩家通常不能再次加注，只能跟注或弃牌；尚未行动的玩家仍可加注。产品会在按钮和提示中反映这一点。'
      },
      {
        type: 'p',
        text: '底池里已经投入的筹码属于最终赢家，不属于当前下注者。弃牌后，你已经投入的筹码不会退回，所以“我已经投了这么多”不是继续跟注的理由。'
      }
    ],
    takeaway: '先看位置与行动顺序，再确认当前最高下注，最后只从合法操作中选择。'
  },
  {
    id: 'L2',
    phase: 1,
    title: '牌型、最佳五张与平局',
    subtitle: '为什么两张 A 不一定赢',
    minutes: 15,
    tags: ['hand-ranking', 'best-five'],
    prerequisites: ['L1'],
    demoQuestionId: 'q_best_five_royal',
    practiceQuestionIds: ['q_compare_kicker', 'q_compare_wheel', 'q_compare_tie'],
    terms: ['hand-ranking', 'kicker', 'tie', 'best-five', 'wheel', 'showdown'],
    sections: [
      {
        type: 'p',
        text: '摊牌时，每位玩家从两张底牌和五张公共牌中选出最强的五张。可以使用 0、1 或 2 张底牌，不需要“必须用两张”。比较时先比牌型等级，再比关键点数与{{kicker}}，最后仍相同才是{{tie}}。'
      },
      {
        type: 'table',
        headers: ['等级', '牌型', '例子', '关键比较点'],
        rows: [
          ['1（最高）', '同花顺', 'A♥K♥Q♥J♥10♥', '顺子高点'],
          ['2', '四条', '9♠9♥9♦9♣A♠', '四条点数，再比踢脚'],
          ['3', '葫芦', 'K♠K♥K♦7♣7♦', '三条点数，再比对子'],
          ['4', '同花', 'A♠J♠8♠5♠2♠', '逐张比点数'],
          ['5', '顺子', '9♥8♣7♦6♠5♥', '顺子高点'],
          ['6', '三条', 'Q♠Q♥Q♦A♣9♦', '三条点数，再比踢脚'],
          ['7', '两对', 'A♠A♦9♣9♥K♦', '大对、小对、踢脚'],
          ['8', '一对', 'J♠J♦A♣8♥3♦', '对子点数，再比三张踢脚'],
          ['9（最低）', '高牌', 'A♠Q♦9♣6♥3♠', '逐张比点数']
        ]
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'A2345 是顺子',
        text: 'A 可以当作 1，组成 A-2-3-4-5，这是最小的顺子（5 高）。注意 10-J-Q-K-A 是 A 高顺子，比 5 高大；A 不能同时当作 1 和 14 去“绕回去”组成 Q-K-A-2-3。'
      },
      {
        type: 'cards',
        title: '同一牌型，踢脚决定胜负',
        groups: [
          {
            label: '公共牌 A♣ 9♦ 7♠ 4♥ 2♣',
            cards: ['Ac', '9d', '7s', '4h', '2c'],
            note: '玩家 A：A♥ A♦ → 三条 A，踢脚 9、7；玩家 B：A♠ K♣ → 三条 A，踢脚 K、9。B 赢。'
          },
          {
            label: '公共牌 A♠ K♦ Q♣ J♥ 10♠',
            cards: ['As', 'Kd', 'Qc', 'Jh', 'Ts'],
            note: '双方都能使用公共牌组成 A 高顺子；底牌再大也不能塞进最佳五张，平局。'
          }
        ]
      },
      {
        type: 'p',
        text: '“最佳五张”是解题的核心动作。看到七张牌时，不要只盯着自己的两张底牌，也不要因为公共牌很大就忽略它。先分别写出双方的最佳五张，再比较。'
      }
    ],
    takeaway: '先写最佳五张，再按牌型等级与踢脚逐项比较；公共牌可以完全打满。'
  },
  {
    id: 'L3',
    phase: 2,
    title: '起手牌与位置',
    subtitle: '同一手牌，换个位置就换了个价值',
    minutes: 16,
    tags: ['hand-selection', 'position', 'preflop-open'],
    prerequisites: ['L1', 'L2'],
    demoQuestionId: 'q_preflop_aa_utg',
    practiceQuestionIds: ['q_preflop_ato_utg', 'q_preflop_ato_btn'],
    terms: ['position', 'utg', 'hj', 'co', 'btn', 'sb', 'bb', 'range', 'preflop'],
    sections: [
      {
        type: 'p',
        text: '起手牌不是简单的“好/坏”两档。对子、同花、非同花、连张与高牌的组合，决定了它翻牌后能击中什么、被压制时有多难察觉，以及你能不能实现自己的{{range}}权益。'
      },
      {
        type: 'list',
        title: '四种常见起手牌特征',
        items: [
          '对子：翻牌击中{{set}}的概率约 1/8，但击中后通常很强；小对子依赖隐含赔率。',
          '同花牌：多出同花潜力，通常比同点数非同花更有可玩性。',
          '连张：容易组成顺子，但需要公共牌配合；中间连张比边缘连张更好。',
          '高牌：A/K/Q 有压制价值，但踢脚问题会让“击中却输更多”的风险上升。'
        ]
      },
      {
        type: 'h',
        text: '位置改变范围宽度'
      },
      {
        type: 'p',
        text: '越早行动，身后未行动的玩家越多，你的开池范围就应越紧；越晚行动，信息越多、翻牌后越有位置优势，范围可以越宽。下面是“新手简化开池基线”，不是求解器输出，也不保证对每个对手都最优。'
      },
      {
        type: 'table',
        headers: ['位置', '简化开池范围（示例）', '思路'],
        rows: [
          ['UTG', '77+、AJs+、KQs、AKo', '身后五人，优先强牌'],
          ['HJ', '55+、A9s+、KTs+、QJs、AJo+、KQo', '稍宽，但仍尊重前位'],
          ['CO', '22+、A2s+、K9s+、QTs+、JTs、ATo+、KJo+', '接近按钮，可主动'],
          ['BTN', '22+、A2s+、K7s+、Q8s+、J8s+、T8s+、98s、A7o+、K9o+、Q9o+、J9o+、T9o', '位置最好，最宽'],
          ['SB', '对子、强同花大牌、部分连张；面对开池要收紧', '翻后先行动，位置差'],
          ['BB', '面对小加注可宽防；面对大加注收紧', '已投入盲注，赔率更好']
        ]
      },
      {
        type: 'callout',
        tone: 'warn',
        title: '简化 ≠ 求解器',
        text: '这些范围是为了让新手建立“位置越晚越宽、越早越紧”的直觉。真实的 GTO 或针对特定对手的范围会更复杂，会混合不同动作。不要把这些表当成不可偏离的绝对规则，也不要用“范围表说可以”来为明显的错误找理由。'
      },
      {
        type: 'p',
        text: '判断一手牌是否值得开池，可以问三个问题：它在翻牌后能击中什么？击中后是否容易被更大的牌压制？如果被跟注/加注，我能不能执行后续计划？位置越好，第三个问题的答案通常越乐观。'
      }
    ],
    takeaway: '先看位置与身后未行动人数，再看牌力与可玩性；同一手牌在不同位置可以有不同决策。'
  },
  {
    id: 'L4',
    phase: 2,
    title: '翻牌前：开池、面对加注与再加注',
    subtitle: '用带条件的范围，而不是背一手牌',
    minutes: 18,
    tags: ['preflop-open', 'facing-raise', 'three-bet', 'bb-defense'],
    prerequisites: ['L3'],
    demoQuestionId: 'q_preflop_72o_btn',
    practiceQuestionIds: ['q_preflop_kqs_sb_3bet', 'q_preflop_55_bb'],
    terms: ['preflop', 'raise', 'three-bet', 'bb-defense', 'implied-odds', 'range', 'pot-odds'],
    sections: [
      {
        type: 'p',
        text: '翻牌前的决策有三种常见情境：前面都弃牌（未入池）、面对一个加注、面对再加注。它们的目标不同：开池是争取主动与偷盲；跟注是控制投入并保留可玩性；再加注是施压、获取价值或拒绝对手的便宜实现。'
      },
      {
        type: 'table',
        headers: ['情境', '默认思路', '注意'],
        rows: [
          ['未入池、你在 BTN', '用较宽范围开池到 2.5–3BB', '不要因为“只是 ATo”就错过位置优势'],
          ['未入池、你在 UTG', '只玩更强范围', '身后五人，边缘 A× 容易被压制'],
          ['面对一个加注、你在 BTN', '强牌再加注；可玩牌跟注；垃圾弃牌', '先算跟注额与底池赔率，再看可玩性'],
          ['面对一个加注、你在 SB/BB', 'SB 更紧；BB 可用赔率防守更宽', '翻后位置差，避免用弱牌做大底池'],
          ['面对再加注', '范围收紧；不要用边缘牌硬扛', '100BB 下，KQs 等牌面对 4bet 通常不适合无条件继续']
        ]
      },
      {
        type: 'h',
        text: '再加注（3bet）的尺度'
      },
      {
        type: 'p',
        text: '面对 2.5BB 开池，默认再加注到约 7.5–9BB；面对更早位置的开池，通常要比面对按钮位更紧。再加注不是“只有 AA/KK 才能做”：有阻断牌、可玩性和位置条件的牌也可以作为半诈唬/价值混合。'
      },
      {
        type: 'callout',
        tone: 'info',
        title: '大盲防守与隐含赔率',
        text: 'BB 已经投入 1BB，面对 2.5BB 开池只需再跟 1.5BB，{{pot-odds}}更好。小对子等牌还可以依靠{{implied-odds}}：翻牌击中{{set}}后，从对手的强牌赢到后续筹码。但有效筹码越浅、抽水越高、对手越不会支付，隐含赔率就越差。'
      },
      {
        type: 'p',
        text: '不要把“位置好”当成无视牌力的理由。72o 在按钮位仍然是 72o；位置的价值建立在牌力接近、可玩性足够的前提上。反过来，ATo 在 UTG 是边缘牌，在 BTN 前面都弃牌时就可以主动开池——位置改变了同一手牌的价值。'
      }
    ],
    takeaway: '开池看位置与牌力；面对加注看赔率与可玩性；面对再加注收紧范围。所有结论都有适用条件。'
  },
  {
    id: 'L5',
    phase: 3,
    title: '翻牌后：成牌、听牌与牌面',
    subtitle: '牌力不是固定的，它在牌面上变化',
    minutes: 18,
    tags: ['made-hand', 'draw', 'board-texture', 'multiway'],
    prerequisites: ['L4'],
    demoQuestionId: 'q_postflop_kq_dry',
    practiceQuestionIds: ['q_postflop_kq_wet_multiway', 'q_choice_board_texture'],
    terms: ['made-hand', 'draw', 'top-pair', 'overpair', 'set', 'two-pair', 'trips', 'board-texture', 'multiway', 'flush-draw', 'straight-draw', 'oesd', 'gutshot', 'range'],
    sections: [
      {
        type: 'p',
        text: '翻牌后先做两件事：认清自己的{{made-hand}}或{{draw}}，再读懂{{board-texture}}。同一手顶对，在 K-8-3 彩虹面和 K♥9♥8♥ 单花面上，价值完全不同。绝对牌力是“我是什么牌型”，相对牌力是“我在这个牌面、这个人数、这个行动线里有多强”。'
      },
      {
        type: 'cards',
        title: '同一手牌，不同牌面',
        groups: [
          {
            label: '干燥面：K♦ 8♠ 3♥',
            cards: ['Kd', '8s', '3h'],
            note: '你持 K♣Q♦：顶对 Q 踢脚。听牌少，顶对通常较强。'
          },
          {
            label: '单花面：K♥ 9♥ 8♥',
            cards: ['Kh', '9h', '8h'],
            note: '你持 K♣Q♦：仍是顶对，但没有红桃；对手范围有大量同花/顺子/强听牌。'
          },
          {
            label: '成对面：Q♠ Q♦ 4♣',
            cards: ['Qs', 'Qd', '4c'],
            note: '三条/葫芦组合变多；你的两对可能被更大的葫芦压制。'
          }
        ]
      },
      {
        type: 'list',
        title: '牌面质地的三个维度',
        items: [
          '同花可能：三张同花色（单花面）> 两张（两同花）> 彩虹面。',
          '连张程度：9-8-7、J-T-9 这类牌面会产生大量{{oesd}}和{{gutshot}}。',
          '是否成对：公共牌成对会提高葫芦/四条的可能，也会改变谁有坚果优势。'
        ]
      },
      {
        type: 'callout',
        tone: 'warn',
        title: '顶对不是固定强度',
        text: '顶对在干燥单挑面可以很强，但在单花面、多人底池、面对下注+跟注时可能只是抓诈唬的牌。判断时要同时看：踢脚、牌面、在局人数、对手行动与筹码深度。不要背“顶对一定跟注”或“顶对一定加注”。'
      },
      {
        type: 'p',
        text: '听牌也要分清“完成”与“获胜”。同花听牌完成同花，不代表一定赢：对手可能有更大的同花、葫芦，或者河牌让对手反超。补牌数与底池赔率只是起点，范围与后续街道才是完整决策。'
      }
    ],
    takeaway: '先认牌型，再看牌面与人数；顶对的强度取决于条件，而不是名称。'
  },
  {
    id: 'L6',
    phase: 3,
    title: '价值、半诈唬与多人底池',
    subtitle: '下注要有目的，尺度要有理由',
    minutes: 18,
    tags: ['value-bet', 'semi-bluff', 'pot-control', 'multiway', 'sizing'],
    prerequisites: ['L5'],
    demoQuestionId: 'q_postflop_set_raise',
    practiceQuestionIds: ['q_postflop_combo_draw_bet', 'q_postflop_btn_tptk_bet'],
    terms: ['value-bet', 'semi-bluff', 'pot-control', 'multiway', 'cbet', 'sizing', 'equity', 'draw'],
    sections: [
      {
        type: 'p',
        text: '下注的目的通常有三类：{{value-bet}}（让更差的牌跟注）、{{semi-bluff}}（用听牌施压，同时保留反超机会）、保护/拒绝权益（让对手的听牌付费或弃牌）。没有任何目的的“习惯性下注”很容易成为漏洞。'
      },
      {
        type: 'table',
        headers: ['目的', '典型牌', '尺度倾向', '常见错误'],
        rows: [
          ['价值', '顶对好踢脚、两对、三条', '中小尺度，让更差的牌能跟', '尺度过大，只被更强牌跟注'],
          ['半诈唬', '同花/顺子听牌、组合听牌', '中小到中尺度，保留弃牌权益', '把补牌当成必胜牌，忽略被加注'],
          ['保护', '容易被反超的成牌', '根据牌面与对手范围调整', '在干燥面过度保护，赶走更差的牌'],
          ['控池', '中等强度成牌', '过牌或小尺度', '把中等牌做成大底池后无法弃牌']
        ]
      },
      {
        type: 'h',
        text: '单挑与多人底池'
      },
      {
        type: 'p',
        text: '{{multiway}}中，诈唬需要面对更多对手，成功率下降；成牌的门槛上升。顶对弱踢脚在三人底池面对下注+跟注，通常比单挑弱得多。你不能把单挑的“顶对跟注”直接搬到多人底池。'
      },
      {
        type: 'p',
        text: '{{pot-control}}不是“永远过牌”。当你有一手不错但经不起大底池的牌（例如中等顶对、无强听牌的边缘成牌），在湿润面或多人底池选择较小尺度/过牌，可以避免转牌、河牌陷入难局。但强牌不应因为“怕输”而放弃价值。'
      },
      {
        type: 'callout',
        tone: 'info',
        title: '下注尺度表达什么',
        text: '小尺度通常保留对手更宽的范围，适合范围优势、干燥面或薄价值；大尺度更极化，适合强价值或强诈唬。尺度不是装饰，它会影响对手用什么牌继续。做选择时问：我希望对手用哪些牌跟注？这个尺度能做到吗？'
      }
    ],
    takeaway: '每次下注都问“为什么”：价值、半诈唬、保护还是控池；再根据牌面与人数选尺度。'
  },
  {
    id: 'L7',
    phase: 4,
    title: '补牌、底池赔率与权益',
    subtitle: '把“有可能”变成可计算的条件',
    minutes: 20,
    tags: ['outs', 'pot-odds', 'equity', 'implied-odds', 'ev'],
    prerequisites: ['L6'],
    demoQuestionId: 'q_math_pot_odds',
    practiceQuestionIds: ['q_math_flush_draw_river', 'q_math_double_count'],
    terms: ['outs', 'pot-odds', 'equity', 'implied-odds', 'reverse-implied-odds', 'ev', 'draw', 'flush-draw', 'straight-draw'],
    sections: [
      {
        type: 'p',
        text: '{{outs}}是能让你的牌力提升到目标牌型的未见牌。计算时要注意三件事：不要重复计算重叠补牌；补牌完成概率不是最终获胜概率；对手范围会影响权益。'
      },
      {
        type: 'table',
        headers: ['听牌', '不同补牌数', '转牌圈完成概率', '翻牌到河牌完成概率'],
        rows: [
          ['同花听牌', '9', '≈19.6%', '≈35.0%'],
          ['两头顺听牌', '8', '≈17.4%', '≈31.5%'],
          ['卡顺听牌', '4', '≈8.7%', '≈16.5%'],
          ['同花 + 两头顺（重叠 2 张）', '15', '≈32.6%', '≈54.1%']
        ]
      },
      {
        type: 'callout',
        tone: 'info',
        title: '底池赔率的精确定义',
        text: '对手下注前底池 100，对手下注 50，你跟注 50：跟注后底池 = 100 + 50 + 50 = 200；盈亏平衡权益 = 50 ÷ 200 = 25%。注意“对手下注前”的口径，以及自己跟注的钱也要算进最终底池。'
      },
      {
        type: 'p',
        text: '{{equity}}是在给定对手范围与发牌假设下，你摊牌时赢得底池的份额。它与“补牌完成概率”不同：补牌完成可能仍然输，权益还要看对手范围。没有可靠范围假设时，不要用一个精确权益数字冒充“对当前对手的胜率”。'
      },
      {
        type: 'list',
        title: '三类概念不要混用',
        items: [
          '补牌完成概率：9 张同花补牌在翻牌到河牌约 35.0%。',
          '摊牌权益：对某个对手范围，你摊牌赢的份额；需要范围假设，通常用枚举/模拟估算。',
          '最终赢得底池的概率：还要考虑对手弃牌、后续下注与诈唬，不能只靠摊牌权益。'
        ]
      },
      {
        type: 'p',
        text: '{{implied-odds}}把未来街道可能赢到的筹码算进来；{{reverse-implied-odds}}则提醒你：完成听牌后仍可能输更多。{{ev}}是长期平均结果，单手输赢不能证明 EV。若使用模拟估算权益，必须展示模拟次数、对手范围与误差，并明确它是估算。'
      }
    ],
    takeaway: '先数不同补牌，再算完成概率与底池赔率；权益必须带对手范围假设。'
  },
  {
    id: 'L8',
    phase: 4,
    title: '多街计划与结果偏差',
    subtitle: '“可能追到”不等于“值得跟注”',
    minutes: 18,
    tags: ['pot-odds', 'implied-odds', 'resulting', 'review'],
    prerequisites: ['L7'],
    demoQuestionId: 'q_postflop_gutshot_fold',
    practiceQuestionIds: [
      'q_postflop_combo_draw_raise',
      'q_choice_resulting',
      'q_turn_gutshot_fold',
      'q_river_texture_choice'
    ],
    terms: ['pot-odds', 'implied-odds', 'reverse-implied-odds', 'equity', 'resulting', 'variance', 'review'],
    sections: [
      {
        type: 'p',
        text: '翻牌的决定不是孤立的。你要问：如果转牌击中，我准备怎么打？如果转牌没击中，对手下注，我是否还继续？如果河牌让我成牌但牌面也变强，我还能不能价值下注？没有后续计划，很容易在一手牌里连续做“看起来便宜”的跟注。'
      },
      {
        type: 'h',
        text: '为什么卡顺常常不值得追'
      },
      {
        type: 'p',
        text: '卡顺只有 4 张补牌。翻牌到河牌的完成概率约 16.5%，而面对半池下注，底池赔率往往要求 25% 左右。即使把隐含赔率算进来，你也需要对手在你成顺时支付足够多的筹码；如果对手范围里大量是空气或会放慢的牌，隐含赔率并没有想象中高。'
      },
      {
        type: 'callout',
        tone: 'warn',
        title: '结果偏差（Resulting）',
        text: '“这次追到了”不代表追的决策正确；“这次没追到”也不代表弃牌错误。判断决策只能用当时可知的信息、对手范围假设与赔率，而不是后来发出的牌。复盘时要把“当时可知”和“后来揭晓”分开。'
      },
      {
        type: 'p',
        text: '多街计划还包括：转牌/河牌如何改变双方范围。比如转牌完成同花，你的顶对可能从“价值牌”变成“抓诈唬牌”；河牌出现 A 或 K，会让对手范围中的强牌组合增加。牌力是动态的，计划也要动态。'
      },
      {
        type: 'list',
        title: '一个可执行的复盘流程',
        items: [
          '还原决策时的信息：位置、筹码、底池、待跟注、行动历史、公共牌。',
          '写出你当时认为的对手范围与关键假设。',
          '检查规则与数学：合法操作、补牌、底池赔率、有效筹码。',
          '比较备选动作：推荐动作、可接受动作、明显错误。',
          '记录知识标签与下次复习时间；不要用单手输赢给自己打分。'
        ]
      }
    ],
    takeaway: '在跟注前先想好后续两条街；复盘时只看当时可知信息，不看结果反推。'
  },
  {
    id: 'L9',
    phase: 5,
    title: '范围、阻断牌与组合数',
    subtitle: '从“他有什么牌”升级到“他可能有哪些组合”',
    minutes: 20,
    tags: ['range', 'range-advantage', 'blockers', 'combos'],
    prerequisites: ['L8'],
    demoQuestionId: 'q_choice_range_advantage',
    practiceQuestionIds: ['q_math_combos_ak', 'q_choice_blocker', 'q_choice_range_inference'],
    terms: ['range', 'range-advantage', 'nut-advantage', 'blocker', 'combo', 'equity', 'board-texture'],
    sections: [
      {
        type: 'p',
        text: '高手不会把对手放在“某一手牌”上，而是放在一个{{range}}里，并根据位置、翻前行动、翻后下注逐步收窄。范围不是一张固定表，而是一个随行动变化的组合集合。'
      },
      {
        type: 'h',
        text: '组合数：范围分析的基本单位'
      },
      {
        type: 'table',
        headers: ['类别', '未计阻断时的组合数', '说明'],
        rows: [
          ['口袋对子（如 QQ）', '6', '4 种花色选 2 张'],
          ['同花（如 AKs）', '4', '每种花色一组'],
          ['非同花（如 AKo）', '12', '4×4 减去 4 组同花'],
          ['AK（同花 + 非同花）', '16', '4 + 12'],
          ['两张指定牌（如 A♠K♠）', '1', '唯一组合']
        ]
      },
      {
        type: 'p',
        text: '{{blocker}}通过“拿走一张牌”减少对手范围中的组合数。例如你手里有 A♠，对手的 A♠X♠ 坚果同花组合就会减少；你手里有 A♠，对手 AA 的组合也从 6 降到 3。但阻断牌的效果取决于对手范围，不能仅凭“我有阻断牌”就断定必须诈唬。'
      },
      {
        type: 'h',
        text: '范围优势与坚果优势'
      },
      {
        type: 'p',
        text: '{{range-advantage}}指在某个牌面上，一方整体范围中强牌更多；{{nut-advantage}}指一方拥有更多当前最强牌型（坚果）的组合。它们会影响下注频率与尺度：范围优势大的一方可以更频繁地小尺度施压；坚果优势大的一方可以使用更大的极化尺度。'
      },
      {
        type: 'callout',
        tone: 'warn',
        title: '不要伪造求解器精度',
        text: '范围优势与下注频率需要求解器或大量可靠模拟支持。本课程只教“方向与假设”，不提供精确 GTO 频率、EV 损失或“唯一最优”。当你看到具体频率时，要问：对手范围是什么？筹码深度？抽水/前注？没有这些条件，数字不可直接套用。'
      }
    ],
    takeaway: '用组合数思考范围，用阻断牌修正组合数；范围优势是方向性判断，不是精确频率。'
  },
  {
    id: 'L10',
    phase: 5,
    title: '对手调整、波动与复盘',
    subtitle: '长期进步，不靠几节课或短期筹码',
    minutes: 20,
    tags: ['exploit', 'gto', 'mixed-strategy', 'variance', 'sample-size', 'review'],
    prerequisites: ['L9'],
    demoQuestionId: 'q_choice_sample_size',
    practiceQuestionIds: ['q_choice_exploit_station', 'q_choice_mixed_strategy'],
    terms: ['gto', 'mixed-strategy', 'exploit', 'variance', 'sample-size', 'resulting', 'review', 'ev'],
    sections: [
      {
        type: 'p',
        text: '{{gto}}是一个“不可被稳定剥削”的策略框架，不是唯一正确，也不保证对特定对手收益最大。{{mixed-strategy}}用频率让对手无法通过固定倾向获利；实战中理解逻辑比背频率重要。'
      },
      {
        type: 'table',
        headers: ['对手倾向', '有依据的调整', '风险'],
        rows: [
          ['很少弃牌（跟注站）', '增加薄价值下注，减少纯诈唬', '对手突然收紧时，价值范围可能过宽'],
          ['过度弃牌', '增加诈唬/小尺度施压', '被跟注后你的弱牌很难继续'],
          ['很少诈唬', '面对大注更愿意弃牌，减少抓诈唬', '对手调整后可能反利用'],
          ['过度激进', '用强牌跟注/慢打，减少边缘诈唬', '波动更大，需要情绪管理']
        ]
      },
      {
        type: 'p',
        text: '{{variance}}意味着短期结果会围绕长期期望剧烈起伏。{{sample-size}}不足时，不能用赢率或筹码曲线判断水平。200 手牌赢 15BB 不能证明你是长期赢家；同样，短期输钱也不代表策略一定错。'
      },
      {
        type: 'h',
        text: '情绪管理与复盘纪律'
      },
      {
        type: 'list',
        items: [
          '输掉一个大底池后，不要用下一手“追回来”；先暂停、记录当时的决策与情绪，再决定是否继续。',
          '赢了一个大底池后也不要放松标准；结果好不代表动作好，继续按范围与赔率检查。',
          '为 session 设定时间/损失上限，避免疲劳、上头或为了回本而扩大级别。',
          '复盘时先写“当时我知道什么”，再写“结果是什么”；把情绪反应与证据分开。'
        ]
      },
      {
        type: 'h',
        text: '如何判断自己真的在进步'
      },
      {
        type: 'list',
        items: [
          '在未见过的题目/局面中，第一次决策的达标率是否提高。',
          '提示依赖是否下降：同一类题是否还需要第三级提示。',
          '重复错误是否减少：同一知识标签的错题是否在延迟复习中改正。',
          '能否解释“为什么”，而不只是记住“答案是什么”。',
          '模拟牌局中，是否能按规则完成、正确结算，并在复盘里区分当时可知信息与结果。'
        ]
      },
      {
        type: 'callout',
        tone: 'good',
        title: '能力边界与诚实',
        text: '本产品的策略建议来自简化教学基线，不是求解器；它可以帮助新手建立正确框架，但不能替代针对具体对手、具体筹码深度与具体规则的高阶训练。完成课程不等于“高手”，更不承诺盈利。'
      }
    ],
    takeaway: '用未见题表现、提示依赖、重复错误与延迟复习衡量进步；不要用短期输赢定义自己。'
  }
];

export const LESSON_MAP = Object.fromEntries(LESSONS.map((lesson) => [lesson.id, lesson]));

export const PHASE_MAP = Object.fromEntries(PHASES.map((phase) => [phase.id, phase]));

export function getLesson(id) {
  return LESSON_MAP[id] || null;
}

export function lessonsForPhase(phaseId) {
  return LESSONS.filter((lesson) => lesson.phase === phaseId);
}
