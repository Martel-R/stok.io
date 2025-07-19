// src/ai/flows/answer-inventory-questions.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for answering natural language questions about inventory data.
 *
 * - answerInventoryQuestion - A function that accepts a question string and returns an answer string.
 * - AnswerInventoryQuestionInput - The input type for the answerInventoryQuestion function.
 * - AnswerInventoryQuestionOutput - The return type for the answerInventoryQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerInventoryQuestionInputSchema = z.object({
  question: z.string().describe('A natural language question about the inventory.'),
});
export type AnswerInventoryQuestionInput = z.infer<typeof AnswerInventoryQuestionInputSchema>;

const AnswerInventoryQuestionOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about the inventory.'),
});
export type AnswerInventoryQuestionOutput = z.infer<typeof AnswerInventoryQuestionOutputSchema>;

export async function answerInventoryQuestion(input: AnswerInventoryQuestionInput): Promise<AnswerInventoryQuestionOutput> {
  return answerInventoryQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerInventoryQuestionPrompt',
  input: {schema: AnswerInventoryQuestionInputSchema},
  output: {schema: AnswerInventoryQuestionOutputSchema},
  prompt: `You are a helpful AI assistant that answers questions about inventory data.

  You have access to the current inventory data, but you cannot directly access it.
  Instead, you must rely on the user to provide you with the necessary information.

  Please answer the following question to the best of your ability, using your general knowledge and reasoning skills:

  Question: {{{question}}}`,
});

const answerInventoryQuestionFlow = ai.defineFlow(
  {
    name: 'answerInventoryQuestionFlow',
    inputSchema: AnswerInventoryQuestionInputSchema,
    outputSchema: AnswerInventoryQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
