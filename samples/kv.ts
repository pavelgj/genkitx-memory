import { genkit } from 'genkit/beta';
import { googleAI } from '@genkit-ai/googleai';
import { defineKeyValueMemoryTools } from '../src';

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model('gemini-2.5-flash'),
});

const memoryTools = defineKeyValueMemoryTools(ai);

ai.defineFlow('populate_memory', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://kv/instructions' } }],
    prompt: `Remember that my name is Pavel and I'm a Software Developer and I work at company Placeholder Software Inc.`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('add_observations', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://kv/instructions' } }],
    prompt: `Pavel likes TypeScript. Remember this observation`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('delete_observations', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://kv/instructions' } }],
    prompt: `Forget that Pavel likes TypeScript. `,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('check_entity', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://kv/instructions' } }],
    prompt: `what is my name? check memory.`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('populate_memory_in_session', async () => {
  const sessionId = '123';
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://kv/instructions' } }],
    prompt: `Remember that my name is Banana and I'm a Tree and I work at Banana Grove Inc.`,
    tools: [...memoryTools],
    context: { memory: { sessionId } },
  });
  return text;
});
