import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

const LT_URL = process.env.LANGUAGETOOL_URL || 'http://localhost:8010';
const TIMEOUT = 5000;

export async function checkText(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { text, language, disabledRules } = req.body;
    if (!text) {
      res.status(400).json({ message: 'text is required' });
      return;
    }
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('language', language || 'auto');
    if (disabledRules) params.append('disabledRules', disabledRules);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(`${LT_URL}/v2/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      res.status(502).json({ message: 'LanguageTool service error' });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    if (err.name === 'AbortError' || err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
      res.json({ matches: [], available: false });
      return;
    }
    res.json({ matches: [], available: false });
  }
}

export async function getStatus(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${LT_URL}/v2/languages`, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      res.json({ available: false, languages: [] });
      return;
    }
    const data = await response.json();
    res.json({ available: true, languages: data });
  } catch {
    res.json({ available: false, languages: [] });
  }
}
