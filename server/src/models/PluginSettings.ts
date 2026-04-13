import mongoose, { Schema } from 'mongoose';
import { IPluginSettings } from '../types';

const pluginSettingsSchema = new Schema<IPluginSettings>(
  {
    mapbox: {
      apiKey: { type: String, default: '' },
      defaultStyle: { type: String, default: 'mapbox://styles/mapbox/dark-v11' },
      defaultCenter: { type: [Number], default: [2.3522, 48.8566] },
      defaultZoom: { type: Number, default: 5 },
    },
    ollama: {
      baseUrl: { type: String, default: process.env.OLLAMA_URL || 'http://localhost:11434' },
      selectedModel: { type: String, default: '' },
      enabled: { type: Boolean, default: false },
      reportPrompt: { type: String, default: `Tu es un analyste OSINT professionnel redisant un rapport d'investigation. Tu dois EXCLUSIVEMENT utiliser les donnees fournies ci-dessous. Ne fabrique AUCUNE information. Si une donnee est absente ou insuffisante, indique-le explicitement. Redige en francais, de maniere professionnelle, factuelle et concise.

REGLES STRICTES:
- Utilise UNIQUEMENT les donnees fournies (entites, notes, faits judiciaires, objectifs)
- N'invente AUCUN resultat de recherche, AUCUNE URL, AUCUN fait
- Cite les notes d'investigation comme sources primaires en les attribuant correctement
- Si des informations manquent pour une section, ecris "Aucune donnee disponible pour cette section"
- Utilise un ton neutre et objectif, adapte a un rapport officiel

DONNEES DU DOSSIER:
Titre: {{title}}
Description: {{description}}
Statut: {{status}}
Objectifs: {{objectives}}
Faits judiciaires: {{judicialFacts}}

ENTITES CONCERNEES:
{{entities}}

ENQUETEUR:
{{investigator}}

PIECES JOINTES AU DOSSIER:
{{linkedDocuments}}

MEDIAS ET DOCUMENTS (noeuds du dossier):
{{media}}

NOTES D'INVESTIGATION (sources primaires a exploiter):
{{notes}}

REDIGE LE RAPPORT EN SUIVANT EXACTEMENT CETTE STRUCTURE:

# Rapport d'investigation OSINT
## Dossier "{{title}}"

**Date du rapport:** {{date}}
**Enqueteur:** {{investigator}}
**Statut:** {{status}}

---

## 1. Contexte et objet de l'investigation
Presente le contexte du dossier en reformulant la description et les faits judiciaires. Explique clairement pourquoi cette investigation a ete ouverte et quel est son perimetre.

## 2. Objectifs de la recherche
Liste et detaille chaque objectif de l'investigation. Pour chaque objectif, precise les axes de recherche envisages.

## 3. Entites ciblees
Pour chaque entite fournie, presente:
- Son identite (nom, type)
- Sa description et son role dans l'investigation
- Les elements connus a son sujet

## 4. Pieces jointes et elements materiels
Liste les pieces jointes au dossier (photos, documents) et les medias. Pour chaque element, precise sa nature et son interet potentiel pour l'investigation. Si des photos d'entites sont disponibles, mentionne-les dans le contexte de l'entite concernee.

## 5. Synthese des recherches effectuees
A partir des notes d'investigation fournies, synthetise les recherches menees. Organise par entite ou par thematique selon ce qui est le plus pertinent. Pour chaque element:
- Ce qui a ete recherche
- Ce qui a ete trouve (en citant les notes)
- Ce qui reste a approfondir

IMPORTANT: Cette section doit etre substantielle et s'appuyer directement sur le contenu des notes d'investigation.

## 6. Resultats cles
Liste les decouvertes les plus significatives de l'investigation, classees par ordre d'importance. Chaque resultat doit etre factuel et directement tire des notes.

## 7. Zones d'ombre et pistes complementaires
Identifie:
- Les informations manquantes ou incompletes
- Les contradictions eventuelles dans les donnees
- Les pistes de recherche complementaires a envisager

## 8. Conclusion et preconisations
Synthese globale des resultats et recommandations concretes pour la suite de l'investigation.

---

*Toutes les recherches reprises dans ce rapport ont ete realisees en sources ouvertes (OSINT) uniquement. Compte tenu de l'immensite des ressources disponibles sur Internet, certaines informations pertinentes pourraient ne pas avoir ete identifiees.*

*Ce rapport est clos le {{date}}.*

{{signature}}` },
    },
    claude: {
      apiKey: { type: String, default: '' },
      selectedModel: { type: String, default: 'claude-sonnet-4-20250514' },
      enabled: { type: Boolean, default: false },
    },
    openai: {
      apiKey: { type: String, default: '' },
      selectedModel: { type: String, default: 'gpt-4o' },
      enabled: { type: Boolean, default: false },
    },
    aiProvider: { type: String, enum: ['ollama', 'claude', 'openai'], default: 'ollama' },
    aiIndividualMode: { type: Boolean, default: false },
    aiDisclaimerMessage: { type: String, default: "Attention : vous allez utiliser un service d'intelligence artificielle commercial. Les donnees du dossier seront envoyees aux serveurs du fournisseur (Anthropic pour Claude, OpenAI pour ChatGPT). Assurez-vous de respecter les regles de confidentialite applicables a votre organisation. Aucune donnee classifiee ou sensible ne devrait etre transmise sans autorisation prealable." },
    shodan: {
      apiKey: { type: String, default: '' },
      enabled: { type: Boolean, default: false },
    },
    telegago: {
      apiKey: { type: String, default: '' },
      enabled: { type: Boolean, default: true },
    },
  },
  { collection: 'pluginsettings' }
);

export default mongoose.model<IPluginSettings>('PluginSettings', pluginSettingsSchema);
