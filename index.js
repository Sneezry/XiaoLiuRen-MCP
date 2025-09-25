#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import calendar from "js-calendar-converter";

class XiaoLiuRenMCP {
  constructor() {
    this.server = new Server(
      {
        name: "xiaoliuren-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "analyze_xiaoliuren",
            description: "分析指定日期时辰的小六壬指导意见",
            inputSchema: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  description: "日期，格式：YYYY-MM-DD",
                },
                time: {
                  type: "string",
                  description: "时辰，格式：HH:MM 或者传统时辰名称（如：子时、丑时等）",
                },
                calendar_type: {
                  type: "string",
                  enum: ["solar", "lunar"],
                  description: "日历类型：solar=阳历，lunar=农历",
                  default: "solar"
                }
              },
              required: ["date", "time", "calendar_type"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "analyze_xiaoliuren") {
        const { date, time, calendar_type } = request.params.arguments;

        try {
          const result = await this.analyzeXiaoLiuRen(date, time, calendar_type);
          return {
            content: [
              {
                type: "text",
                text: result,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `错误：${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }

      throw new Error(`未知工具: ${request.params.name}`);
    });
  }

  async analyzeXiaoLiuRen(date, time, calendar_type) {
    try {
      // 解析日期
      const dateMatch = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!dateMatch) {
        throw new Error('日期格式错误，请使用 YYYY-MM-DD 格式');
      }

      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);

      let lunarDate;

      if (calendar_type === 'solar') {
        // 阳历转农历 - 使用专业库
        const result = calendar.solar2lunar(year, month, day);
        lunarDate = {
          year: result.lYear,
          month: result.lMonth,
          day: result.lDay,
          isLeap: result.isLeap,
          yearGanZhi: result.gzYear,
          monthGanZhi: result.gzMonth,
          dayGanZhi: result.gzDay,
          lunarMonthName: result.IMonthCn,
          lunarDayName: result.IDayCn,
          term: result.Term || ''
        };
      } else {
        // 如果是农历，先转为阳历再转回农历获得完整信息
        const solarResult = calendar.lunar2solar(year, month, day);
        const lunarResult = calendar.solar2lunar(solarResult.cYear, solarResult.cMonth, solarResult.cDay);
        lunarDate = {
          year: year,
          month: month,
          day: day,
          isLeap: false,
          yearGanZhi: lunarResult.gzYear,
          monthGanZhi: lunarResult.gzMonth,
          dayGanZhi: lunarResult.gzDay,
          lunarMonthName: lunarResult.IMonthCn,
          lunarDayName: lunarResult.IDayCn,
          term: lunarResult.Term || ''
        };
      }

      // 解析时辰 - 简化版本
      const timeHour = parseInt(time.split(':')[0]);
      const shichen = this.getShichen(timeHour);

      // 执行小六壬推算
      const xiaoLiuRenResult = this.calculateXiaoLiuRen(lunarDate.month, lunarDate.day, timeHour);

      // 构建分析结果
      const calendarTypeText = calendar_type === "lunar" ? "农历" : "阳历";

      return `小六壬占卜结果：

🗓️ 输入信息：
- 原始日期：${date}（${calendarTypeText}）
- 时辰：${time} (${shichen})

📅 农历信息：
- 农历日期：${lunarDate.year}年${lunarDate.lunarMonthName}${lunarDate.lunarDayName}${lunarDate.isLeap ? '(闰月)' : ''}
- 年干支：${lunarDate.yearGanZhi}
- 月干支：${lunarDate.monthGanZhi} 
- 日干支：${lunarDate.dayGanZhi}
- 时辰：${shichen}
${lunarDate.term ? `- 节气：${lunarDate.term}` : ''}

🧮 小六壬推算过程：
- ${xiaoLiuRenResult.calculation.月将}
- ${xiaoLiuRenResult.calculation.日期}  
- ${xiaoLiuRenResult.calculation.时辰}

🔮 占卜结果：【${xiaoLiuRenResult.finalResult.name}】
- 五行属性：${xiaoLiuRenResult.finalResult.element}
- 吉凶性质：${xiaoLiuRenResult.finalResult.nature}
- 基本含义：${xiaoLiuRenResult.finalResult.meaning}
- 详细解释：${xiaoLiuRenResult.finalResult.details}

💡 建议指导：
${this.getAdvice(xiaoLiuRenResult.finalResult.name)}`;

    } catch (error) {
      throw new Error(`日期时间处理错误：${error.message}`);
    }
  }

  // 根据六神结果给出建议 - 更详细的传统解读
  getAdvice(godName) {
    const advice = {
      '大安': `✅ 当前状态稳定平和，适合保持现状。
• 如问行动类问题：不宜轻举妄动，静待时机
• 如问成功类问题：事情能成，但需要时间和耐心
• 感情方面：关系稳定但需注意不要过于平淡
• 财运方面：收支稳定，适合稳健投资
• 总体建议：宜守不宜攻，以静制动`,

      '留连': `⚠️ 事情发展缓慢，多有反复和阻碍。
• 当前状况：事情未定，仍有变数，需要耐心等待
• 隐性因素：可能存在不为人知的情况或内幕
• 时间特性：如果是晚上占卜，变化性更大
• 行动建议：避免急于求成，多方了解情况
• 总体建议：事情虽有阻碍但并非绝对，需要坚持和策略`,

      '速喜': `🎉 好消息即将到来，但需抓紧时机！
• 时效性强：短期内会有好的结果或消息
• 持续性弱：好事可能不长久，需要快速行动
• 适用场景：考试成绩、工作消息、即时决策等
• 注意事项：可能伴有争论或口舌，但性质为争辩非争斗
• 总体建议：把握当下，迅速行动，不要拖延`,

      '赤口': `❌ 情况较为严峻，需要特别谨慎。
• 失败风险：此事成功率很低，且可能遭遇挫败
• 意外因素：可能出现突发状况，结果与预期相反
• 精神状态：可能内心已经不抱希望或抗拒此事
• 人际关系：小心口舌是非，避免冲突和争执
• 总体建议：暂缓行动，重新评估，或寻求帮助`,

      '小吉': `🌟 前景看好，但成功更多取决于个人努力！
• 潜力指数：有成功的基础和可能性
• 关键因素：个人的态度和行动力是决定性因素
• 变化特性：是六神中变化可能性最大的
• 积极心态：主动出击则吉，消极等待则平
• 总体建议：发挥主观能动性，多行动多努力必有收获`,

      '空亡': `🌫️ 情况比较特殊，可能有两种截然不同的结果。
• 可能性一：事情完全落空，什么都不会发生
• 可能性二：结果很差，遭遇较大失败
• 特殊含义：在某些情况下反而表示"没有问题"
• 心理状态：可能已经有放弃的念头
• 总体建议：重新审视目标，或许应该转换思路和方向`
    };

    return advice[godName] || '请以平常心对待，顺其自然。';
  }

  // 简化的时辰计算
  getShichen(hour) {
    const shichens = [
      '子时', '丑时', '寅时', '卯时', '辰时', '巳时',
      '午时', '未时', '申时', '酉时', '戌时', '亥时'
    ];

    // 时辰对应关系：23-1点子时，1-3点丑时，以此类推
    let index;
    if (hour >= 23 || hour < 1) index = 0; // 子时
    else index = Math.floor((hour + 1) / 2);

    return shichens[index];
  }

  // 获取时辰序号（用于小六壬计算）
  getShichenIndex(hour) {
    if (hour >= 23 || hour < 1) return 1; // 子时 = 1
    return Math.floor((hour + 1) / 2) + 1;
  }

  // 小六壬核心算法
  calculateXiaoLiuRen(lunarMonth, lunarDay, hour) {
    // 六神定义 - 更详细的传统解释
    const sixGods = [
      {
        name: '大安',
        element: '木',
        nature: '吉',
        meaning: '安稳安逸美事，但也有静止之意。事情平稳发展，宜守不宜动。',
        details: '大安为吉宫，主平稳、安定。感情方面发展平稳但可能过于平淡，财运稳定有进有出。适合问"能否成功"类问题，不适合问"能否行动"类问题。'
      },
      {
        name: '留连',
        element: '土',
        nature: '凶',
        meaning: '反复、犹豫、拖延、漫长、纠缠、暧昧。纯阴卦，主不光明、秘密、隐私。',
        details: '留连纯阴卦，代表事情未定，仍有变化。夜晚测得尤为不稳定。与小吉同处吉凶交界，但凶性稍多。事情发展缓慢，多有阻碍。'
      },
      {
        name: '速喜',
        element: '火',
        nature: '吉',
        meaning: '火热、快速、好事。有好事但不长久，应快速行动把握时机。',
        details: '速喜为吉宫，如大火燎原，一烧既尽。短期事情大吉（考试、消息、决策），长期事情后劲不足。为朱雀，有口舌争辩之象。'
      },
      {
        name: '赤口',
        element: '金',
        nature: '凶',
        meaning: '口舌官非、吵闹打斗、意外凶险。为白虎，代表挫败和突发意外。',
        details: '赤口为凶宫，主口舌官非。落此宫事情已非常凶，必定失败且为挫败。也主精神紧张，对所问之事不抱希望。但也有交谈、合作等正面象意。'
      },
      {
        name: '小吉',
        element: '水',
        nature: '平',
        meaning: '驿马宫，为动，向好发展但力量微弱需自身努力。为桃花，主美事。',
        details: '小吉为纯阳卦，变化可能性最大。成功与否更多取决于个人努力和行动。消极对待则吉性减退，积极行动则成功率增加。'
      },
      {
        name: '空亡',
        element: '土',
        nature: '凶',
        meaning: '空、亡，事情落空不成，但也有无事之意。性质特殊，倾向虚无。',
        details: '空亡有两种可能：一是大凶结果很差，二是什么都不会发生。问失物为未丢，问寻找为找不到。常代表弃考、放弃等情况。'
      }
    ];

    // 第一步：月将推算（从大安开始，按农历月份数）
    let monthPosition = (lunarMonth - 1) % 6;

    // 第二步：日期推算（从月将位置开始，按农历日期数）
    let dayPosition = (monthPosition + lunarDay - 1) % 6;

    // 第三步：时辰推算（从日期位置开始，按时辰序号数）
    let shichenIndex = this.getShichenIndex(hour);
    let finalPosition = (dayPosition + shichenIndex - 1) % 6;

    // 获取最终结果
    const result = sixGods[finalPosition];

    return {
      monthPosition: sixGods[monthPosition].name,
      dayPosition: sixGods[dayPosition].name,
      finalResult: result,
      calculation: {
        月将: `农历${lunarMonth}月 → ${sixGods[monthPosition].name}`,
        日期: `从${sixGods[monthPosition].name}数${lunarDay}日 → ${sixGods[dayPosition].name}`,
        时辰: `从${sixGods[dayPosition].name}数${shichenIndex}(时辰序号) → ${result.name}`
      }
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("小六壬 MCP 服务器已启动");
  }
}

const server = new XiaoLiuRenMCP();
server.run().catch(console.error);