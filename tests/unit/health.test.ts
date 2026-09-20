import { describe, expect, test } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  test('returns status and whether AI is configured without leaking secrets', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual({
      status: 'ok',
      aiConfigured: expect.any(Boolean),
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/DEEPSEEK_API_KEY/i);
    expect(serialized).not.toMatch(/sk-/i);
    expect(serialized).not.toMatch(/deepseek-flash/);
  });
});
