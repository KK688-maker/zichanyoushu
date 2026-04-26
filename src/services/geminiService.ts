import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface MarketAnalysis {
  estimatedMarketPrice: number;
  confidence: number;
  suggestion: 'hold' | 'sell' | 'monitor';
  reasoning: string;
  marketDemandIndex: number; // 0-100
  priority: 'info' | 'warning' | 'critical';
}

export async function analyzeMarket(assetName: string, purchasePrice: number, daysHeld: number, condition: 'mint' | 'good' | 'worn' = 'good'): Promise<MarketAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: `分析资产 "${assetName}" 的当前市场价值与处置建议。
        原始购买价格: ¥${purchasePrice}。
        已持有天数: ${daysHeld} 天。
        成色状况: ${condition === 'mint' ? '99新/准新' : condition === 'good' ? '成色良好' : '战斗成色/明显使用痕迹'}。
        
        请结合以下核心权重逻辑分析：
        1. 沉没成本保护伞：若持有 < 30天，除非极端情况，否则屏蔽“建议卖出”，以安抚和鼓励持有为主，话术应为【持有确认】。
        2. 收益期判定：若实际日耗远低于目标预期（如已持有数年），判定为“超额收益期”，话术应为“纯收益期，随时可变现”。
        3. 代际衰退加速：若距下一代发布不足30天且当前残值尚在高位，触发红色【行动指令】（critical），建议获利离场。
        4. 成色修正：${condition === 'mint' ? '准新机器二次流通价值极高，更不应轻易建议离场' : '成色较差会显著降低残值，修正估价'}。
        
        提供建议的市场价、操作建议(hold/sell/monitor)、供需热度(0-100)及视觉优先级(info/warning/critical)。` }]
      }
    ],
    config: {
      systemInstruction: `你是一位极度精准的财务资产价值精算师。
      核心使命：把“绝对跌价”转化为“相对性价比”。
      
      输出规则：
      - estimatedMarketPrice: 考虑成色修正后的估价。
      - suggestion: hold (持有), sell (变现), monitor (观察)。
      - reasoning: 必须使用中文。严格遵循：
        - 持有 < 30天：必须使用【持有确认】语气。
        - 已经完美赚回本金（低日耗）：必须使用“超额收益”相关正向鼓励话术。
        - 换代前一个月且价格尚高：必须使用【行动指令】红色预警话术。
      - marketDemandIndex: 供需活跃度。
      - priority: info(日常/保护期), warning(正常加速), critical(换代暴跌前夕)。`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          estimatedMarketPrice: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
          suggestion: { type: Type.STRING, enum: ['hold', 'sell', 'monitor'] },
          reasoning: { type: Type.STRING },
          marketDemandIndex: { type: Type.NUMBER },
          priority: { type: Type.STRING, enum: ['info', 'warning', 'critical'] }
        },
        required: ["estimatedMarketPrice", "confidence", "suggestion", "reasoning", "marketDemandIndex", "priority"]
      }
    }
  });

  return JSON.parse(response.text);
}
