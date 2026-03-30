import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { logActivity } from '../utils/activityLogger';

// Category definitions with icons and plain-language descriptions for investigators
const CATEGORIES: Record<string, { icon: string; label: string; description: string }> = {
  ssl: { icon: '🔒', label: 'Certificat SSL', description: 'Identite numerique du site' },
  domain: { icon: '🌐', label: 'Domaine / WHOIS', description: 'Proprietaire du nom de domaine' },
  headers: { icon: '📡', label: 'Headers HTTP', description: 'Informations renvoyees par le serveur' },
  dns: { icon: '🗂️', label: 'DNS', description: 'Adresses IP et services mail du domaine' },
  'http-security': { icon: '🛡️', label: 'Securite HTTP', description: 'Protections contre les attaques web' },
  'social-tags': { icon: '📱', label: 'Social Tags', description: 'Presentation du site sur les reseaux sociaux' },
  'trace-route': { icon: '🗺️', label: 'Traceroute', description: 'Chemin reseau vers le serveur' },
  firewall: { icon: '🧱', label: 'Firewall', description: 'Protection anti-intrusion' },
  dnssec: { icon: '🔐', label: 'DNSSEC', description: 'Verification authenticite du domaine' },
  hsts: { icon: '🔗', label: 'HSTS', description: 'Forcage connexion securisee HTTPS' },
  threats: { icon: '⚠️', label: 'Menaces', description: 'Signalement phishing ou malware' },
  archives: { icon: '📚', label: 'Archives', description: 'Historique du site sur Internet Archive' },
  rank: { icon: '📊', label: 'Classement', description: 'Popularite du site' },
  'linked-pages': { icon: '🔗', label: 'Liens', description: 'Pages internes et sites externes lies' },
  'robots-txt': { icon: '🤖', label: 'Robots.txt', description: 'Regles de visibilite moteurs de recherche' },
  'txt-records': { icon: '📝', label: 'TXT Records', description: 'Verifications de propriete' },
  'block-lists': { icon: '🚫', label: 'Blocklists', description: 'Blocage par filtres de securite' },
  sitemap: { icon: '🗺️', label: 'Sitemap', description: 'Structure du contenu du site' },
  redirects: { icon: '↪️', label: 'Redirections', description: 'Renvois automatiques' },
  'security-txt': { icon: '📄', label: 'Security.txt', description: 'Contact de securite du site' },
};

// --- TipTap JSON helpers ---

function textNode(text: string, marks?: Array<{ type: string }>): any {
  const node: any = { type: 'text', text };
  if (marks) node.marks = marks;
  return node;
}

function paragraph(content: any[] = []): any {
  return { type: 'paragraph', content: content.length ? content : undefined };
}

function heading(level: number, text: string): any {
  return { type: 'heading', attrs: { level }, content: [textNode(text)] };
}

function blockquote(text: string): any {
  return { type: 'blockquote', content: [paragraph([textNode(text)])] };
}

function bulletList(items: string[]): any {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [paragraph([textNode(item)])],
    })),
  };
}

function tableRow(cells: string[], header = false): any {
  const cellType = header ? 'tableHeader' : 'tableCell';
  return {
    type: 'tableRow',
    content: cells.map(text => ({
      type: cellType,
      content: [paragraph([textNode(String(text ?? ''))])],
    })),
  };
}

function table(headers: string[], rows: string[][]): any {
  return {
    type: 'table',
    content: [
      tableRow(headers, true),
      ...rows.map(r => tableRow(r)),
    ],
  };
}

// --- Category formatters ---

function formatSsl(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const rows: string[][] = [];
  if (data.subject?.CN) rows.push(['CN', data.subject.CN]);
  if (data.issuer?.O) rows.push(['Issuer', data.issuer.O]);
  if (data.issuer?.CN) rows.push(['Issuer CN', data.issuer.CN]);
  if (data.valid_from) rows.push(['Valid from', data.valid_from]);
  if (data.valid_to) rows.push(['Valid to', data.valid_to]);
  if (data.fingerprint) rows.push(['Fingerprint', data.fingerprint]);
  if (data.serialNumber) rows.push(['Serial', data.serialNumber]);
  if (data.subjectaltname) rows.push(['SAN', data.subjectaltname]);
  if (!rows.length) return [paragraph([textNode(JSON.stringify(data, null, 2).substring(0, 500))])];
  return [table(['Champ', 'Valeur'], rows)];
}

function formatDomain(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const whois = data.whoisData || data;
  if (typeof whois === 'string') return [paragraph([textNode(whois.substring(0, 2000))])];
  if (typeof whois === 'object') {
    const rows: string[][] = [];
    const keys = ['domainName', 'registrar', 'creationDate', 'expirationDate', 'updatedDate', 'registrant', 'nameServer', 'status'];
    for (const key of keys) {
      if (whois[key]) {
        const val = Array.isArray(whois[key]) ? whois[key].join(', ') : String(whois[key]);
        rows.push([key, val]);
      }
    }
    if (!rows.length) {
      // Fallback: show all keys
      for (const [k, v] of Object.entries(whois)) {
        if (v && typeof v !== 'object') rows.push([k, String(v)]);
      }
    }
    if (rows.length) return [table(['Champ', 'Valeur'], rows)];
  }
  return [paragraph([textNode('Non disponible')])];
}

function formatHeaders(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const headers = data.headerResponse || data;
  if (typeof headers !== 'object') return [paragraph([textNode(String(headers))])];
  const rows: string[][] = [];
  for (const [key, val] of Object.entries(headers)) {
    if (!val) continue;
    const strVal = typeof val === 'string' ? val : JSON.stringify(val);
    // Skip long report-to / nel JSON blobs
    if (strVal.length > 300) continue;
    rows.push([key, strVal]);
  }
  if (!rows.length) return [paragraph([textNode('Aucun header')])];
  return [table(['Header', 'Valeur'], rows)];
}

function formatDns(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const rows: string[][] = [];

  // A records
  if (data.A && Array.isArray(data.A)) {
    for (const a of data.A) rows.push(['A', String(a)]);
  }
  // AAAA records
  if (data.AAAA && Array.isArray(data.AAAA)) {
    for (const a of data.AAAA) rows.push(['AAAA', String(a)]);
  }
  // MX from TXT field (web-check stores exchange/priority objects)
  if (data.TXT && Array.isArray(data.TXT)) {
    for (const mx of data.TXT) {
      if (mx.exchange) {
        rows.push(['MX', `${mx.exchange} (priority: ${mx.priority ?? '?'})`]);
      } else if (typeof mx === 'string') {
        rows.push(['TXT', mx]);
      }
    }
  }
  // MX records direct
  if (data.MX && Array.isArray(data.MX)) {
    for (const mx of data.MX) {
      if (mx.exchange) {
        rows.push(['MX', `${mx.exchange} (priority: ${mx.priority ?? '?'})`]);
      }
    }
  }
  // NS from CNAME field
  if (data.CNAME && Array.isArray(data.CNAME)) {
    for (const ns of data.CNAME) rows.push(['NS', String(ns)]);
  }
  // NS direct
  if (data.NS && Array.isArray(data.NS)) {
    for (const ns of data.NS) rows.push(['NS', String(ns)]);
  }
  // nameservers
  if (data.nameservers && Array.isArray(data.nameservers)) {
    for (const ns of data.nameservers) rows.push(['Nameserver', String(ns)]);
  }
  if (!rows.length) return [paragraph([textNode('Aucun enregistrement DNS')])];
  return [table(['Type', 'Valeur'], rows)];
}

function formatHttpSecurity(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const rows: string[][] = [];
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'boolean') {
      rows.push([key, val ? 'Actif' : 'Inactif']);
    } else if (typeof val === 'object' && val !== null && 'present' in (val as any)) {
      rows.push([key, (val as any).present ? 'Actif' : 'Inactif']);
    }
  }
  if (!rows.length) return [paragraph([textNode('Aucune donnee')])];
  return [table(['Header', 'Statut'], rows)];
}

function formatSocialTags(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const rows: string[][] = [];
  if (data.title) rows.push(['Title', data.title]);
  if (data.description) rows.push(['Description', data.description]);
  if (data.canonicalUrl) rows.push(['URL', data.canonicalUrl]);
  if (data.ogImage) rows.push(['OG Image', data.ogImage]);
  if (data.favicon) rows.push(['Favicon', data.favicon]);
  if (data.generator) rows.push(['Generator', data.generator]);
  if (data.themeColor) rows.push(['Theme Color', data.themeColor]);
  if (!rows.length) return [paragraph([textNode('Aucune meta')])];
  return [table(['Champ', 'Valeur'], rows)];
}

function formatTraceRoute(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const hops = Array.isArray(data) ? data : data.result || [];
  const items: string[] = [];
  for (const hop of hops) {
    if (!hop || hop === false) continue;
    if (hop.ip) {
      items.push(`${hop.ip} — ${hop.rtt ?? '?'} ms`);
    } else if (typeof hop === 'string') {
      items.push(hop);
    }
  }
  if (!items.length) return [paragraph([textNode('Aucun hop')])];
  return [bulletList(items)];
}

function formatFirewall(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const items: string[] = [];
  items.push(`WAF: ${data.hasWaf ? 'Oui' : 'Non'}`);
  if (data.waf) items.push(`Type: ${data.waf}`);
  return [bulletList(items)];
}

function formatDnssec(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const items: string[] = [];
  if (data.isFound !== undefined) items.push(`DNSSEC: ${data.isFound ? 'Active' : 'Non active'}`);
  if (data.DNSKEY !== undefined) items.push(`DNSKEY: ${data.DNSKEY ? 'Present' : 'Absent'}`);
  if (data.DS !== undefined) items.push(`DS: ${data.DS ? 'Present' : 'Absent'}`);
  if (data.RRSIG !== undefined) items.push(`RRSIG: ${data.RRSIG ? 'Present' : 'Absent'}`);
  if (!items.length) return [paragraph([textNode(JSON.stringify(data))])];
  return [bulletList(items)];
}

function formatHsts(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const items: string[] = [];
  if (data.compatible !== undefined) items.push(`HSTS: ${data.compatible ? 'Compatible' : 'Non compatible'}`);
  if (data.message) items.push(data.message);
  if (data.maxAge) items.push(`Max-Age: ${data.maxAge}`);
  if (data.includeSubDomains !== undefined) items.push(`Include Sub-Domains: ${data.includeSubDomains ? 'Oui' : 'Non'}`);
  if (data.preload !== undefined) items.push(`Preload: ${data.preload ? 'Oui' : 'Non'}`);
  if (!items.length) return [paragraph([textNode(JSON.stringify(data))])];
  return [bulletList(items)];
}

function formatThreats(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const rows: string[][] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === 'object' && 'error' in (val as any)) continue;
    if (typeof val === 'boolean') {
      rows.push([key, val ? 'Oui' : 'Non']);
    } else if (typeof val === 'object' && val !== null) {
      const v = val as any;
      if (v.is_safe !== undefined) rows.push([key, v.is_safe ? 'Safe' : 'Unsafe']);
      else if (v.result !== undefined) rows.push([key, String(v.result)]);
      else rows.push([key, JSON.stringify(val).substring(0, 200)]);
    } else {
      rows.push([key, String(val)]);
    }
  }
  if (!rows.length) return [paragraph([textNode('Aucune menace detectee')])];
  return [table(['Check', 'Resultat'], rows)];
}

function formatArchives(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const items: string[] = [];
  if (data.firstScan) items.push(`Premier scan: ${data.firstScan}`);
  if (data.lastScan) items.push(`Dernier scan: ${data.lastScan}`);
  if (data.totalScans !== undefined) items.push(`Total scans: ${data.totalScans}`);
  if (data.changeCount !== undefined) items.push(`Changements: ${data.changeCount}`);
  if (data.averagePageSize) items.push(`Taille moyenne: ${data.averagePageSize}`);
  if (!items.length) return [paragraph([textNode('Non disponible')])];
  return [bulletList(items)];
}

function formatRank(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  // Show latest rank, skip daily entries array
  if (data.rank) return [paragraph([textNode(`Rank: ${data.rank} — ${data.domain || ''}`)])];
  if (Array.isArray(data) && data.length > 0) {
    const latest = data[data.length - 1];
    return [paragraph([textNode(`Rank: ${latest.rank ?? '?'} — ${latest.domain || ''}`)])];
  }
  return [paragraph([textNode(JSON.stringify(data).substring(0, 200))])];
}

function formatLinkedPages(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const nodes: any[] = [];
  const internal = data.internal || [];
  const external = data.external || [];
  if (internal.length) {
    nodes.push(paragraph([textNode(`Liens internes (${internal.length}):`, [{ type: 'bold' }])]));
    nodes.push(bulletList(internal.slice(0, 20).map((l: any) => typeof l === 'string' ? l : l.href || l.url || JSON.stringify(l))));
    if (internal.length > 20) nodes.push(paragraph([textNode(`... et ${internal.length - 20} autres`)]));
  }
  if (external.length) {
    nodes.push(paragraph([textNode(`Liens externes (${external.length}):`, [{ type: 'bold' }])]));
    nodes.push(bulletList(external.slice(0, 20).map((l: any) => typeof l === 'string' ? l : l.href || l.url || JSON.stringify(l))));
    if (external.length > 20) nodes.push(paragraph([textNode(`... et ${external.length - 20} autres`)]));
  }
  if (!nodes.length) return [paragraph([textNode('Aucun lien')])];
  return nodes;
}

function formatRobotsTxt(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  if (typeof data === 'string') return [paragraph([textNode(data.substring(0, 2000))])];
  const rules = data.rules || data;
  if (Array.isArray(rules)) {
    const items = rules.slice(0, 30).map((r: any) => {
      if (typeof r === 'string') return r;
      const agent = r.userAgent || r['User-agent'] || '*';
      const directives: string[] = [];
      if (r.allow) directives.push(`Allow: ${Array.isArray(r.allow) ? r.allow.join(', ') : r.allow}`);
      if (r.disallow) directives.push(`Disallow: ${Array.isArray(r.disallow) ? r.disallow.join(', ') : r.disallow}`);
      return `User-agent: ${agent} — ${directives.join(' | ') || '(empty)'}`;
    });
    return [bulletList(items)];
  }
  return [paragraph([textNode(JSON.stringify(data).substring(0, 500))])];
}

function formatTxtRecords(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const records = Array.isArray(data) ? data : [data];
  const items: string[] = [];
  for (const r of records) {
    if (typeof r === 'string') {
      items.push(r);
    } else if (Array.isArray(r)) {
      items.push(r.join(''));
    }
  }
  if (!items.length) return [paragraph([textNode('Aucun TXT record')])];
  return [bulletList(items)];
}

function formatBlockLists(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  if (Array.isArray(data)) {
    const rows = data.map((entry: any) => [
      entry.server || entry.name || '?',
      entry.blocked ? 'Oui' : 'Non',
    ]);
    if (rows.length) return [table(['Serveur', 'Bloque'], rows)];
  }
  if (typeof data === 'object') {
    const rows: string[][] = [];
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'boolean') rows.push([key, val ? 'Oui' : 'Non']);
      else if (typeof val === 'object' && val !== null) {
        const v = val as any;
        rows.push([key, v.isListed ? 'Oui' : 'Non']);
      }
    }
    if (rows.length) return [table(['Serveur', 'Bloque'], rows)];
  }
  return [paragraph([textNode('Non disponible')])];
}

function formatSitemap(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const urls = Array.isArray(data) ? data : data.urls || data.sitemaps || [];
  if (!urls.length) return [paragraph([textNode('Aucun sitemap')])];
  const items = urls.slice(0, 30).map((u: any) => {
    if (typeof u === 'string') return u;
    const loc = u.loc || u.url || '';
    const lastmod = u.lastmod ? ` (${u.lastmod})` : '';
    return `${loc}${lastmod}`;
  });
  return [bulletList(items)];
}

function formatRedirects(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  const chain = Array.isArray(data) ? data : data.redirects || data.chain || [];
  if (!chain.length) {
    if (typeof data === 'object' && data.url) return [paragraph([textNode(`${data.url} (status: ${data.statusCode || '?'})`)])];
    return [paragraph([textNode('Aucune redirection')])];
  }
  const items = chain.map((r: any) => {
    if (typeof r === 'string') return r;
    return `${r.url || r.from || '?'} → ${r.redirectUrl || r.to || '?'} (${r.statusCode || r.status || '?'})`;
  });
  return [bulletList(items)];
}

function formatSecurityTxt(data: any): any[] {
  if (!data) return [paragraph([textNode('Non disponible')])];
  if (data.isPresent === false || data.present === false) return [paragraph([textNode('Security.txt absent')])];
  if (typeof data === 'string') return [paragraph([textNode(data.substring(0, 1000))])];
  const items: string[] = [];
  if (data.isPresent || data.present) items.push('Security.txt present');
  if (data.contact) items.push(`Contact: ${data.contact}`);
  if (data.policy) items.push(`Policy: ${data.policy}`);
  if (data.encryption) items.push(`Encryption: ${data.encryption}`);
  if (data.acknowledgments) items.push(`Acknowledgments: ${data.acknowledgments}`);
  if (data.content) items.push(String(data.content).substring(0, 500));
  if (!items.length) return [paragraph([textNode(JSON.stringify(data).substring(0, 300))])];
  return [bulletList(items)];
}

const FORMATTERS: Record<string, (data: any) => any[]> = {
  ssl: formatSsl,
  domain: formatDomain,
  headers: formatHeaders,
  dns: formatDns,
  'http-security': formatHttpSecurity,
  'social-tags': formatSocialTags,
  'trace-route': formatTraceRoute,
  firewall: formatFirewall,
  dnssec: formatDnssec,
  hsts: formatHsts,
  threats: formatThreats,
  archives: formatArchives,
  rank: formatRank,
  'linked-pages': formatLinkedPages,
  'robots-txt': formatRobotsTxt,
  'txt-records': formatTxtRecords,
  'block-lists': formatBlockLists,
  sitemap: formatSitemap,
  redirects: formatRedirects,
  'security-txt': formatSecurityTxt,
};

// --- Extract domain from web-check JSON ---

function extractDomain(data: Record<string, any>): string {
  // Try social-tags canonicalUrl first
  if (data['social-tags']?.canonicalUrl) {
    try {
      return new URL(data['social-tags'].canonicalUrl).hostname;
    } catch { /* ignore */ }
  }
  // Iterate all values looking for a URL
  for (const val of Object.values(data)) {
    if (!val || typeof val !== 'object') continue;
    for (const field of ['url', 'canonicalUrl', 'domain', 'hostname']) {
      const candidate = val[field];
      if (candidate && typeof candidate === 'string') {
        try {
          return new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`).hostname;
        } catch {
          // If it looks like a domain already
          if (candidate.includes('.') && !candidate.includes(' ')) return candidate;
        }
      }
    }
  }
  return 'unknown';
}

// --- Main controller ---

export async function importWebCheck(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { data, selectedCategories, parentId } = req.body;

    if (!data || typeof data !== 'object') {
      res.status(400).json({ message: 'Invalid web-check data' });
      return;
    }

    // Verify dossier exists and user has access
    const dossier = await Dossier.findById(id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }

    const domain = extractDomain(data);
    const date = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const categories: string[] = Array.isArray(selectedCategories) ? selectedCategories : Object.keys(CATEGORIES);

    // Build TipTap document
    const docContent: any[] = [
      heading(2, `🔍 ${domain} — Web-Check`),
      paragraph([textNode(`Extraction: ${date}`)]),
    ];

    for (const catKey of categories) {
      const cat = CATEGORIES[catKey];
      if (!cat) continue;

      const catData = data[catKey];
      if (catData === undefined || catData === null) continue;

      docContent.push(heading(3, `${cat.icon} ${cat.label}`));
      docContent.push(blockquote(cat.description));

      const formatter = FORMATTERS[catKey];
      if (formatter) {
        const formatted = formatter(catData);
        docContent.push(...formatted);
      } else {
        // Fallback: show raw JSON (truncated)
        const raw = JSON.stringify(catData, null, 2);
        docContent.push(paragraph([textNode(raw.substring(0, 500))]));
      }
    }

    const tiptapDoc = { type: 'doc', content: docContent };

    // Determine order
    const maxOrder = await DossierNode.findOne({ dossierId: id, parentId: parentId || null, deletedAt: null })
      .sort({ order: -1 })
      .select('order')
      .lean();

    const node = await DossierNode.create({
      dossierId: id,
      parentId: parentId || null,
      type: 'note' as const,
      title: `🔍 ${domain} — Web-Check`,
      content: tiptapDoc,
      order: (maxOrder?.order ?? -1) + 1,
    } as any);

    await logActivity(
      req.user!.userId,
      'import_webcheck',
      'node',
      (node as any)._id.toString(),
      { domain, categoriesCount: categories.length, dossierId: id },
      req.ip || '',
      req.headers['user-agent'] || '',
    );

    res.status(201).json({ node });
  } catch (err: any) {
    console.error('Web-check import error:', err);
    res.status(500).json({ message: err.message || 'Import failed' });
  }
}
