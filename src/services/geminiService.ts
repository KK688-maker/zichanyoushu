import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });

export interface MarketAnalysis {
  estimatedMarketPrice: number;
  priceRange?: { min: number; max: number };
  confidence: number;
  suggestion: 'hold' | 'sell' | 'monitor';
  reasoning: string;
  marketDemandIndex: number; // 0-100
  priority: 'info' | 'warning' | 'critical';
  isUnrecognized?: boolean;
}

export async function analyzeMarket(assetName: string, purchasePrice: number, daysHeld: number, condition: 'mint' | 'good' | 'worn' = 'good'): Promise<MarketAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: `你是一位专业的二手交易市场分析师。请分析资产 "${assetName}" 的当前市场价值。
        
        数据背景:
        - 原始购入价: ¥${purchasePrice}
        - 已持有时间: ${daysHeld} 天
        - 成色状况: ${condition === 'mint' ? '99新' : condition === 'good' ? '良好' : '较差'}

        分析要求:
        1. 市场识别: 如果该资产名称 "${assetName}" 过于模糊、是随机乱码或非标准商品名，请将 isUnrecognized 设为 true。
        2. 价格评估: 给出当前该型号在主流二手平台(如闲鱼、拍拍)的真实平均成交价，并提供一个合理的价格波动区间 (min 到 max)。
        3. 决策建议: 
           - 如果处于换代前夕或残值进入暴跌期，建议 sell。
           - 如果资产具有保值性或持有成本低，建议 hold。
           - 如果市场剧烈波动，建议 monitor。
        4. 沉没成本原则: 持有不足 30 天的资产应给予 hold 肯定，除非市场价格异常崩溃。
        5. 准确性: 如果你不确定该资产的确切行情，请给出 conservative (保守) 的估价并在 reasoning 中如实说明。

        不要制造虚假的型号数据。` }]
      }
    ],
    config: {
      systemInstruction: `输出 JSON 格式。如果资产型号无法识别，必须诚实回答。
      字段要求:
      - isUnrecognized: boolean (如果无法定位到具体商品型号则为 true)
      - estimatedMarketPrice: number (平均值)
      - priceRange: { min: number, max: number } (二手价格参考区间)
      - confidence: number (0-1)
      - suggestion: 'hold' | 'sell' | 'monitor'
      - reasoning: string (中文，简洁有力，说明价格依据)
      - marketDemandIndex: number (0-100)
      - priority: 'info' | 'warning' | 'critical' (风险等级)`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          estimatedMarketPrice: { type: Type.NUMBER },
          priceRange: { 
            type: Type.OBJECT,
            properties: {
              min: { type: Type.NUMBER },
              max: { type: Type.NUMBER }
            },
            required: ["min", "max"]
          },
          confidence: { type: Type.NUMBER },
          suggestion: { type: Type.STRING, enum: ['hold', 'sell', 'monitor'] },
          reasoning: { type: Type.STRING },
          marketDemandIndex: { type: Type.NUMBER },
          priority: { type: Type.STRING, enum: ['info', 'warning', 'critical'] },
          isUnrecognized: { type: Type.BOOLEAN }
        },
        required: ["estimatedMarketPrice", "priceRange", "confidence", "suggestion", "reasoning", "marketDemandIndex", "priority"]
      }
    }
  });

  return JSON.parse(response.text);
}
