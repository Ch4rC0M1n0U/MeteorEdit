import puppeteer from 'puppeteer';

interface CertVerification {
  verifiedAt: Date;
  status: string;
  computedHash: string | null;
}

interface CertRecord {
  _id?: string;
  fileHash: string;
  capturedAt: Date;
  fileSize: number;
  sourceUrl: string | null;
  evidenceType: string;
  capturedBy: { firstName: string; lastName: string };
  verifications: CertVerification[];
}

export async function generateEvidenceCertificate(
  record: CertRecord,
  node: { title: string; type: string },
  dossier: { title: string }
): Promise<Buffer> {
  const dateOpts: Intl.DateTimeFormatOptions = {
    dateStyle: 'full', timeStyle: 'long', timeZone: 'Europe/Paris',
  };
  const capturedDate = new Date(record.capturedAt).toLocaleDateString('fr-FR', dateOpts);

  const typeLabels: Record<string, string> = {
    file: 'Fichier', screenshot: 'Capture ecran', clip: 'Clip web',
  };

  const nodeTypeLabels: Record<string, string> = {
    note: 'Note', document: 'Document', mindmap: 'Mind Map',
    map: 'Carte', dataset: 'Dataset', folder: 'Dossier',
  };

  const verificationsHtml = record.verifications.length > 0
    ? `<table class="verif-table">
        <thead><tr><th>Date</th><th>Statut</th><th>Hash calcule</th></tr></thead>
        <tbody>
          ${record.verifications.map(v => `
            <tr>
              <td>${new Date(v.verifiedAt).toLocaleDateString('fr-FR', dateOpts)}</td>
              <td class="status-${v.status}">${v.status === 'valid' ? 'Valide' : v.status === 'tampered' ? 'Altere' : 'Manquant'}</td>
              <td class="hash">${v.computedHash || '\u2014'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
    : '<p class="empty">Aucune verification effectuee</p>';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 40px 50px; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; font-size: 13px; line-height: 1.6; }
  .header { text-align: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #3b82f6; margin: 0 0 4px; letter-spacing: 1px; }
  .header .subtitle { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 2px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
  .field { display: flex; margin-bottom: 6px; }
  .field-label { width: 200px; font-weight: 600; color: #475569; flex-shrink: 0; }
  .field-value { color: #1a1a2e; }
  .hash { font-family: 'Courier New', monospace; font-size: 11px; word-break: break-all; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
  .verif-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .verif-table th { background: #f1f5f9; padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; font-weight: 700; color: #475569; }
  .verif-table td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  .verif-table .hash { padding: 4px 6px; font-size: 10px; }
  .status-valid { color: #16a34a; font-weight: 700; }
  .status-tampered { color: #dc2626; font-weight: 700; }
  .status-missing { color: #d97706; font-weight: 700; }
  .empty { color: #94a3b8; font-style: italic; }
  .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .ref { font-family: monospace; font-size: 10px; color: #94a3b8; text-align: center; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="header">
    <h1>Certificat d'Integrite de Preuve Numerique</h1>
    <div class="subtitle">MeteorEdit \u2014 Plateforme OSINT</div>
  </div>

  <div class="ref">REF: ${record._id || 'N/A'}</div>

  <div class="section">
    <div class="section-title">Element de preuve</div>
    <div class="field"><span class="field-label">Titre</span><span class="field-value">${node.title}</span></div>
    <div class="field"><span class="field-label">Type de node</span><span class="field-value">${nodeTypeLabels[node.type] || node.type}</span></div>
    <div class="field"><span class="field-label">Type de preuve</span><span class="field-value">${typeLabels[record.evidenceType] || record.evidenceType}</span></div>
    <div class="field"><span class="field-label">Dossier</span><span class="field-value">${dossier.title}</span></div>
    <div class="field"><span class="field-label">Taille du fichier</span><span class="field-value">${(record.fileSize / 1024).toFixed(1)} Ko</span></div>
    ${record.sourceUrl ? `<div class="field"><span class="field-label">URL source</span><span class="field-value">${record.sourceUrl}</span></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Empreinte cryptographique</div>
    <div class="field"><span class="field-label">Algorithme</span><span class="field-value">SHA-256</span></div>
    <div style="margin-top: 8px;"><span class="field-label" style="display: block; margin-bottom: 6px;">Hash de capture :</span></div>
    <div class="hash">${record.fileHash}</div>
  </div>

  <div class="section">
    <div class="section-title">Horodatage certifie</div>
    <div class="field"><span class="field-label">Date de capture</span><span class="field-value">${capturedDate}</span></div>
    <div class="field"><span class="field-label">Capture par</span><span class="field-value">${record.capturedBy.firstName} ${record.capturedBy.lastName}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Historique des verifications</div>
    ${verificationsHtml}
  </div>

  <div class="footer">
    Ce certificat a ete genere automatiquement par MeteorEdit.<br>
    L'empreinte SHA-256 est calculee au moment de la capture et ne peut etre modifiee.
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfUint8 = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return Buffer.from(pdfUint8);
}
