import { Response } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');
const PROFILES_DIR = path.join(UPLOAD_DIR, 'profiles');

/**
 * Download an external image to local storage.
 * Returns the local URL path or the original URL on failure.
 */
async function downloadExternalImage(imageUrl: string, serverUrl: string, prefix: string = 'elephantastic'): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('http')) return imageUrl;
  try {
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.log(`[Elephantastic] Image download failed: HTTP ${response.status} for ${imageUrl.substring(0, 80)}`);
      return imageUrl;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100) return imageUrl;

    const contentType = response.headers.get('content-type') || '';
    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('gif')) ext = '.gif';

    const filename = `${prefix}-${uuidv4().slice(0, 8)}${ext}`;
    const filePath = path.join(PROFILES_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`[Elephantastic] Image saved: ${filename} (${buffer.length} bytes)`);
    return `${serverUrl}/uploads/profiles/${filename}`;
  } catch (err: any) {
    console.log(`[Elephantastic] Image download error: ${err.message} for ${imageUrl.substring(0, 80)}`);
    return imageUrl; // Fallback to original URL
  }
}

// Provider icons (emoji) for Elephantastic import
const ELEPHANTASTIC_ICONS: Record<string, string> = {
  'Amazon': '\u{1F4E6}',
  'HLRLookup': '\u{1F4F1}',
  'CallApp': '\u{1F4DE}',
  'CallApp (2023-)': '\u{1F4DE}',
  'Eyecon': '\u{1F441}',
  'WhatsApp': '\u{1F4AC}',
  'Snapchat': '\u{1F47B}',
  'Snapchat (2023-)': '\u{1F47B}',
  'PayPal': '\u{1F4B3}',
  'PayPal (app)': '\u{1F4B3}',
  'Instagram': '\u{1F4F7}',
  'Facebook': '\u{1F465}',
  'Twitter': '\u{1F426}',
  'X': '\u{1D54F}',
  'Telegram': '\u{2708}',
  'TikTok': '\u{1F3B5}',
  'LinkedIn': '\u{1F4BC}',
  'Google': '\u{1F50D}',
  'Spotify': '\u{1F3B6}',
  'Discord': '\u{1F4AC}',
  'GitHub': '\u{1F4BB}',
  'Microsoft': '\u{1F5A5}',
  'Signal': '\u{1F510}',
  'Viber': '\u{1F4F1}',
  'Skype': '\u{260E}',
};

export async function exportJSON(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossier = await Dossier.findById(req.params.id);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier not found' });
      return;
    }
    const userId = req.user!.userId;
    if (dossier.owner.toString() !== userId && !dossier.collaborators.map(c => c.toString()).includes(userId)) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const nodes = await DossierNode.find({ dossierId: dossier._id }).sort({ order: 1 });

    const exportData = {
      dossier: dossier.toObject(),
      nodes: nodes.map(n => n.toObject()),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(req.user!.userId, 'export.json', 'dossier', dossier._id.toString(), { title: dossier.title, nodeCount: nodes.length }, ip, ua);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${dossier.title.replace(/[^a-zA-Z0-9]/g, '_')}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function importJSON(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { dossier: dossierData, nodes: nodesData } = req.body;
    if (!dossierData || !dossierData.title) {
      res.status(400).json({ message: 'Invalid import data: missing dossier or title' });
      return;
    }

    const userId = req.user!.userId;

    // Create new dossier from imported data (new owner, new IDs)
    const newDossier = await Dossier.create({
      title: dossierData.title + ' (import)',
      description: dossierData.description || '',
      status: dossierData.status || 'open',
      icon: dossierData.icon || null,
      objectives: dossierData.objectives || '',
      entities: dossierData.entities || [],
      judicialFacts: dossierData.judicialFacts || '',
      tags: dossierData.tags || [],
      investigator: dossierData.investigator || {},
      owner: userId,
      collaborators: [],
    });

    // Map old node IDs to new IDs
    const idMap = new Map<string, string>();
    if (Array.isArray(nodesData)) {
      // First pass: generate new IDs for all nodes
      for (const node of nodesData) {
        if (node._id) {
          idMap.set(node._id, new mongoose.Types.ObjectId().toString());
        }
      }

      // Second pass: create nodes with remapped IDs and parentIds
      for (const node of nodesData) {
        const newId = idMap.get(node._id);
        if (!newId) continue;

        const newParentId = node.parentId ? idMap.get(node.parentId) || null : null;

        await DossierNode.create({
          _id: newId,
          dossierId: newDossier._id,
          parentId: newParentId,
          type: node.type || 'note',
          title: node.title || 'Sans titre',
          order: node.order ?? 0,
          content: node.content || null,
          contentText: node.contentText || null,
          excalidrawData: node.excalidrawData || null,
          mapData: node.mapData || null,
          // Don't import file references (fileUrl, fileHash, etc.) as files aren't transferred
        });
      }
    }

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(userId, 'import.json', 'dossier', newDossier._id.toString(), {
      title: newDossier.title,
      nodeCount: idMap.size,
      originalTitle: dossierData.title,
    }, ip, ua);

    res.status(201).json(newDossier);
  } catch (error) {
    console.error('Import failed:', error);
    res.status(500).json({ message: 'Import failed' });
  }
}

/**
 * Build TipTap content for an Elephantastic entry.
 */
async function buildElephantasticNote(item: any, serverUrl: string): Promise<any> {
  const collection = item.collection || 'Unknown';
  const baseName = collection.replace(/\s*\(.*\)$/, '');
  const icon = ELEPHANTASTIC_ICONS[collection] || ELEPHANTASTIC_ICONS[baseName] || '\u{1F310}';

  const content: any[] = [];

  // Heading with provider icon
  content.push({
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: `${icon} ${collection}` }],
  });

  // Category + date
  const catLabels: Record<string, string> = {
    social: 'Réseau social', personal: 'Personnel', technical: 'Technique', checker: 'Vérification',
  };
  const catText = catLabels[item.category_id] || item.category_id || '';
  if (catText || item.created_at) {
    const parts: string[] = [];
    if (catText) parts.push(`Catégorie : ${catText}`);
    if (item.created_at) parts.push(`Date : ${item.created_at}`);
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: parts.join(' — ') }],
    });
  }

  // Collect all image URLs from original data
  const imageUrls: Array<{ url: string; label: string }> = [];
  const orig = item.original || {};

  // Direct photo fields
  if (item.photoUrl) imageUrls.push({ url: item.photoUrl, label: `Photo ${collection}` });
  // Scan common image fields in original
  if (orig.picture && !imageUrls.some(i => i.url === orig.picture)) {
    imageUrls.push({ url: orig.picture, label: `Photo ${collection}` });
  }
  if (orig.photo_url && !imageUrls.some(i => i.url === orig.photo_url)) {
    imageUrls.push({ url: orig.photo_url, label: `Photo ${collection}` });
  }
  if (orig.profile_picture && !imageUrls.some(i => i.url === orig.profile_picture)) {
    imageUrls.push({ url: orig.profile_picture, label: `Photo de profil` });
  }
  if (orig.avatar_url && !imageUrls.some(i => i.url === orig.avatar_url)) {
    imageUrls.push({ url: orig.avatar_url, label: `Avatar` });
  }
  if (orig.image && typeof orig.image === 'string' && orig.image.startsWith('http')) {
    imageUrls.push({ url: orig.image, label: `Image` });
  }
  if (orig.profile_image_url && !imageUrls.some(i => i.url === orig.profile_image_url)) {
    imageUrls.push({ url: orig.profile_image_url, label: `Photo de profil` });
  }

  // Deep scan: look for any string value in original that looks like an image URL
  function scanForImages(obj: any, prefix: string = '') {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && val.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)/i.test(val)) {
        if (!imageUrls.some(i => i.url === val)) {
          const label = prefix ? `${prefix}.${key}` : key;
          imageUrls.push({ url: val, label });
        }
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        scanForImages(val, prefix ? `${prefix}.${key}` : key);
      }
    }
  }
  scanForImages(orig);

  // Download and display all found images
  console.log(`[Elephantastic] ${collection}: found ${imageUrls.length} images`);
  if (imageUrls.length > 0) {
    for (const img of imageUrls) {
      const localUrl = await downloadExternalImage(img.url, serverUrl, collection.toLowerCase().replace(/[^a-z0-9]/g, '-'));
      console.log(`[Elephantastic] Image: ${img.url.substring(0, 80)} -> ${localUrl.substring(0, 80)}`);
      content.push({
        type: 'paragraph',
        content: [{
          type: 'image',
          attrs: { src: localUrl, alt: img.label },
        }],
      });
    }
  }

  // Info table from original data
  const rows: Array<[string, string]> = [];

  if (item.names?.length) rows.push(['Nom', item.names.join(', ')]);
  if (item.usernames?.length) rows.push(["Nom d'utilisateur", item.usernames.join(', ')]);
  if (item.phones?.length) rows.push(['Téléphone', item.phones.join(', ')]);
  if (item.countries?.length) rows.push(['Pays', item.countries.map((c: string) => c.toUpperCase()).join(', ')]);
  if (item.identifiers?.length) rows.push(['Identifiants', item.identifiers.join(', ')]);

  // Extract key data from original
  if (orig.registered !== undefined) rows.push(['Inscrit', orig.registered ? 'Oui' : 'Non']);
  if (orig.numberExists !== undefined) rows.push(['Compte existant', orig.numberExists ? 'Oui' : 'Non']);
  if (orig.display_name) rows.push(['Nom affiché', orig.display_name]);
  if (orig.username) rows.push(["Nom d'utilisateur", orig.username]);
  if (orig.mutable_username) rows.push(['Username', orig.mutable_username]);
  if (orig.user_id) rows.push(['User ID', orig.user_id]);
  if (orig.account_id) rows.push(['Account ID', orig.account_id]);
  if (orig.external_id) rows.push(['External ID', orig.external_id]);
  if (orig.country) rows.push(['Pays', orig.country]);

  // Name from nested structures
  if (orig.name?.person_name) {
    const pn = orig.name.person_name;
    rows.push(['Nom complet', `${pn.given_name || ''} ${pn.surname || ''}`.trim()]);
  }
  if (orig.user?.name) rows.push(['Nom (app)', orig.user.name]);

  // HLR/network details
  if (orig.live_status) rows.push(['Statut', orig.live_status]);
  if (orig.telephone_number_type) rows.push(['Type', orig.telephone_number_type]);
  if (orig.is_ported) rows.push(['Porté', orig.is_ported]);
  if (orig.original_network_details?.name) rows.push(['Opérateur', orig.original_network_details.name]);
  if (orig.original_network_details?.country_name) rows.push(['Pays opérateur', orig.original_network_details.country_name]);
  if (orig.current_network_details?.name && orig.current_network_details.name !== orig.original_network_details?.name) {
    rows.push(['Opérateur actuel', orig.current_network_details.name]);
  }

  // Address
  if (orig.address?.country_code) rows.push(['Code pays', orig.address.country_code]);
  if (orig.primary_address?.country_code && orig.primary_address.country_code !== orig.address?.country_code) {
    rows.push(['Pays principal', orig.primary_address.country_code]);
  }

  // Snapchat specific
  if (orig.bitmoji_avatar_id) rows.push(['Bitmoji ID', orig.bitmoji_avatar_id]);
  if (orig.bitmoji_selfie_id) rows.push(['Bitmoji Selfie ID', orig.bitmoji_selfie_id]);

  // PayPal specific
  if (orig.type) rows.push(['Type de compte', orig.type]);

  // Priority (CallerID)
  if (orig.priority !== undefined) rows.push(['Priorité', String(orig.priority)]);

  if (rows.length > 0) {
    const tableRows = rows.map(([label, value]) => ({
      type: 'tableRow',
      content: [
        {
          type: 'tableCell',
          attrs: { colspan: 1, rowspan: 1, colwidth: null },
          content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: label }] }],
        },
        {
          type: 'tableCell',
          attrs: { colspan: 1, rowspan: 1, colwidth: null },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
        },
      ],
    }));
    content.push({ type: 'table', content: tableRows });
  }

  // History section (Snapchat etc.)
  if (orig.history && Array.isArray(orig.history) && orig.history.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Historique' }],
    });
    const histItems = orig.history.map((h: any) => {
      const entries = Object.entries(h);
      if (entries.length === 0) return null;
      const [date, data] = entries[0] as [string, any];
      const details = typeof data === 'object' ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', ') : String(data);
      return {
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: `${date} — ${details}` }] }],
      };
    }).filter(Boolean);
    if (histItems.length > 0) {
      content.push({ type: 'bulletList', content: histItems });
    }
  }

  // Raw metadata as code block
  const displayOrig = { ...orig };
  // Remove fields already shown above
  delete displayOrig.phone;
  delete displayOrig.name;
  delete displayOrig.history;
  delete displayOrig.user;

  if (Object.keys(displayOrig).length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Données brutes' }],
    });
    content.push({
      type: 'codeBlock',
      attrs: { language: 'json' },
      content: [{ type: 'text', text: JSON.stringify(displayOrig, null, 2) }],
    });
  }

  return { type: 'doc', content };
}

/**
 * Import Elephantastic JSON data into a dossier.
 * POST /api/dossiers/:id/import-elephantastic
 * Body: { entityName, items, parentId? }
 */
export async function importElephantastic(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossierId = req.params.id as string;
    const { entityName, items, parentId } = req.body;
    const userId = req.user!.userId;
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';

    if (!entityName || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'entityName et items[] requis' });
      return;
    }

    // Verify dossier access
    const dossier = await Dossier.findById(dossierId);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier non trouvé' });
      return;
    }
    if (dossier.owner.toString() !== userId && !dossier.collaborators.map(c => c.toString()).includes(userId)) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }

    // Create parent folder for entity
    const maxOrder = await DossierNode.findOne({ dossierId, parentId: parentId || null })
      .sort({ order: -1 }).select('order').lean();
    const folderOrder = (maxOrder?.order ?? -1) + 1;

    const folder = await DossierNode.create({
      dossierId,
      parentId: parentId || null,
      type: 'folder',
      title: `\u{1F418} ${entityName}`,
      order: folderOrder,
    });

    const createdNodes: any[] = [folder.toObject()];
    const serverUrl = `${req.protocol}://${req.get('host')}`;

    // Create a note for each selected item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const baseName = (item.collection || 'Unknown').replace(/\s*\(.*\)$/, '');
      const icon = ELEPHANTASTIC_ICONS[item.collection] || ELEPHANTASTIC_ICONS[baseName] || '\u{1F310}';
      const noteTitle = `${icon} ${item.collection}`;

      const tiptapContent = await buildElephantasticNote(item, serverUrl);

      const note = await DossierNode.create({
        dossierId,
        parentId: folder._id,
        type: 'note',
        title: noteTitle,
        content: tiptapContent,
        order: i,
      });

      createdNodes.push(note.toObject());
    }

    await logActivity(userId, 'import.elephantastic', 'dossier', dossierId, {
      entityName,
      itemCount: items.length,
      folderId: folder._id.toString(),
    }, ip, ua);

    res.status(201).json({
      message: `Import réussi : ${items.length} notes créées`,
      nodes: createdNodes,
    });
  } catch (error) {
    console.error('Elephantastic import failed:', error);
    res.status(500).json({ message: 'Erreur lors de l\'import Elephantastic' });
  }
}

// Epieos service icons
const EPIEOS_ICONS: Record<string, string> = {
  hlrlookups: '\u{1F4F1}',
  whatsapp: '\u{1F4AC}',
  signal: '\u{1F510}',
  imo: '\u{1F4F2}',
  telegram: '\u{2708}',
  viber: '\u{1F4F1}',
  skype: '\u{260E}',
  instagram: '\u{1F4F7}',
  facebook: '\u{1F465}',
  twitter: '\u{1F426}',
  google: '\u{1F50D}',
  linkedin: '\u{1F4BC}',
  snapchat: '\u{1F47B}',
  tiktok: '\u{1F3B5}',
  spotify: '\u{1F3B6}',
  discord: '\u{1F4AC}',
  github: '\u{1F4BB}',
  amazon: '\u{1F4E6}',
  paypal: '\u{1F4B3}',
  microsoft: '\u{1F5A5}',
  apple: '\u{1F34E}',
};

/**
 * Build TipTap content for a single Epieos service entry.
 */
function buildEpieosNote(serviceName: string, serviceData: any): any {
  const icon = EPIEOS_ICONS[serviceName.toLowerCase()] || '\u{1F310}';
  const content: any[] = [];

  // Heading
  content.push({
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: `${icon} ${serviceName}` }],
  });

  // Build info table from all key/value pairs
  const rows: Array<[string, string]> = [];

  function flattenData(obj: any, prefix: string = '') {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      const label = prefix ? `${prefix}.${key}` : key;
      if (val === null || val === undefined) continue;
      if (Array.isArray(val)) {
        if (val.length === 0) continue;
        // Array of objects (e.g. device_info)
        if (typeof val[0] === 'object') {
          for (let i = 0; i < val.length; i++) {
            flattenData(val[i], `${label}[${i}]`);
          }
        } else {
          rows.push([label, val.join(', ')]);
        }
      } else if (typeof val === 'object') {
        flattenData(val, label);
      } else {
        rows.push([label, String(val)]);
      }
    }
  }

  flattenData(serviceData);

  if (rows.length > 0) {
    const tableRows = rows.map(([label, value]) => ({
      type: 'tableRow',
      content: [
        {
          type: 'tableCell',
          attrs: { colspan: 1, rowspan: 1, colwidth: null },
          content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: label }] }],
        },
        {
          type: 'tableCell',
          attrs: { colspan: 1, rowspan: 1, colwidth: null },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
        },
      ],
    }));
    content.push({ type: 'table', content: tableRows });
  }

  // Raw data as code block
  content.push({
    type: 'heading',
    attrs: { level: 3 },
    content: [{ type: 'text', text: 'Données brutes' }],
  });
  content.push({
    type: 'codeBlock',
    attrs: { language: 'json' },
    content: [{ type: 'text', text: JSON.stringify(serviceData, null, 2) }],
  });

  return { type: 'doc', content };
}

/**
 * Import Epieos JSON data into a dossier.
 * POST /api/dossiers/:id/import-epieos
 * Body: { query, services: [{ name, data }], parentId? }
 */
export async function importEpieos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dossierId = req.params.id as string;
    const { query, services, parentId } = req.body;
    const userId = req.user!.userId;
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';

    if (!query || !services || !Array.isArray(services) || services.length === 0) {
      res.status(400).json({ message: 'query et services[] requis' });
      return;
    }

    // Verify dossier access
    const dossier = await Dossier.findById(dossierId);
    if (!dossier) {
      res.status(404).json({ message: 'Dossier non trouvé' });
      return;
    }
    if (dossier.owner.toString() !== userId && !dossier.collaborators.map(c => c.toString()).includes(userId)) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }

    // Check for duplicate: folder whose title ends with the query (matches 🐘, 🔍, or any prefix)
    const folderTitle = `\u{1F50D} ${query}`;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingFolder = await DossierNode.findOne({
      dossierId,
      parentId: parentId || null,
      type: 'folder',
      title: { $regex: `${escapedQuery}$` },
      deletedAt: null,
    });

    let folder: any;
    let existingNotes: string[] = [];
    const createdNodes: any[] = [];

    if (existingFolder) {
      // Reuse existing folder, check which service notes already exist
      folder = existingFolder;
      const existingChildren = await DossierNode.find({
        dossierId,
        parentId: folder._id,
        deletedAt: null,
      }).lean();
      existingNotes = existingChildren.map((n: any) => n.title);
    } else {
      // Create parent folder
      const maxOrder = await DossierNode.findOne({ dossierId, parentId: parentId || null })
        .sort({ order: -1 }).select('order').lean();
      const folderOrder = (maxOrder?.order ?? -1) + 1;

      folder = await DossierNode.create({
        dossierId,
        parentId: parentId || null,
        type: 'folder',
        title: folderTitle,
        order: folderOrder,
      });
      createdNodes.push(folder.toObject());
    }

    // Get current max order in folder
    const maxChildOrder = await DossierNode.findOne({ dossierId, parentId: folder._id })
      .sort({ order: -1 }).select('order').lean();
    let nextOrder = (maxChildOrder?.order ?? -1) + 1;

    let skippedCount = 0;

    // Create a note for each selected service
    for (const svc of services) {
      const icon = EPIEOS_ICONS[svc.name.toLowerCase()] || '\u{1F310}';
      const noteTitle = `${icon} ${svc.name}`;

      // Skip duplicates
      if (existingNotes.includes(noteTitle)) {
        skippedCount++;
        continue;
      }

      const tiptapContent = buildEpieosNote(svc.name, svc.data);

      const note = await DossierNode.create({
        dossierId,
        parentId: folder._id,
        type: 'note',
        title: noteTitle,
        content: tiptapContent,
        order: nextOrder++,
      });

      createdNodes.push(note.toObject());
    }

    await logActivity(userId, 'import.epieos', 'dossier', dossierId, {
      query,
      serviceCount: services.length,
      createdCount: createdNodes.length - (existingFolder ? 0 : 1),
      skippedCount,
      folderId: folder._id.toString(),
    }, ip, ua);

    res.status(201).json({
      message: `Import réussi : ${createdNodes.length} éléments créés, ${skippedCount} doublons ignorés`,
      nodes: existingFolder ? [...[folder.toObject()], ...createdNodes] : createdNodes,
      skippedCount,
    });
  } catch (error) {
    console.error('Epieos import failed:', error);
    res.status(500).json({ message: 'Erreur lors de l\'import Epieos' });
  }
}
