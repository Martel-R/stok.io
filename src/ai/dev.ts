import { config } from 'dotenv';
config();

import '@/ai/flows/answer-inventory-questions.ts';
import '@/ai/flows/generate-product-descriptions.ts';
import '@/ai/flows/summarize-data-request.ts';