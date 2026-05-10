import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function evaluateSession(sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { name: true } },
      project: { select: { name: true } },
    }
  });

  if (!session || !session.signatureValid) return;

  try {
    const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://devscope.io',
        'X-Title': 'DevScope Backend',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are the DevScope AI Evaluator. Your goal is to score a developer's CLI session.
Evaluate based on:
1. Tool efficiency (did they use the right tools for the job?)
2. Iteration depth (did they solve the problem or just scratch the surface?)
3. Prompt quality (were their instructions to the agent clear?)
4. Completion (did they reach a successful conclusion?)

Return a JSON object: { "score": number (0-100), "feedback": { "summary": string, "strengths": string[], "improvements": string[] } }`
          },
          {
            role: 'user',
            content: `Session ID: ${session.id}
Agent: ${session.agent} (${session.agentVersion})
Stats: ${JSON.stringify(session.stats)}
Messages: ${JSON.stringify(session.messages)}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as OpenRouterResponse;
    const content = data.choices[0]?.message.content;
    if (!content) throw new Error('Empty response from OpenRouter');

    const result = JSON.parse(content);

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        score: result.score,
        feedback: result.feedback,
        evaluationStatus: 'SCORED',
        evaluatedAt: new Date(),
      }
    });
  } catch (error) {
    console.error(`Failed to evaluate session ${sessionId}:`, error);
    
    await prisma.session.update({
      where: { id: sessionId },
      data: { evaluationStatus: 'FAILED' }
    });
  }
}
