import { genkit } from 'genkit/beta';
import { googleAI } from '@genkit-ai/googleai';
import { defineGraphMemoryTools } from '../src';

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model('gemini-2.5-flash'),
});

const memoryTools = defineGraphMemoryTools(ai);

ai.defineFlow('populate_graph', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://instructions' } }],
    prompt: `Remember that my name is Pavel and I'm a Software Developer and I work at company Placeholder Software Inc.`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('add_observations', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://instructions' } }],
    prompt: `Pavel likes TypeScript. Remember this observation`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('delete_observations', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://instructions' } }],
    prompt: `Forget that Pavel likes TypeScript. `,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('delete_relation', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://instructions' } }],
    prompt: `Forget that Pavel is a Software Developer.`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('check_entity', async () => {
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://instructions' } }],
    prompt: `do you remember my name? check memory.`,
    tools: [...memoryTools],
  });
  return text;
});

ai.defineFlow('populate_graph_in_session', async () => {
  const sessionId = '123';
  const { text } = await ai.generate({
    system: [{ resource: { uri: 'memory://instructions' } }],
    prompt: `Remember that my name is Banana and I'm a Tree and I work at Banana Grove Inc.`,
    tools: [...memoryTools],
    context: { memory: { sessionId } },
  });
  return text;
});
