# Refonte des templates PDF/DOCX — Design

**Date :** 2026-03-12
**Objectif :** Refonte complete du systeme d'export PDF et DOCX pour atteindre une fidelite maximale au contenu TipTap, un rendu visuel professionnel, et des fonctionnalites structurelles (TOC, numerotation).

**Approche retenue :** Refonte progressive du systeme existant (jsPDF + docx.js), sans changement de librairie.

---

## 1. Convertisseur TipTap riche

### Nouveau fichier : `client/src/utils/contentBlocks.ts`

Remplace `extractContentBlocks()` par un convertisseur complet qui preserve la structure TipTap.

### Types ContentBlock

```typescript
type InlineMark = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;       // ex: #ff0000
  highlight?: string;   // ex: #ffff00
  link?: string;        // href
};

type ContentBlock =
  | { type: 'text'; text: string; marks: InlineMark }
  | { type: 'paragraph'; children: ContentBlock[]; align?: string }
  | { type: 'heading'; level: 1-6; children: ContentBlock[] }
  | { type: 'bulletList'; items: ContentBlock[][] }
  | { type: 'orderedList'; items: ContentBlock[][]; start?: number }
  | { type: 'blockquote'; children: ContentBlock[] }
  | { type: 'codeBlock'; text: string; language?: string }
  | { type: 'table'; rows: ContentBlock[][][] }  // rows > cells > content
  | { type: 'image'; src: string; alt?: string; width?: number; height?: number }
  | { type: 'hardBreak' }
```

### Logique

- Walk recursif du JSON TipTap
- Chaque node type mappe vers un ContentBlock
- Les `marks` TipTap (bold, italic, link, textStyle, highlight) sont preserves sur les blocs `text`
- Fonction unique `convertTipTapToBlocks(json): ContentBlock[]` partagee entre PDF et DOCX

---

## 2. PdfBuilder enrichi

### Nouvelles methodes

| Methode | Description |
|---------|-------------|
| `renderBlocks(blocks)` | Orchestrateur : itere et dispatch vers la bonne methode |
| `addRichText(children, align?)` | Paragraphe avec marks inline (gras, italique, souligne, barre, couleur, surlignage). Decoupe en segments, positionne chaque segment avec `getTextWidth()` |
| `addList(items, ordered, level?)` | Listes a puces/numerotees. Indentation +8mm/niveau. Bullet "•" ou "1." Support recursif pour imbrication |
| `addTable(rows)` | Calcul auto des largeurs colonnes. Header row stylee (`table.headerBgColor`). Alternance couleurs. Bordures. Word-wrap cellules |
| `addBlockquote(children)` | Decalage gauche 10mm, bordure gauche 2px dans `header.lineColor`, italique |
| `addCodeBlock(text)` | Font Courier/monospace, fond #f5f5f5, padding 3mm, taille body.fontSize - 1 |

### Derivation des styles depuis le template existant

- **Listes** : heritent de `body` (police, taille, couleur)
- **Blockquotes** : derivent de `body` + bordure `header.lineColor`
- **Code blocks** : font monospace fixe + fond gris
- **Tableaux inline** : reprennent le style `table` configurable
- **TOC** : reprend les styles headings existants

Zero nouveau reglage dans l'UI du branding.

---

## 3. DOCX enrichi

Memes types de blocs, rendu via primitives docx.js natives :

| ContentBlock | Rendu DOCX |
|-------------|-----------|
| Rich text + marks | `TextRun` avec bold/italics/underline/strike/color/highlight |
| Listes | `Paragraph` avec `numbering` (AbstractNumbering + NumberingReference) |
| Tableaux | `Table` + `TableRow` + `TableCell` |
| Blockquotes | `Paragraph` avec indent gauche + bordure gauche |
| Code blocks | `Paragraph` avec font Courier New + shading gris |

---

## 4. Table des matieres (TOC)

### PDF
- **Double-pass** : 1er pass genere le contenu et collecte `{ title, level, sectionNumber, pageNumber }` par heading. 2e pass calcule la taille de la TOC, ajoute l'offset aux numeros de page, reconstruit le PDF avec TOC + contenu.
- Inseree apres le bloc titre/infos, avant le contenu
- Titre "Table des matieres" en h1 (sans numero)
- Format par entree : numero + titre ... numero de page
- Indentation : h1 0mm, h2 +8mm, h3 +16mm
- Style : police body, h1 en gras

### DOCX
- Champ `TableOfContents` natif docx.js
- Word regenere la TOC a l'ouverture du document

### UI
- Checkbox "Inclure la table des matieres" dans ExportSelectDialog (cochee par defaut)

---

## 5. Numerotation des sections

- Compteur `[h1, h2, h3]` maintenu pendant le tree walk
- H1 incremente index 0, reset h2/h3 → "1.", "2."
- H2 incremente index 1, reset h3 → "1.1", "2.1"
- H3 incremente index 2 → "1.1.1", "1.1.2"
- Prefixe au titre : "1.1 Compte Instagram"
- Identique dans PDF et DOCX

---

## 6. Support Unicode — Font embedding

### Font choisie : Noto Sans (Google Fonts, licence OFL)

- 3 variantes : Regular, Bold, Italic
- Subset latin-extended (suffisant pour FR/EN/NL)
- Taille estimee : ~300-400kb total
- Fichiers TTF dans `client/src/assets/fonts/`

### Integration jsPDF

- `doc.addFileToVFS('NotoSans-Regular.ttf', base64data)`
- `doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')`
- Idem pour bold et italic
- Lazy-loaded au premier export (pas dans le bundle initial)

### Impact

- Cote PDF : toutes les polices du branding mappent vers Noto Sans (limitation acceptee)
- Cote DOCX : le choix de police du branding reste effectif (Calibri, Arial, etc.)
- `sanitizeForPdf()` supprime — plus necessaire
- On garde seulement le nettoyage des zero-width chars et caracteres de controle

---

## 7. Bloc de cloture configurable

### Nouveau champ `city` dans le schema signature utilisateur

```typescript
signature: {
  title?: string;
  name?: string;
  service?: string;
  unit?: string;
  email?: string;
  city?: string;     // NOUVEAU — default "Bruxelles"
}
```

### Rendu
- `"{ville}, le {date}"` aligne a droite
- Si ville vide : juste la date
- Suivi de l'image signature et des infos signataire (existant)

### UI
- Champ texte "Ville" dans la section signature du profil utilisateur

### Serveur
- Champ `city` ajoute dans le schema Mongoose User.signature

---

## 8. Fichiers impactes

| Fichier | Changement |
|---------|-----------|
| `client/src/utils/contentBlocks.ts` | **NOUVEAU** — Convertisseur TipTap → ContentBlock[] |
| `client/src/assets/fonts/NotoSans-*.ttf` | **NOUVEAU** — Fonts TTF (3 variantes) |
| `client/src/utils/pdfTemplate.ts` | Refonte PdfBuilder : font embedding, nouvelles methodes de rendu riche, TOC, suppression sanitizeForPdf |
| `client/src/utils/docxTemplate.ts` | Nouvelles fonctions de rendu riche, TOC native |
| `client/src/components/dossier/DossierView.vue` | Utiliser contentBlocks, TOC, numerotation sections, closing configurable |
| `client/src/components/dossier/ExportSelectDialog.vue` | Checkbox TOC |
| `client/src/components/profile/ProfileTemplate.vue` | Preview mis a jour avec nouveaux types de blocs |
| `client/src/components/profile/ProfileSecurity.vue` | Champ ville signature |
| `server/src/models/User.ts` | Champ `city` dans signature schema |

---

## 9. Ce qui ne change PAS

- Systeme de template/branding (ProfileTemplate.vue) — memes reglages existants
- Tree walk (walkTreePdf/walkTreeDocx) — meme logique d'arborescence
- Logos header/footer — meme systeme
- Presets de template — meme systeme
- ExportSelectDialog — juste une checkbox TOC en plus
