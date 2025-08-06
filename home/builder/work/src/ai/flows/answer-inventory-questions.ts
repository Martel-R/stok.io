// src/ai/flows/answer-inventory-questions.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for answering natural language questions about inventory data.
 *
 * - answerInventoryQuestion - A function that accepts a question string and context string, returning an answer.
 * - AnswerInventoryQuestionInput - The input type for the answerInventoryQuestion function.
 * - AnswerInventoryQuestionOutput - The return type for the answerInventoryQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerInventoryQuestionInputSchema = z.object({
  question: z.string().describe('A natural language question about the inventory.'),
  context: z.string().describe('A string containing the current inventory data.'),
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
  prompt: `Você é um assistente de IA prestativo que responde a perguntas sobre dados de inventário.

  Use os seguintes dados de inventário como contexto para responder à pergunta do usuário.
  Inventário: {{{context}}}

  Pergunta: {{{question}}}
  
  Responda à pergunta com base estritamente nos dados de inventário fornecidos.`,
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
