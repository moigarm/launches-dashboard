import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || ''
});

const xai = new OpenAI({
	apiKey: process.env.GROK_API_KEY || '',
	baseURL: 'https://api.x.ai/v1'
});

const ai = new GoogleGenAI({
	apiKey: process.env.GEMINI_API_KEY || ''
});

export type AIProvider = 'openai' | 'grok' | 'gemini';

const SYSTEM_PROMPT = 'You are a helpful marketing advisor who provides genuine, actionable advice to startups.';

export async function draftDM(
	companyName: string,
	likes: number,
	provider: AIProvider = 'openai'
): Promise<string> {
	const prompt = `Draft a helpful and friendly DM to ${companyName}, a startup whose launch post received ${likes} likes. 
Offer marketing advice and support in a genuine, non-salesy way. Keep it under 280 characters for X/Twitter.
Be encouraging and specific about what they could improve.`;

	try {
		if (provider === 'openai') {
			const completion = await openai.chat.completions.create({
				model: 'gpt-4.1-nano',
				messages: [
					{
						role: 'system',
						content: SYSTEM_PROMPT
					},
					{ role: 'user', content: prompt }
				],
				max_tokens: 150,
				temperature: 0.7
			});

			return completion.choices[0]?.message?.content || 'Failed to generate DM';
		}

		if (provider === 'grok') {
			const completion = await xai.chat.completions.create({
				model: 'grok-4-fast-non-reasoning',
				messages: [
					{
						role: 'system',
						content: SYSTEM_PROMPT
					},
					{ role: 'user', content: prompt }
				],
				max_tokens: 150,
				temperature: 0.7
			});

			return completion.choices[0]?.message?.content || 'Failed to generate DM';
		}

		if (provider === 'gemini') {
			const response = await ai.models.generateContent({
				model: 'gemini-3-flash-preview',
				contents: prompt,
				config: {
					systemInstruction: SYSTEM_PROMPT,
					temperature: 0.7,
					maxOutputTokens: 150,
				}
			});

			return response.text || 'Failed to generate DM';
		}

		return 'AI provider not yet implemented';
	} catch (error) {
		console.error('Error drafting DM:', error);
		return 'Failed to generate DM';
	}
}
