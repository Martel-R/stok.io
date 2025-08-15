// src/ai/flows/answer-business-questions.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for answering natural language questions about business data.
 *
 * - answerBusinessQuestion - A function that accepts a question string and context strings, returning an answer.
 * - AnswerBusinessQuestionInput - The input type for the answerBusinessQuestion function.
 * - AnswerBusinessQuestionOutput - The return type for the answerBusinessQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerBusinessQuestionInputSchema = z.object({
  question: z.string().describe('A natural language question about the business data.'),
  productsContext: z.string().describe('A string containing product data.'),
  servicesContext: z.string().describe('A string containing service data.'),
  customersContext: z.string().describe('A string containing customer data.'),
  appointmentsContext: z.string().describe('A string containing appointment data (agenda).'),
  inventoryContext: z.string().describe('A string containing the current inventory data.'),
});
export type AnswerBusinessQuestionInput = z.infer<typeof AnswerBusinessQuestionInputSchema>;

const AnswerBusinessQuestionOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about the business data.'),
});
export type AnswerBusinessQuestionOutput = z.infer<typeof AnswerBusinessQuestionOutputSchema>;

export async function answerBusinessQuestion(input: AnswerBusinessQuestionInput): Promise<AnswerBusinessQuestionOutput> {
  return answerBusinessQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerBusinessQuestionPrompt',
  input: {schema: AnswerBusinessQuestionInputSchema},
  output: {schema: AnswerBusinessQuestionOutputSchema},
  prompt: `Você é um assistente de IA prestativo que responde a perguntas sobre os dados de um negócio.

  Use os seguintes dados como contexto para responder à pergunta do usuário.
  
  Produtos: {{{productsContext}}}
  Serviços: {{{servicesContext}}}
  Clientes: {{{customersContext}}}
  Agenda (Agendamentos): {{{appointmentsContext}}}
  Inventário: {{{inventoryContext}}}

  Pergunta: {{{question}}}
  
  Responda à pergunta com base estritamente nos dados de contexto fornecidos.`,
});

const answerBusinessQuestionFlow = ai.defineFlow(
  {
    name: 'answerBusinessQuestionFlow',
    inputSchema: AnswerBusinessQuestionInputSchema,
    outputSchema: AnswerBusinessQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
