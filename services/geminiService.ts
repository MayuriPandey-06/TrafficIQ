import { GoogleGenAI, Schema, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ambulance_present: { type: Type.BOOLEAN, description: "Whether an ambulance or emergency vehicle is visible." },
    accident_present: { type: Type.BOOLEAN, description: "Whether a traffic accident or crash is visible." },
    fight_present: { type: Type.BOOLEAN, description: "Whether a physical altercation or fight between people is visible." },
    vehicle_counts: {
      type: Type.OBJECT,
      properties: {
        trucks: { type: Type.INTEGER, description: "Count of heavy vehicles like trucks or buses." },
        cars: { type: Type.INTEGER, description: "Count of standard cars, SUVs, or vans." },
        bikes: { type: Type.INTEGER, description: "Count of motorcycles or bicycles." },
      },
      required: ["trucks", "cars", "bikes"],
    },
    traffic_density: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
    summary: { type: Type.STRING, description: "A brief one-sentence summary of the road status." },
  },
  required: ["ambulance_present", "accident_present", "fight_present", "vehicle_counts", "traffic_density", "summary"],
};

export const analyzeTrafficImage = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Good balance of speed and multimodal capability
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this traffic feed. Detect vehicles, calculate counts to determine signal timing, and identify any critical events like ambulances, accidents, or fights. Be precise.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: "You are an AI Traffic Controller. Your job is to analyze road feeds accurately to optimize traffic flow and ensure safety.",
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};