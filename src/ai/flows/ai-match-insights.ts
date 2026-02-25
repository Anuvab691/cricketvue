'use server';
/**
 * @fileOverview An AI agent that generates engaging, playful facts or lighthearted predictions related to specific cricket matches.
 *
 * - generateMatchInsight - A function that handles the generation of match insights.
 * - AiMatchInsightsInput - The input type for the generateMatchInsight function.
 * - AiMatchInsightsOutput - The return type for the generateMatchInsight function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiMatchInsightsInputSchema = z.object({
  teamA: z.string().describe('The name of the first team participating in the match.'),
  teamB: z.string().describe('The name of the second team participating in the match.'),
  matchStatus: z.string().describe('The current status of the match (e.g., upcoming, live, finished).'),
  // Optionally, we could add more context like recent performance, player stats, etc.
});
export type AiMatchInsightsInput = z.infer<typeof AiMatchInsightsInputSchema>;

const AiMatchInsightsOutputSchema = z.string().describe('An engaging, playful fact or lighthearted prediction about the cricket match.');
export type AiMatchInsightsOutput = z.infer<typeof AiMatchInsightsOutputSchema>;

export async function generateMatchInsight(input: AiMatchInsightsInput): Promise<AiMatchInsightsOutput> {
  return aiMatchInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiMatchInsightsPrompt',
  input: {schema: AiMatchInsightsInputSchema},
  output: {schema: AiMatchInsightsOutputSchema},
  prompt: `You are a lively and entertaining cricket commentator with a knack for playful predictions and fun facts.

Generate an engaging, playful fact or a lighthearted prediction about the upcoming cricket match between {{{teamA}}} and {{{teamB}}}. The current match status is: {{{matchStatus}}}.

Keep it concise, witty, and positive. Avoid any technical jargon or serious analysis.

Examples:
- "Looks like the {{teamA}} bowlers will need their lucky socks to stop {{teamB}} from hitting boundaries all day!"
- "I predict a spectacular catch from someone in {{teamB}} – maybe even a one-handed stunner!"
- "Fun fact: The last time {{teamA}} played at this venue, they found a four-leaf clover right before the coin toss! Coincidence? I think not!"
- "If {{teamA}} bats first, expect a flurry of sixes before the tea break – the crowd is hungry for them!"

Focus on delivering an insight that enhances the user's entertainment and interaction with the platform.
`,
});

const aiMatchInsightsFlow = ai.defineFlow(
  {
    name: 'aiMatchInsightsFlow',
    inputSchema: AiMatchInsightsInputSchema,
    outputSchema: AiMatchInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
