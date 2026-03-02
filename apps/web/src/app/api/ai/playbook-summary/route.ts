import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { z } from 'zod';

const payloadSchema = z.object({
  title: z.string().min(2),
  steps: z.array(z.string()).default([]),
});

export const maxDuration = 30;

export async function POST(request: Request) {
  const json = await request.json();
  const payload = payloadSchema.parse(json);

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({
      summary: `${payload.title}: Standardized browser workflow with ${payload.steps.length} executable steps and audit-ready run evidence.`,
    });
  }

  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system:
      'You write concise B2B product copy for operations teams. Keep it calm, concrete, and free of hype.',
    prompt: `Write one concise description (max 36 words) for this playbook.
Title: ${payload.title}
Steps: ${payload.steps.join(', ')}`,
  });

  return Response.json({ summary: text.trim() });
}
