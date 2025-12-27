
import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Card, ResourceType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getClimateMasterCommentary = async (state: GameState): Promise<string> => {
  if (!process.env.API_KEY) return "AI 氣候導師已斷線。";

  const currentPlayer = state.players[state.turnIndex];
  const prompt = `
    You are the "Climate Master" in a city-building game called "Urban Heat Survival". 
    Current Game Status:
    - Round: ${state.roundCount}
    - Global Temp: ${state.globalTemp}°C
    - Current Player: ${currentPlayer.name} (Zone: ${currentPlayer.zone})
    - Player Resources: Water:${currentPlayer.resources.water}, Green:${currentPlayer.resources.green}, Material:${currentPlayer.resources.material}
    - Recent Logs:
    ${state.logs.slice(-5).map(l => l.msg).join('\n')}

    Please provide a short, professional, yet slightly witty commentary in Traditional Chinese (Taiwan) 
    about the current situation. Advise the player on what adaptation strategy might be best 
    given their resources and zone. Keep it under 50 words. Be direct.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || "氣候導師正在思考中...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "極端天氣造成訊號干擾，無法提供建議。";
  }
};

export interface AiDecision {
  action: 'plunder' | 'bank_trade' | 'skip_interaction' | 'build' | 'skip_build';
  targetId?: string;
  resource?: ResourceType;
  cardUuid?: string;
  reasoning: string;
}

export const getAiMoveDecision = async (state: GameState): Promise<AiDecision> => {
  if (!process.env.API_KEY) return { action: 'skip_build', reasoning: 'No API Key' };

  const aiPlayer = state.players[state.turnIndex];
  const otherPlayers = state.players.filter(p => p.id !== aiPlayer.id);
  const phase = state.turnPhase;

  const prompt = `
    You are an AI player in "Urban Heat Survival". It is your turn.
    Current Phase: ${phase === 2 ? 'Interaction (Plunder/Trade)' : 'Building (Buy from Market)'}
    Your Data: Resources(W:${aiPlayer.resources.water}, G:${aiPlayer.resources.green}, M:${aiPlayer.resources.material}), Zone:${aiPlayer.zone}, Score:${aiPlayer.score}
    Market Cards: ${state.market.map(c => `${c.name}(UUID:${c.uuid}, Cost:${JSON.stringify(c.cost)})`).join(' | ')}
    Other Players: ${otherPlayers.map(p => `${p.name}(ID:${p.id}, Resources:${JSON.stringify(p.resources)})`).join(' | ')}
    Global Temp: ${state.globalTemp}°C

    If phase is 2: Decide to 'plunder' (need targetId and resource), 'bank_trade' (3 water -> 1 material), or 'skip_interaction'.
    If phase is 3: Decide to 'build' (need cardUuid) or 'skip_build'.

    Return a JSON object with: action, targetId (optional), resource (optional), cardUuid (optional), reasoning (short string).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            targetId: { type: Type.STRING },
            resource: { type: Type.STRING },
            cardUuid: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["action", "reasoning"],
        },
      },
    });

    const decision = JSON.parse(response.text || '{}') as AiDecision;
    return decision;
  } catch (error) {
    console.error("Gemini AI Move Error:", error);
    return { action: phase === 2 ? 'skip_interaction' : 'skip_build', reasoning: 'Fallback due to error' };
  }
};
