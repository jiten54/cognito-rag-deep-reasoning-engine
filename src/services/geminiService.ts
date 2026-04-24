import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: string[];
  thinking?: string;
}

export async function* chatStream(messages: Message[], context?: string) {
  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: `You are Aether AI v4.0, an elite multimodal synthesis engine. 
      
      CORE DIRECTIVE:
      - When context is provided (under "Neural Context"), answer strictly based on that data.
      - If information is missing from context, state "Insufficient delta data".
      - Use ONLY provided context for grounded queries.
      
      OUTPUT FORMAT (Mandatory for grounded queries):
      FINAL ANSWER: [Clear grounded answer]
      REASONING SUMMARY: [Path taken through context]
      SOURCES: [Citations]
      CONFIDENCE: [0-100%]
      
      TONE: Sophisticated, technical, enigmatic.
      IMAGE ANALYSIS: Perform deep architectural logic analysis.
      WORKSPACE UPDATE: Use [[WORKSPACE_UPDATE]]: <markdown> for significant knowledge shifts.`,
    }
  });

  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const lastMessage = messages[messages.length - 1];
  let fullPrompt = lastMessage.content;
  
  if (context) {
    fullPrompt = `NEURAL CONTEXT:\n${context}\n\nOPERATOR QUERY:\n${lastMessage.content}`;
  }

  const parts: any[] = [{ text: fullPrompt }];
  
  if (lastMessage.images) {
    lastMessage.images.forEach(img => {
      const base64Data = img.split(',')[1];
      const mimeType = img.split(',')[0].split(':')[1].split(';')[0];
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    });
  }

  // Set the history
  (chat as any)._history = history;

  const streamResponse = await chat.sendMessageStream({
    message: parts,
    config: {
      thinkingConfig: { includeThoughts: true }
    }
  });

  for await (const chunk of streamResponse) {
    const res = chunk as any;
    yield {
      text: res.text || '',
      thought: res.thought || ''
    };
  }
}

export async function summarizeText(text: string): Promise<string> {
  const model = (ai as any).getGenerativeModel({ model: "gemini-3.1-flash" });
  const result = await model.generateContent(`Summarize this synthesis into a single, high-density paragraph. Preserve technical precision but optimize for rapid cognitive parsing: \n\n${text}`);
  const response = await result.response;
  return response.text();
}
