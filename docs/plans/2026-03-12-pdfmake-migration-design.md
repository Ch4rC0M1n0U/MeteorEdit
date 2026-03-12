# Migration jsPDF → pdfmake — Design

**Date :** 2026-03-12
**Objectif :** Remplacer jsPDF par pdfmake pour l'export PDF afin d'obtenir un rendu fiable avec custom fonts, word-wrap natif, et une approche declarative.

**Raison :** jsPDF 4.2 a des problemes critiques — custom font embedding casse (glyphes corrompus), word-wrap manuel bugue, positionnement x/y fragile.

---

## 1. Architecture

### Flux

```
TipTap JSON → contentBlocks.ts (inchange) → ContentBlock[] → pdfmakeRenderer.ts (NOUVEAU) → docDefinition JSON → pdfmake → PDF blob
```

### Approche

pdfmake utilise une approche declarative : on construit un objet JSON `docDefinition` qui decrit le document (contenu, styles, headers/footers, fonts). pdfmake gere le layout, word-wrap, pagination automatiquement.

---

## 2. Fichiers impactes

| Fichier | Changement |
|---------|-----------|
| `client/src/utils/pdfmakeRenderer.ts` | **NOUVEAU** — Remplace pdfTemplate.ts. Convertit ContentBlock[] en docDefinition pdfmake |
| `client/src/utils/pdfmakeFonts.ts` | **NOUVEAU** — Remplace pdfFonts.ts. VFS fonts NotoSans (base64 lazy-loaded) |
| `client/src/utils/pdfTemplate.ts` | **SUPPRIME** — Remplace par pdfmakeRenderer.ts |
| `client/src/utils/pdfFonts.ts` | **SUPPRIME** — Remplace par pdfmakeFonts.ts |
| `client/src/components/dossier/DossierView.vue` | Adapte les appels PDF (walkTreePdf simplifie) |
| `client/src/components/profile/ProfileTemplate.vue` | Adapte le preview PDF |
| `client/src/utils/contentBlocks.ts` | **INCHANGE** |
| `client/src/utils/docxTemplate.ts` | **INCHANGE** |
| `client/src/components/dossier/ExportSelectDialog.vue` | **INCHANGE** |

---

## 3. Custom Fonts — NotoSans via VFS

pdfmake gere les fonts via un Virtual File System. Les TTF sont pre-encodes en base64.

### Fichier `pdfmakeFonts.ts`

```typescript
// Lazy-loaded — pas dans le bundle initial
export async function loadPdfMakeFonts() {
  const [regular, bold, italic] = await Promise.all([
    fetchAsBase64(notoRegularUrl),
    fetchAsBase64(notoBoldUrl),
    fetchAsBase64(notoItalicUrl),
  ]);
  return {
    vfs: {
      'NotoSans-Regular.ttf': regular,
      'NotoSans-Bold.ttf': bold,
      'NotoSans-Italic.ttf': italic,
    },
    fonts: {
      NotoSans: {
        normal: 'NotoSans-Regular.ttf',
        bold: 'NotoSans-Bold.ttf',
        italics: 'NotoSans-Italic.ttf',
        bolditalics: 'NotoSans-Bold.ttf',
      }
    }
  };
}
```

---

## 4. Mapping ContentBlock → pdfmake

| ContentBlock | pdfmake |
|---|---|
| `paragraph` + children | `{ text: [...runs], alignment }` |
| `text` + marks | `{ text, bold, italics, decoration, color, ... }` |
| `heading` | `{ text, style: 'h1'/'h2'/'h3' }` |
| `bulletList` | `{ ul: [...items] }` |
| `orderedList` | `{ ol: [...items], start }` |
| `blockquote` | Table 1 colonne avec bordure gauche, italique, marge |
| `codeBlock` | `{ text, font: 'Courier', background: '#f5f5f5' }` |
| `table` | `{ table: { body }, layout }` |
| `image` | `{ image: dataUrl, width, fit }` |
| `hardBreak` | `'\n'` |

### Fonction principale

```typescript
function blocksToContent(blocks: ContentBlock[]): pdfmake.Content[] {
  return blocks.map(block => {
    switch (block.type) {
      case 'paragraph': return { text: childrenToRuns(block.children), alignment: block.align };
      case 'heading': return { text: blocksToPlainText(block.children), style: `h${block.level}` };
      case 'bulletList': return { ul: block.items.map(item => blocksToContent(item)) };
      case 'orderedList': return { ol: block.items.map(item => blocksToContent(item)), start: block.start };
      case 'blockquote': return blockquoteToContent(block);
      case 'codeBlock': return { text: block.text, style: 'code' };
      case 'table': return tableToContent(block);
      case 'image': return { image: block.src, width: Math.min(block.width ?? 500, 500) };
      // ...
    }
  });
}
```

---

## 5. Branding → pdfmake styles

Le systeme de branding existant (`PdfTemplateConfig`) est converti en styles pdfmake :

```typescript
function templateToStyles(tpl: PdfTemplateConfig): Record<string, pdfmake.Style> {
  return {
    h1: {
      fontSize: tpl.headings.h1.fontSize,
      bold: tpl.headings.h1.bold,
      color: tpl.headings.h1.color,
      fillColor: tpl.headings.h1.bgColor || undefined,
      margin: [0, 7, 0, 4],
    },
    h2: { /* idem */ },
    h3: { /* idem */ },
    body: {
      fontSize: tpl.body.fontSize,
      color: tpl.body.color,
      font: 'NotoSans',
      lineHeight: tpl.spacing?.lineHeight || 1.4,
    },
    code: {
      font: 'Courier',
      fontSize: (tpl.body.fontSize || 10) - 1,
      background: '#f5f5f5',
    },
  };
}
```

### Header/Footer

pdfmake supporte des fonctions `header` et `footer` qui recoivent `currentPage` et `pageCount` :

```typescript
footer: (currentPage, pageCount) => ({
  columns: [
    { text: footerText, alignment: 'center', fontSize: 8 },
    { text: `Page ${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 8 },
  ],
  margin: [20, 0],
})
```

Les logos sont integres comme images dans le header.

---

## 6. TOC + Numerotation

- **TOC** : pdfmake supporte `toc: { title }` natif + `tocItem: true` sur les headings
- **Numerotation sections** : meme logique `SectionCounter` + `nextSectionNumber()` existante
- **Numeros de page** : natif pdfmake via `currentPage`/`pageCount` dans le footer

---

## 7. DossierView.vue — Changements

### Avant (jsPDF)

```typescript
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const b = await createPdfBuilder(doc, tpl, logos);
b.drawReportHeader(title, infoLines);
await walkTreePdf(nodes, null, 1, b, counter);
const blob = b.finalize();
```

### Apres (pdfmake)

```typescript
const content = await buildPdfContent(dossier, nodes, selectedIds, { includeToc, closingCity });
const blob = await generatePdfBlob(content, tpl);
```

L'orchestration (walkTree, TOC, signature) est internalisee dans `pdfmakeRenderer.ts`.

---

## 8. Ce qui ne change PAS

- `contentBlocks.ts` (convertisseur TipTap → ContentBlock[])
- `docxTemplate.ts` (export DOCX independant)
- `ExportSelectDialog.vue` (UI export)
- Systeme de branding/presets dans `ProfileTemplate.vue` (meme config, mapping different)
- Schema `PdfTemplateConfig` (reutilise tel quel)

---

## 9. Impact bundle

- Suppression : `jspdf` (~300kb)
- Ajout : `pdfmake` (~900kb) + fonts NotoSans VFS (~400kb)
- Net : +~1MB mais **lazy-loaded** via `import()` dynamique au moment de l'export
- Pas d'impact sur le chargement initial de l'app

---

## 10. Avantages attendus

- **Custom fonts** : NotoSans fonctionne nativement, support Unicode complet
- **Word-wrap** : automatique, plus de bugs de retour a la ligne
- **Layout** : gere par pdfmake (plus de positionnement x/y manuel)
- **Pagination** : automatique avec numeros de page natifs
- **Maintenance** : code declaratif beaucoup plus simple que l'imperatif jsPDF
