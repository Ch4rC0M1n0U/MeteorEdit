import { Response } from 'express';
import { Types } from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import {
  searchByName,
  searchByAddress,
  getByCbeNumber,
  getJuridicalForms,
  getCompaniesByJuridicalForm,
  formatVatBE,
  BceApiError,
  type BceCompany,
} from '../services/bceApi';
import { getDecryptedToken } from './externalTokensController';
import { logActivity } from '../utils/activityLogger';

function getRequestMeta(req: AuthRequest): { ip: string; ua: string } {
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';
  return { ip, ua };
}

function handleBceError(err: unknown, res: Response): void {
  if (err instanceof BceApiError) {
    res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({ message: err.message });
    return;
  }
  if (err instanceof Error && err.message.includes('No bce API token')) {
    res.status(412).json({ message: err.message });
    return;
  }
  res.status(500).json({ message: err instanceof Error ? err.message : 'Server error' });
}

function pickLang(req: AuthRequest): 'fr' | 'nl' | 'de' | 'en' {
  const q = String(req.query.lang ?? '').toLowerCase();
  if (q === 'nl' || q === 'de' || q === 'en') return q;
  return 'fr';
}

export async function searchName(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = await getDecryptedToken(req.user!.userId, 'bce');
    const name = String(req.query.name ?? '').trim();
    if (!name) { res.status(400).json({ message: 'name is required' }); return; }
    const postCodeRaw = req.query.post_code;
    const postCode = postCodeRaw ? Number(postCodeRaw) : undefined;
    const data = await searchByName(token, name, postCode, pickLang(req));
    res.json(data);
  } catch (err) { handleBceError(err, res); }
}

export async function searchAddress(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = await getDecryptedToken(req.user!.userId, 'bce');
    const street = req.query.street ? String(req.query.street) : undefined;
    const house_number = req.query.house_number ? String(req.query.house_number) : undefined;
    const city = req.query.city ? String(req.query.city) : undefined;
    const post_code = req.query.post_code ? Number(req.query.post_code) : undefined;
    if (!street && !city && !post_code && !house_number) {
      res.status(400).json({ message: 'At least one address field required' });
      return;
    }
    const data = await searchByAddress(token, { street, house_number, city, post_code }, pickLang(req));
    res.json(data);
  } catch (err) { handleBceError(err, res); }
}

export async function getCompany(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = await getDecryptedToken(req.user!.userId, 'bce');
    const cbe = String(req.params.cbeNumber);
    const data = await getByCbeNumber(token, cbe, pickLang(req));
    res.json({ data });
  } catch (err) { handleBceError(err, res); }
}

export async function listJuridicalForms(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = await getDecryptedToken(req.user!.userId, 'bce');
    const data = await getJuridicalForms(token, pickLang(req));
    res.json(data);
  } catch (err) { handleBceError(err, res); }
}

export async function listByJuridicalForm(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = await getDecryptedToken(req.user!.userId, 'bce');
    const code = String(req.params.code);
    const page = req.query.page ? Number(req.query.page) : 1;
    const data = await getCompaniesByJuridicalForm(token, code, pickLang(req), page);
    res.json(data);
  } catch (err) { handleBceError(err, res); }
}

/**
 * Builds a TipTap JSON document from a BceCompany.
 */
function companyToTiptap(company: BceCompany): { type: 'doc'; content: any[] } {
  const vatBE = formatVatBE(company.cbe_number);
  const headingText = company.denomination_with_legal_form
    || company.denomination
    || vatBE;

  const content: any[] = [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: headingText }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'italic' }], text: `Source : Banque-Carrefour des Entreprises (BCE) — via cbeapi.be — extrait le ${new Date().toLocaleDateString('fr-FR')}` },
      ],
    },
  ];

  // Identification
  content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Identification' }] });
  const idRows: Array<[string, string]> = [
    ['Numéro de TVA', vatBE],
    ['Numéro BCE (formaté)', company.cbe_number_formatted ?? ''],
    ['Dénomination', company.denomination ?? '—'],
  ];
  if (company.abbreviation) idRows.push(['Abréviation', company.abbreviation]);
  if (company.commercial_name) idRows.push(['Nom commercial', company.commercial_name]);
  if (company.branch_name) idRows.push(['Nom de l\'établissement', company.branch_name]);
  if (company.juridical_form) idRows.push(['Forme juridique', `${company.juridical_form}${company.juridical_form_short ? ` (${company.juridical_form_short})` : ''}`]);
  if (company.juridical_situation) idRows.push(['Situation juridique', company.juridical_situation]);
  if (company.status) idRows.push(['Statut', company.status]);
  if (company.start_date) idRows.push(['Date de début', company.start_date]);
  if (company.pretty_type) idRows.push(['Type', company.pretty_type]);

  for (const [label, value] of idRows) {
    content.push({
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: `${label} : ` },
        { type: 'text', text: value },
      ],
    });
  }

  // Address
  if (company.address?.full_address) {
    content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Adresse du siège' }] });
    content.push({ type: 'paragraph', content: [{ type: 'text', text: company.address.full_address }] });
  }

  // Contact
  const c = company.contact_infos;
  if (c && (c.email || c.phone || c.web)) {
    content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Contact' }] });
    if (c.email) content.push({ type: 'paragraph', content: [
      { type: 'text', marks: [{ type: 'bold' }], text: 'Email : ' },
      { type: 'text', marks: [{ type: 'link', attrs: { href: `mailto:${c.email}` } }], text: c.email },
    ] });
    if (c.phone) content.push({ type: 'paragraph', content: [
      { type: 'text', marks: [{ type: 'bold' }], text: 'Téléphone : ' },
      { type: 'text', text: c.phone },
    ] });
    if (c.web) content.push({ type: 'paragraph', content: [
      { type: 'text', marks: [{ type: 'bold' }], text: 'Site web : ' },
      { type: 'text', marks: [{ type: 'link', attrs: { href: c.web, target: '_blank' } }], text: c.web },
    ] });
  }

  // Establishments
  if (Array.isArray(company.establishments) && company.establishments.length > 0) {
    content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: `Établissements (${company.establishments.length})` }] });
    for (const e of company.establishments) {
      const line = `${e.establishment_number ?? ''} — ${e.full_address ?? ''}${e.type_of_address ? ` (${e.type_of_address})` : ''}`;
      content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
    }
  }

  // NACE activities
  if (Array.isArray(company.nace_activities) && company.nace_activities.length > 0) {
    content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Activités NACE' }] });
    for (const n of company.nace_activities) {
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: `[${n.code}]${n.classification === 'main' ? ' ★' : ''} ` },
          { type: 'text', text: `${n.description} (NACE ${n.nace_version})` },
        ],
      });
    }
  }

  return { type: 'doc', content };
}

/**
 * POST /api/bce/export
 * body: { dossierId, parentId?, vatNumbers: string[] }
 * Creates one note per VAT number, formatted as BE0123456789.
 */
export async function exportToNotes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { dossierId, parentId, vatNumbers } = req.body ?? {};
    if (!dossierId || !Types.ObjectId.isValid(dossierId)) {
      res.status(400).json({ message: 'Invalid dossierId' });
      return;
    }
    if (!Array.isArray(vatNumbers) || vatNumbers.length === 0) {
      res.status(400).json({ message: 'vatNumbers must be a non-empty array' });
      return;
    }
    if (vatNumbers.length > 50) {
      res.status(400).json({ message: 'Cannot export more than 50 companies at once' });
      return;
    }

    const dossier = await Dossier.findOne({
      _id: dossierId,
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id').lean();
    if (!dossier) {
      res.status(403).json({ message: 'Access denied to this dossier' });
      return;
    }

    const token = await getDecryptedToken(userId, 'bce');
    const lang = pickLang(req);

    // Find or create a "BCE" folder under the dossier root
    let folder = await DossierNode.findOne({
      dossierId,
      type: 'folder',
      title: 'BCE',
      parentId: parentId || null,
    });
    if (!folder) {
      folder = await DossierNode.create({
        dossierId,
        parentId: parentId || null,
        type: 'folder',
        title: 'BCE',
        order: 999,
      });
    }

    const created: Array<{ vat: string; nodeId: string; title: string }> = [];
    const errors: Array<{ vat: string; message: string }> = [];

    for (const raw of vatNumbers) {
      const vat = String(raw);
      try {
        const company = await getByCbeNumber(token, vat, lang);
        const tiptap = companyToTiptap(company);
        const vatBE = formatVatBE(company.cbe_number);
        const title = company.denomination
          ? `${company.denomination} — ${vatBE}`
          : vatBE;
        const node = await DossierNode.create({
          dossierId,
          parentId: folder._id,
          type: 'note',
          title,
          content: tiptap,
          contentText: title,
          order: 0,
        });
        created.push({ vat: vatBE, nodeId: String(node._id), title });
      } catch (err) {
        errors.push({ vat, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const { ip, ua } = getRequestMeta(req);
    await logActivity(userId, 'bce.export', 'dossier', String(dossierId), {
      created: created.length,
      errors: errors.length,
      vats: created.map((c) => c.vat),
    }, ip, ua);

    res.status(201).json({
      created,
      errors,
      folderId: String(folder._id),
    });
  } catch (err) {
    handleBceError(err, res);
  }
}
