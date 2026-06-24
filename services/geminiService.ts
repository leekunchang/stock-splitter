import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const getBudgetingAdvice = async (purpose: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Suggest a standard financial ratio distribution for this purpose: "${purpose}". 
                 Provide the response in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            ratios: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER }
            },
            labels: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "description", "ratios", "labels"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

export const getLiveExchangeRate = async (): Promise<number | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "What is the current USD/KRW (US Dollar to Korean Won) exchange rate right now? Search Google in real-time to locate today's rate. Return only a JSON object containing the rate, like: {\"rate\": 1345.5}",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rate: { type: Type.NUMBER }
          },
          required: ["rate"]
        }
      }
    });

    const data = JSON.parse(response.text);
    if (data && typeof data.rate === "number") {
      return data.rate;
    }
    return null;
  } catch (error) {
    console.error("Gemini grounding exchange rate error:", error);
    return null;
  }
};

export const fetchFallbackExchangeRate = async (): Promise<number | null> => {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    if (data && data.rates && typeof data.rates.KRW === "number") {
      return data.rates.KRW;
    }
    return null;
  } catch (error) {
    console.error("Fallback exchange rate fetch error:", error);
    return null;
  }
};
