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
      baseUrl: { type: String, default: 'http://localhost:11434' },
      selectedModel: { type: String, default: '' },
      enabled: { type: Boolean, default: false },
      reportPrompt: { type: String, default: `Tu es un analyste OSINT professionnel. Redige un rapport d'investigation structure en suivant EXACTEMENT le format ci-dessous. Utilise les donnees fournies pour remplir chaque section. Redige en francais, de maniere professionnelle et factuelle.

Donnees du dossier:
- Titre: {{title}}
- Description: {{description}}
- Statut: {{status}}
- Objectifs: {{objectives}}
- Faits judiciaires: {{judicialFacts}}
- Entites: {{entities}}
- Enqueteur: {{investigator}}
- Notes d'investigation: {{notes}}

FORMAT DU RAPPORT A SUIVRE STRICTEMENT:

# Rapport OSINT
## Dossier "{{title}}"

## Entites concernees
Les recherches demandees par l'enqueteur portent sur les entites suivantes:
[Liste detaillee des entites avec leurs types et descriptions]

## Objectifs de la recherche OSINT
Les objectifs sont definis comme suit:
[Objectifs detailles du dossier]

## Synthese des faits
[Resume des faits judiciaires et du contexte de l'enquete]

## Resume des recherches et des resultats
Les recherches en sources ouvertes ont ete menees sur Internet. Il convient de souligner que, compte tenu de l'immensite de ce reseau et de la multiplicite des ressources disponibles, certaines informations pertinentes pourraient ne pas avoir ete identifiees.
Note: toutes les recherches reprises dans ce rapport ont ete realisees en sources ouvertes uniquement.
[Resume global des resultats]

## Recherches en source ouverte
[Detail des recherches effectuees pour chaque entite]

## Exploration des ressources web et reseaux sociaux
[Resultats detailles des recherches web et reseaux sociaux par entite]

## Conclusion
[Synthese des resultats, recommandations pour la suite de l'enquete, et preconisations]

Ce rapport est clos le {{date}}.
{{signature}}` },
    },
  },
  { collection: 'pluginsettings' }
);

export default mongoose.model<IPluginSettings>('PluginSettings', pluginSettingsSchema);
