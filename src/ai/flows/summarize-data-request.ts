// Summarize Data Request Flow
'use server';

/**
 * @fileOverview A data summarization AI agent.
 * 
 * - summarizeDataRequest - A function that handles the data summarization process.
 * - SummarizeDataInput - The input type for the summarizeDataRequest function.
 * - SummarizeDataOutput - The return type for the summarizeDataRequest function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeDataInputSchema = z.object({
  dataDescription: z.string().describe('Description of the data to be summarized.'),
  data: z.string().describe('The data to be summarized.'),
});
export type SummarizeDataInput = z.infer<typeof SummarizeDataInputSchema>;

const SummarizeDataOutputSchema = z.object({
  summary: z.string().describe('A summary of the data.'),
});
export type SummarizeDataOutput = z.infer<typeof SummarizeDataOutputSchema>;

export async function summarizeDataRequest(input: SummarizeDataInput): Promise<SummarizeDataOutput> {
  return summarizeDataRequestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeDataRequestPrompt',
  input: {schema: SummarizeDataInputSchema},
  output: {schema: SummarizeDataOutputSchema},
  prompt: `You are a data analyst. You will summarize the following data based on the description provided.

Data Description: {{{dataDescription}}}
Data: {{{data}}}`,
});

const summarizeDataRequestFlow = ai.defineFlow(
  {
    name: 'summarizeDataRequestFlow',
    inputSchema: SummarizeDataInputSchema,
    outputSchema: SummarizeDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
