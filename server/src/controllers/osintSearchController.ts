import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import DossierNode from '../models/DossierNode';
import User from '../models/User';

const SEARXNG_URL = process.env.SEARXNG_URL || 'http://100.64.0.2:8091';
const TELEGAGO_CSE_ID = '006368593537057042503:efxu7xprihg';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

/** Search Telegago (Google CSE for Telegram) directly */
async function searchTelegago(query: string, apiKey?: string): Promise<Array<{ title: string; url: string; content: string; engine: string }>> {
  const key = apiKey || GOOGLE_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({
      key,
      cx: TELEGAGO_CSE_ID,
      q: query,
      num: '10',
    });
    const resp = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as any;
    return (data.items || []).map((item: any) => ({
      title: item.title || '',
      url: item.link || '',
      content: item.snippet || '',
      engine: 'telegago',
    }));
  } catch {
    return [];
  }
}

// Predefined dork templates
const DORK_TEMPLATES: Record<string, string> = {
  // Telegago-style: comprehensive Telegram search across all indexers
  telegram: 'site:t.me OR site:tgstat.com OR site:telemetr.io OR site:telegramchannels.me OR site:lyzem.com OR site:telegram.me OR site:combot.org',
  // Telegram channels specifically
  'telegram-channels': 'site:t.me -site:t.me/s/ inurl:joinchat OR inurl:/ -inurl:share -inurl:addstickers',
  // Telegram messages/content search
  'telegram-messages': 'site:t.me/s/',
  leaks: 'site:pastebin.com OR site:rentry.co OR site:ghostbin.com OR site:paste.ee OR site:dpaste.org OR site:justpaste.it',
  social: 'site:facebook.com OR site:instagram.com OR site:linkedin.com OR site:x.com OR site:mastodon.social OR site:threads.net',
  email: 'site:pastebin.com OR site:t.me OR site:justpaste.it OR intext:password OR intext:leak',
  phone: 'site:t.me OR site:facebook.com OR site:whatsapp.com OR site:truecaller.com OR site:sync.me',
  username: 'site:t.me OR site:instagram.com OR site:github.com OR site:reddit.com OR site:x.com OR site:mastodon.social',
  mastodon: 'site:mastodon.social OR site:piaille.fr OR site:framapiaf.org OR site:mstdn.social',
  // Dark web / forums
  forums: 'site:reddit.com OR site:4chan.org OR site:lolcow.farm OR site:kiwifarms.net',
};

// POST /api/osint/search
export async function osintSearch(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { query, category, page } = req.body;

    if (!query?.trim()) {
      res.status(400).json({ error: 'Query required' });
      return;
    }

    // Build search query with dork prefix
    let searchQuery = query.trim();
    if (category && DORK_TEMPLATES[category]) {
      searchQuery = `${searchQuery} ${DORK_TEMPLATES[category]}`;
    }

    const pageNum = page || 1;
    const params = new URLSearchParams({
      q: searchQuery,
      format: 'json',
      pageno: String(pageNum),
    });

    // Get user's Google API key for Telegago
    let userGoogleKey = GOOGLE_API_KEY;
    if (!userGoogleKey) {
      try {
        const user = await User.findById(userId).select('preferences');
        if (user?.preferences?.googleApiKey) userGoogleKey = user.preferences.googleApiKey;
      } catch { /* */ }
    }

    // Run SearxNG + Telegago in parallel for Telegram categories
    const isTelegramSearch = category && category.startsWith('telegram');
    const [searxngResponse, telegagoResults] = await Promise.all([
      fetch(`${SEARXNG_URL}/search?${params}`),
      isTelegramSearch && userGoogleKey ? searchTelegago(query.trim(), userGoogleKey) : Promise.resolve([]),
    ]);

    if (!searxngResponse.ok) throw new Error(`SearxNG status ${searxngResponse.status}`);
    const data = (await searxngResponse.json()) as any;

    const searxngResults = (data.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      engine: r.engine || '',
      category: r.category || '',
      thumbnail: r.thumbnail || null,
      publishedDate: r.publishedDate || null,
    }));

    // Concat all results without deduplication (raw data, duplicates confirm findings)
    const results = [...telegagoResults, ...searxngResults];

    const ip = (
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      ''
    ).replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(
      userId,
      'osint.search',
      'system',
      null,
      { query: searchQuery, category, resultCount: results.length, telegagoCount: telegagoResults.length },
      ip,
      ua,
    );

    res.json({
      results,
      query: searchQuery,
      totalResults: data.number_of_results || results.length,
      page: pageNum,
    });
  } catch (err: any) {
    console.error('[OSINT Search] Error:', err.message);
    res.status(502).json({ error: `Search failed: ${err.message}` });
  }
}

// POST /api/osint/search/export - Export a result to a dossier note
export async function osintExportToNote(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { dossierId, parentId, title, url, content } = req.body;

    if (!dossierId || !title) {
      res.status(400).json({ error: 'dossierId and title required' });
      return;
    }

    // Build TipTap content
    const tiptapContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: title }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: url } }],
              text: url,
            },
          ],
        },
        ...(content
          ? [{ type: 'paragraph', content: [{ type: 'text', text: content }] }]
          : []),
      ],
    };

    const lastSibling = await DossierNode.findOne({
      dossierId,
      parentId: parentId || null,
    })
      .sort({ order: -1 })
      .lean();
    const order = (lastSibling?.order ?? -1) + 1;

    const node = await DossierNode.create({
      dossierId,
      parentId: parentId || null,
      type: 'note',
      title: `🔎 ${title}`,
      content: tiptapContent,
      contentText: `${title}\n${url}\n${content || ''}`,
      order,
    });

    const ip = (
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      ''
    ).replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(
      userId,
      'osint.export',
      'node',
      node._id?.toString(),
      { dossierId, title, url },
      ip,
      ua,
    );

    res.status(201).json(node);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/osint/dorks - Get available dork templates
export async function getDorkTemplates(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  res.json(DORK_TEMPLATES);
}
