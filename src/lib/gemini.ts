import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

export const CHAT_MODEL = "gemini-flash-latest";
export const IMAGE_MODEL = "gemini-2.5-flash-image";
export const LIVE_MODEL = "gemini-flash-latest";
