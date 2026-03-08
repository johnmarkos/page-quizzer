import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from '../../src/providers/OllamaProvider.js';

describe('OllamaProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the default base URL and model when omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: 'llama3.2' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider({ apiKey: '' });
    await provider.testConnection();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    expect(provider.model).toBe('llama3.2');
  });

  it('normalizes /api suffixes before building generate URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        response: JSON.stringify({
          questions: [
            {
              question: 'What moves?',
              options: ['Atoms', 'Stillness', 'Nothing', 'Only light'],
              correctIndex: 0,
            },
          ],
        }),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OllamaProvider({
      apiKey: '',
      baseUrl: 'http://localhost:11434/api/',
    });

    await provider.generateQuiz({
      content: 'Atoms are always moving in matter.',
      density: 1,
      maxQuestions: 1,
      title: 'Atoms',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:11434/api/generate');
  });
});
