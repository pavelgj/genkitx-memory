import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { defineMemoryTools, MEMORY_TOOLS_INSTRUCTIONS } from '../src';

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model('gemini-2.5-flash'),
});

const memoryTools = defineMemoryTools(ai);

ai.defineFlow('populate_graph', async () => {
  const { text } = await ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS,
    prompt: `Remember that my name is Pavel and I'm a Software Developer and I work at company Placeholder Software Inc.`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('add_observations', async () => {
  const { text } = await ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS,
    prompt: `Pavel likes TypeScript. Remember this observation`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('delete_observations', async () => {
  const { text } = await ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS,
    prompt: `Forget that Pavel likes TypeScript. `,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('delete_relation', async () => {
  const { text } = await ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS,
    prompt: `Forget that Pavel is a Software Developer.`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('check_entity', async () => {
  const { text } = await ai.generate({
    system: MEMORY_TOOLS_INSTRUCTIONS,
    prompt: `do you remember my name? check memory.`,
    tools: [...memoryTools],
  });
  return text;
});
