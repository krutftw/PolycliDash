import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

describe('GET /api/cli/presets', () => {
  it('returns cliBinary and a non-empty presets array', async () => {
    const res = await request(app).get('/api/cli/presets');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cliBinary');
    expect(Array.isArray(res.body.presets)).toBe(true);
    expect(res.body.presets.length).toBeGreaterThan(0);
  });

  it('includes execution presets', async () => {
    const res = await request(app).get('/api/cli/presets');
    const ids = res.body.presets.map((p) => p.id);
    expect(ids).toContain('placeBuyOrder');
    expect(ids).toContain('placeSellOrder');
    expect(ids).toContain('cancelOrder');
  });

  it('includes new portfolio presets', async () => {
    const res = await request(app).get('/api/cli/presets');
    const ids = res.body.presets.map((p) => p.id);
    expect(ids).toContain('walletBalance');
    expect(ids).toContain('tradeHistory');
  });
});

describe('POST /api/research — input validation', () => {
  it('rejects missing marketId with 400', async () => {
    const res = await request(app)
      .post('/api/research')
      .send({ question: 'Should I buy YES?', timeHorizon: 'swing', riskTolerance: 'moderate' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/marketId/i);
  });

  it('rejects short question with 400', async () => {
    const res = await request(app)
      .post('/api/research')
      .send({ marketId: 'mkt-1', question: 'short', timeHorizon: 'swing', riskTolerance: 'moderate' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/question/i);
  });

  it('rejects invalid timeHorizon with 400', async () => {
    const res = await request(app)
      .post('/api/research')
      .send({
        marketId: 'mkt-1',
        question: 'Which side is stronger right now?',
        timeHorizon: 'unknown-horizon',
        riskTolerance: 'moderate'
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/timeHorizon/i);
  });

  it('rejects invalid riskTolerance with 400', async () => {
    const res = await request(app)
      .post('/api/research')
      .send({
        marketId: 'mkt-1',
        question: 'Which side is stronger right now?',
        timeHorizon: 'swing',
        riskTolerance: 'yolo'
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/riskTolerance/i);
  });
});

describe('POST /api/ai/test — AI config validation', () => {
  it('rejects invalid base URL protocol with 400', async () => {
    const res = await request(app)
      .post('/api/ai/test')
      .send({
        aiConfig: {
          provider: 'openai-compatible',
          baseUrl: 'ftp://badprotocol.example.com',
          model: 'gpt-4o',
          apiKey: 'sk-test'
        }
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/http/i);
  });

  it('rejects openai-compatible config without an api key with 400', async () => {
    const res = await request(app)
      .post('/api/ai/test')
      .send({
        aiConfig: {
          provider: 'openai-compatible',
          baseUrl: 'https://openrouter.ai/api',
          model: 'gpt-4o',
          apiKey: ''
        }
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/api key/i);
  });
});

describe('GET /api/gamma/markets', () => {
  it('returns ok and markets array', async () => {
    // This calls the real Gamma API; allow timeout or skip if unavailable
    const res = await request(app)
      .get('/api/gamma/markets')
      .query({ q: '', limit: '3', active: 'true' })
      .timeout(15000);

    // We accept either a successful response or a network failure from CI
    expect([200]).toContain(res.status);
    if (res.status === 200) {
      expect(typeof res.body.ok).toBe('boolean');
      expect(Array.isArray(res.body.markets)).toBe(true);
    }
  });
});

describe('Unknown /api route', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
