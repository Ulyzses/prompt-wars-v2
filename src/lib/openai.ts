import { OpenAI } from 'openai';
import { OPENAI_API_KEY, OPENAI_MODEL } from '$env/static/private';

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

export const model = OPENAI_MODEL || 'gpt-4.1-nano';
