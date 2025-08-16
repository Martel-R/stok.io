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
  salesContext: z.string().describe('A string containing sales data from the point of sale.'),
  paymentConditionsContext: z.string().describe('A string containing the available payment conditions and their fees.'),
});
export type AnswerBusinessQuestionInput = z.infer<typeof AnswerBusinessQuestionInputSchema>;

const ChartDataSchema = z.object({
  title: z.string().describe('The title of the chart.'),
  data: z.any().describe('The data for the chart, as an array of objects.'),
  dataKey: z.string().describe('The key for the data values (Y-axis).'),
  nameKey: z.string().describe('The key for the names/labels (X-axis).'),
}).optional();

const AnswerBusinessQuestionOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about the business data, formatted in Markdown for clear presentation (e.g., using lists, bolding, etc.).'),
  chart: ChartDataSchema.describe('If the question can be better answered with a chart, provide the data for the chart here. Otherwise, leave this field empty.'),
});

export type AnswerBusinessQuestionOutput = z.infer<typeof AnswerBusinessQuestionOutputSchema>;

export async function answerBusinessQuestion(input: AnswerBusinessQuestionInput): Promise<AnswerBusinessQuestionOutput> {
  return answerBusinessQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerBusinessQuestionPrompt',
  input: {schema: AnswerBusinessQuestionInputSchema},
  output: {schema: AnswerBusinessQuestionOutputSchema},
  prompt: `Você é um assistente de IA especialista em análise de negócios. Sua função é responder a perguntas e fornecer insights acionáveis com base nos dados fornecidos sobre uma empresa.

  Formate suas respostas em Markdown para clareza (use listas, negrito, etc.).

  Se a pergunta do usuário puder ser melhor representada visualmente por um gráfico de barras, forneça os dados para esse gráfico no campo 'chart'. Caso contrário, deixe o campo 'chart' vazio. Use o gráfico para comparar valores, como vendas por produto ou receita por dia.

  Use os seguintes dados como contexto para sua análise. Responda à pergunta do usuário de forma clara e, sempre que possível, ofereça uma análise ou um insight relevante.

  **Dados Disponíveis:**
  - Produtos: {{{productsContext}}}
  - Serviços: {{{servicesContext}}}
  - Clientes: {{{customersContext}}}
  - Agenda (Agendamentos): {{{appointmentsContext}}}
  - Inventário (Estoque): {{{inventoryContext}}}
  - Vendas (Frente de Caixa): {{{salesContext}}}
  - Formas de Pagamento (e suas taxas): {{{paymentConditionsContext}}}

  **Pergunta do Usuário:**
  "{{{question}}}"
  
  Responda à pergunta com base estritamente nos dados de contexto fornecidos, mas vá além da simples extração de dados. Analise as informações e forneça uma resposta inteligente e útil.`,
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
