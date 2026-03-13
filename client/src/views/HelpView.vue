<template>
  <div class="help-root">
    <aside class="help-sidebar glass-card">
      <div class="help-sidebar-header">
        <v-icon size="20" class="mr-2">mdi-help-circle-outline</v-icon>
        <span>Aide</span>
      </div>

      <div class="help-search">
        <v-icon size="16" class="help-search-icon">mdi-magnify</v-icon>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher dans l'aide..."
          class="help-search-input"
          @input="onSearch"
        />
        <button v-if="searchQuery" class="help-search-clear" @click="searchQuery = ''; searchResults = []">
          <v-icon size="14">mdi-close</v-icon>
        </button>
      </div>

      <div v-if="searchResults.length" class="help-search-results">
        <button
          v-for="result in searchResults"
          :key="result.id"
          class="help-nav-item"
          :class="{ active: activeArticle === result.id }"
          @click="goToArticle(result.id)"
        >
          <v-icon size="14" class="mr-2">{{ result.icon }}</v-icon>
          <div class="help-nav-text">
            <span class="help-nav-title">{{ result.title }}</span>
            <span class="help-nav-match">{{ result.match }}</span>
          </div>
        </button>
      </div>

      <nav v-else class="help-nav">
        <div v-for="cat in categories" :key="cat.id" class="help-nav-group">
          <button class="help-nav-category" @click="toggleCategory(cat.id)">
            <v-icon size="14" class="mr-2">{{ cat.icon }}</v-icon>
            {{ cat.label }}
            <v-icon size="12" class="help-nav-chevron">{{ expandedCategories.has(cat.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
          </button>
          <div v-if="expandedCategories.has(cat.id)" class="help-nav-items">
            <button
              v-for="article in cat.articles"
              :key="article.id"
              class="help-nav-item"
              :class="{ active: activeArticle === article.id }"
              @click="goToArticle(article.id)"
            >
              {{ article.title }}
            </button>
          </div>
        </div>
      </nav>
    </aside>

    <main class="help-content">
      <div v-if="!activeArticle" class="help-welcome glass-card">
        <v-icon size="48" color="var(--me-accent)">mdi-book-open-variant</v-icon>
        <h1>Centre d'aide</h1>
        <p>Bienvenue dans l'aide de <strong>{{ brandingStore.appName }}</strong>. Sélectionnez une rubrique ou utilisez la recherche pour trouver rapidement ce dont vous avez besoin.</p>
        <div class="help-quick-cards">
          <button v-for="cat in categories" :key="cat.id" class="help-quick-card glass-card" @click="toggleCategory(cat.id); goToArticle(cat.articles[0]?.id)">
            <v-icon size="24">{{ cat.icon }}</v-icon>
            <span>{{ cat.label }}</span>
          </button>
        </div>
      </div>

      <article v-else class="help-article glass-card">
        <button class="help-back-btn" @click="activeArticle = null">
          <v-icon size="16">mdi-arrow-left</v-icon> Retour
        </button>
        <component :is="currentArticleComponent" />
      </article>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, type Component } from 'vue';
import { useBrandingStore } from '../stores/branding';

const brandingStore = useBrandingStore();
const searchQuery = ref('');
const activeArticle = ref<string | null>(null);
const expandedCategories = ref(new Set<string>(['getting-started']));

interface Article {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  articles: Article[];
}

const categories: Category[] = [
  {
    id: 'getting-started',
    label: 'Prise en main',
    icon: 'mdi-rocket-launch-outline',
    articles: [
      {
        id: 'gs-overview',
        title: 'Présentation générale',
        keywords: ['présentation', 'introduction', 'commencer', 'début', 'interface'],
        content: `<h2>Présentation générale</h2>
<p><strong>MeteorEdit</strong> est un outil de gestion d'enquêtes OSINT (Open Source Intelligence). Il vous permet d'organiser, analyser et documenter vos investigations numériques dans un environnement sécurisé et collaboratif.</p>
<h3>Interface principale</h3>
<ul>
<li><strong>Barre supérieure</strong> — Navigation, recherche globale, notifications, thème et menu utilisateur</li>
<li><strong>Tableau de bord</strong> — Liste de vos dossiers avec favoris et création rapide</li>
<li><strong>Espace dossier</strong> — Arborescence, éditeur de contenu et panneau d'informations</li>
</ul>
<h3>Concepts clés</h3>
<ul>
<li><strong>Dossier</strong> — Unité d'enquête contenant des noeuds organisés en arborescence</li>
<li><strong>Noeud</strong> — Élément du dossier : dossier, note, mindmap, carte, dataset, document ou média</li>
<li><strong>Collaborateur</strong> — Utilisateur ayant accès à votre dossier en temps réel</li>
</ul>`,
      },
      {
        id: 'gs-navigation',
        title: 'Navigation et raccourcis',
        keywords: ['navigation', 'raccourcis', 'clavier', 'ctrl', 'commande', 'palette', 'shortcut'],
        content: `<h2>Navigation et raccourcis clavier</h2>
<h3>Raccourcis globaux</h3>
<table>
<tr><td><kbd>Ctrl+K</kbd> ou <kbd>/</kbd></td><td>Ouvrir la palette de commandes</td></tr>
<tr><td><kbd>Suppr</kbd></td><td>Supprimer le noeud sélectionné (vers la corbeille)</td></tr>
<tr><td><kbd>Shift+Suppr</kbd></td><td>Supprimer définitivement sans confirmation</td></tr>
<tr><td><kbd>Échap</kbd></td><td>Quitter le mode focus / fermer les dialogues</td></tr>
</table>
<h3>Raccourcis éditeur (notes)</h3>
<table>
<tr><td><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd></td><td>Annuler / Rétablir</td></tr>
<tr><td><kbd>Ctrl+B</kbd></td><td>Gras</td></tr>
<tr><td><kbd>Ctrl+I</kbd></td><td>Italique</td></tr>
<tr><td><kbd>Ctrl+U</kbd></td><td>Souligné</td></tr>
<tr><td><kbd>Ctrl+K</kbd></td><td>Insérer un lien</td></tr>
</table>
<h3>Palette de commandes</h3>
<p>La palette de commandes (<kbd>Ctrl+K</kbd>) permet d'accéder rapidement à toutes les actions : créer un dossier, naviguer vers une page, changer de thème, etc.</p>`,
      },
      {
        id: 'gs-search',
        title: 'Recherche globale',
        keywords: ['recherche', 'search', 'chercher', 'trouver', 'filtre'],
        content: `<h2>Recherche globale</h2>
<p>La barre de recherche dans la barre supérieure permet de rechercher simultanément dans :</p>
<ul>
<li><strong>Les titres de dossiers</strong></li>
<li><strong>Le contenu des notes</strong> (texte extrait)</li>
<li><strong>Les titres des noeuds</strong></li>
</ul>
<p>Les résultats sont affichés en temps réel avec mise en surbrillance des correspondances. Cliquez sur un résultat pour ouvrir directement le dossier et sélectionner le noeud.</p>`,
      },
    ],
  },
  {
    id: 'dossiers',
    label: 'Dossiers',
    icon: 'mdi-folder-outline',
    articles: [
      {
        id: 'dos-create',
        title: 'Créer et gérer un dossier',
        keywords: ['dossier', 'créer', 'nouveau', 'supprimer', 'favoris', 'icône'],
        content: `<h2>Créer et gérer un dossier</h2>
<h3>Création</h3>
<p>Depuis le tableau de bord, cliquez sur <strong>Nouveau dossier</strong>. Renseignez un titre, une description optionnelle et choisissez une icône.</p>
<h3>Favoris</h3>
<p>Cliquez sur l'étoile d'un dossier pour l'ajouter à vos favoris. Ils apparaissent en haut du tableau de bord pour un accès rapide.</p>
<h3>Statut</h3>
<p>Un dossier peut être en statut : <strong>Ouvert</strong>, <strong>En cours</strong> ou <strong>Clôture</strong>. Modifiez-le depuis le panneau d'informations du dossier.</p>
<h3>Suppression</h3>
<p>La suppression d'un dossier est définitive. Une confirmation vous sera demandée.</p>`,
      },
      {
        id: 'dos-info',
        title: 'Informations du dossier',
        keywords: ['information', 'metadata', 'objectifs', 'entités', 'tags', 'enquêteur', 'judiciaire'],
        content: `<h2>Informations du dossier</h2>
<p>Le panneau d'informations (cliquez sur le titre du dossier ou l'icône info) contient :</p>
<h3>Metadata</h3>
<ul>
<li><strong>Titre et description</strong> — Identifient le dossier</li>
<li><strong>Objectifs de la recherche</strong> — Ce que vous cherchez à déterminer</li>
<li><strong>Faits judiciaires</strong> — Contexte juridique</li>
<li><strong>Tags</strong> — Classification par mots-clés</li>
</ul>
<h3>Enquêteur</h3>
<p>Renseignez les informations de l'enquêteur principal : nom, service, unité, téléphone, email.</p>
<h3>Entités</h3>
<p>Ajoutez des entités liées à l'enquête (personnes, téléphones, emails, réseaux sociaux, adresses IP, véhicules, IBAN, etc.). Chaque entité peut être enrichie par l'IA.</p>`,
      },
      {
        id: 'dos-collab',
        title: 'Collaboration',
        keywords: ['collaborateur', 'partage', 'temps réel', 'équipe', 'inviter'],
        content: `<h2>Collaboration</h2>
<p>Invitez des collaborateurs depuis le panneau d'informations du dossier.</p>
<h3>Temps réel</h3>
<ul>
<li><strong>Édition simultanée</strong> — Plusieurs utilisateurs peuvent éditer la même note en temps réel</li>
<li><strong>Curseurs en direct</strong> — Voyez où vos collaborateurs éditent</li>
<li><strong>Indicateurs de présence</strong> — Les avatars (ou initiales) des collaborateurs connectés au même dossier s'affichent dans la barre latérale, sous le titre du dossier, avec un point vert indiquant leur statut en ligne. Le nombre de collaborateurs en ligne est également affiché.</li>
</ul>
<h3>Mentions</h3>
<p>Dans une note, mentionnez un collaborateur avec <strong>@nom</strong> pour lui envoyer une notification.</p>`,
      },
    ],
  },
  {
    id: 'nodes',
    label: 'Noeuds et contenu',
    icon: 'mdi-file-tree-outline',
    articles: [
      {
        id: 'nd-tree',
        title: 'Arborescence',
        keywords: ['arborescence', 'arbre', 'dossier', 'organiser', 'drag', 'drop', 'déplacer', 'hiérarchie', 'renommer', 'dupliquer', 'fichier'],
        content: `<h2>Arborescence</h2>
<p>L'arborescence dans la barre latérale gauche organise vos noeuds de manière hiérarchique.</p>
<h3>Actions</h3>
<ul>
<li><strong>Clic droit / menu ⋯</strong> — Créer un sous-élément, renommer, dupliquer, supprimer</li>
<li><strong>Double-clic sur le titre</strong> — Renommer un noeud directement dans l'arborescence (validation avec Entrée, annulation avec Échap)</li>
<li><strong>Dupliquer</strong> — Crée une copie du noeud avec tout son contenu (suffixe « (copie) »), disponible depuis le menu contextuel</li>
<li><strong>Glisser-déposer</strong> — Réorganisez les noeuds en les déplaçant. Déposez sur un dossier pour l'y placer, ou entre deux noeuds pour réordonner</li>
<li><strong>Glisser des fichiers depuis l'explorateur</strong> — Déposez des fichiers depuis votre système directement dans l'arborescence pour créer automatiquement des noeuds documents avec le fichier attaché</li>
<li><strong>Touche Suppr</strong> — Envoie le noeud sélectionné à la corbeille</li>
<li><strong>Shift+Suppr</strong> — Suppression définitive immédiate</li>
</ul>
<h3>Types de noeuds</h3>
<p>Depuis le menu contextuel d'un dossier, créez : <strong>Sous-dossier</strong>, <strong>Note</strong>, <strong>Mind map</strong>, <strong>Carte</strong>, <strong>Dataset</strong> ou <strong>Média</strong>.</p>`,
      },
      {
        id: 'nd-notes',
        title: 'Notes (éditeur riche)',
        keywords: ['note', 'éditeur', 'texte', 'formatage', 'gras', 'italique', 'image', 'tableau', 'lien', 'tiptap'],
        content: `<h2>Notes — Éditeur riche</h2>
<p>L'éditeur de notes offre un traitement de texte complet :</p>
<h3>Formatage de texte</h3>
<ul>
<li>Gras, italique, souligné, barre, code inline</li>
<li>Exposant, indice</li>
<li>Titres H1, H2, H3</li>
<li>Couleur de texte et surlignage</li>
<li>Alignement (gauche, centre, droite, justifié)</li>
</ul>
<h3>Éléments structurants</h3>
<ul>
<li><strong>Listes</strong> — à puces, numérotées, de tâches (checkboxes)</li>
<li><strong>Citations</strong> — Blocs de citation</li>
<li><strong>Tableaux</strong> — Insertion et édition de tableaux</li>
<li><strong>Images</strong> — Upload et redimensionnement dans le texte. Cliquez sur une image pour afficher la barre d'outils (taille S/M/L, copier, annoter, supprimer)</li>
<li><strong>Blocs de code</strong> — Code avec coloration syntaxique</li>
<li><strong>Séparateurs</strong> — Lignes horizontales</li>
</ul>
<h3>Annotation d'images dans les notes</h3>
<p>Toute image insérée dans une note (upload, capture web, coller) peut être annotée directement :</p>
<ul>
<li>Cliquez sur l'image pour la sélectionner</li>
<li>Cliquez sur l'icône <strong>crayon</strong> dans la barre d'outils</li>
<li>Utilisez les outils d'annotation (rectangle, cercle, flèche, dessin libre, texte)</li>
<li>L'outil <strong>texte</strong> dispose d'une poignée de déplacement pour repositionner le texte avant validation</li>
<li>Au clic sur <strong>Sauvegarder</strong>, l'image annotée remplace l'originale dans la note</li>
<li>L'ancienne version de l'image est automatiquement supprimée du serveur</li>
</ul>
<h3>Commentaires</h3>
<p>Le panneau de commentaires latéral permet de discuter sur le contenu d'une note avec vos collaborateurs.</p>`,
      },
      {
        id: 'nd-mindmap',
        title: 'Mind maps',
        keywords: ['mindmap', 'mind map', 'excalidraw', 'schéma', 'diagramme', 'visuel'],
        content: `<h2>Mind maps</h2>
<p>Les mind maps utilisent <strong>Excalidraw</strong>, un outil de dessin collaboratif.</p>
<h3>Fonctionnalités</h3>
<ul>
<li>Dessin libre, formes géométriques, flèches, texte</li>
<li>Édition collaborative en temps réel</li>
<li>Mode focus pour un espace de travail plein écran</li>
<li>Sauvegarde automatique</li>
</ul>`,
      },
      {
        id: 'nd-map',
        title: 'Cartes',
        keywords: ['carte', 'map', 'géographique', 'localisation', 'marqueur'],
        content: `<h2>Cartes</h2>
<p>Le noeud de type carte permet de visualiser des emplacements géographiques et des relations spatiales.</p>
<ul>
<li>Ajout de marqueurs et annotations</li>
<li>Vue plein écran disponible</li>
<li>Sauvegarde des données de carte dans le noeud</li>
</ul>`,
      },
      {
        id: 'nd-dataset',
        title: 'Datasets (tableaux)',
        keywords: ['dataset', 'tableau', 'table', 'csv', 'import', 'export', 'colonne', 'tri', 'filtre', 'données'],
        content: `<h2>Datasets — Éditeur de tableaux</h2>
<p>Le dataset permet de gérer des données structurées sous forme de tableau.</p>
<h3>Édition</h3>
<ul>
<li>Ajouter/supprimer des lignes et colonnes</li>
<li>Types de colonnes : texte, nombre, date, booléen</li>
<li>Renommer les colonnes</li>
<li>Tri ascendant/descendant par colonne</li>
<li>Filtrage par colonne</li>
<li>Réorganisation des colonnes par glisser-déposer</li>
</ul>
<h3>Import / Export CSV</h3>
<ul>
<li><strong>Import</strong> — Chargez un fichier CSV pour remplir le tableau</li>
<li><strong>Export</strong> — Télécharger les données au format CSV</li>
</ul>
<h3>Recherche</h3>
<p>Utilisez <kbd>Ctrl+F</kbd> pour rechercher dans les données du tableau.</p>`,
      },
      {
        id: 'nd-documents',
        title: 'Documents et fichiers',
        keywords: ['document', 'fichier', 'upload', 'télécharger', 'image', 'pdf', 'pièce jointe', 'annotation', 'annoter', 'dessin'],
        content: `<h2>Documents et fichiers</h2>
<p>Les noeuds de type document permettent d'attacher des fichiers à votre enquête.</p>
<ul>
<li>Upload de fichiers (images, PDF, documents)</li>
<li>Preview des images directement dans l'application</li>
<li>Hash SHA-256 calculé automatiquement pour la preuve d'intégrité</li>
<li>Métadonnées conservées (nom, taille, date d'upload)</li>
<li>Téléchargement direct des fichiers non-image</li>
</ul>
<h3>Annotations d'images</h3>
<p>Pour les fichiers image (PNG, JPG, GIF, WebP...), un outil d'annotation est disponible :</p>
<ul>
<li><strong>Activer</strong> — Cliquez sur l'icône crayon dans l'en-tête du document</li>
<li><strong>Rectangle</strong> — Encadrez une zone d'intérêt</li>
<li><strong>Cercle</strong> — Mettez en évidence un élément arrondi</li>
<li><strong>Flèche</strong> — Pointez vers un élément important</li>
<li><strong>Dessin libre</strong> — Dessinez à main levée sur l'image</li>
<li><strong>Texte</strong> — Ajoutez des annotations textuelles avec poignée de repositionnement</li>
<li><strong>Couleurs</strong> — 7 couleurs disponibles (rouge, orange, vert, bleu, violet, blanc, noir)</li>
<li><strong>Épaisseur</strong> — Fine, normale ou épaisse</li>
<li><strong>Annuler</strong> — Supprimez la dernière annotation</li>
<li><strong>Sauvegarder</strong> — Enregistre les annotations dans le noeud</li>
</ul>
<p>Les annotations sont sauvegardées et persistent entre les sessions.</p>`,
      },
      {
        id: 'nd-media',
        title: 'Analyse média (vidéo / audio)',
        keywords: ['média', 'media', 'vidéo', 'video', 'audio', 'youtube', 'vimeo', 'soundcloud', 'oembed', 'annotation', 'capture', 'timestamp', 'horodatage', 'analyse'],
        content: `<h2>Analyse média — Vidéo et audio</h2>
<p>Le noeud de type <strong>média</strong> permet d'analyser des contenus vidéo et audio directement dans votre enquête.</p>

<h3>Création d'un noeud média</h3>
<p>Depuis le menu de l'arborescence ou le menu contextuel d'un dossier, sélectionnez <strong>Média</strong>. Deux options s'offrent à vous :</p>
<ul>
<li><strong>URL</strong> — Collez un lien vers une vidéo ou un fichier audio en ligne</li>
<li><strong>Upload</strong> — Déposez un fichier vidéo ou audio depuis votre ordinateur</li>
</ul>

<h3>Détection automatique (oEmbed)</h3>
<p>Lorsque vous entrez une URL, le système détecte automatiquement la plateforme via le protocole <strong>oEmbed</strong> et récupère les métadonnées associées (titre, auteur, miniature, durée, etc.).</p>
<p>Plateformes prises en charge : <strong>YouTube</strong>, <strong>Vimeo</strong>, <strong>SoundCloud</strong>, <strong>Dailymotion</strong> et d'autres services compatibles oEmbed.</p>

<h3>Capture d'image (screenshot)</h3>
<p>Pendant la lecture d'une vidéo, cliquez sur le bouton <strong>Capture</strong> pour prendre une capture d'écran de l'image courante. La capture est automatiquement horodatée avec le timecode de la vidéo.</p>

<h3>Annotations horodatées</h3>
<p>Cliquez sur le bouton <strong>Note</strong> pour créer une annotation textuelle associée au timecode actuel de la vidéo. Les annotations sont affichées sous le lecteur :</p>
<ul>
<li><strong>Horodatage cliquable</strong> — Cliquez sur un timecode pour revenir à ce point dans la vidéo</li>
<li><strong>Filtre et tri</strong> — Filtrez et triez vos annotations pour retrouver rapidement une information</li>
<li><strong>Édition et suppression</strong> — Modifiez ou supprimez une annotation à tout moment</li>
</ul>

<h3>Métadonnées</h3>
<p>Cliquez sur le bouton <strong>Éditer les métadonnées</strong> pour compléter ou modifier les informations de la source : plateforme, chaîne, date de publication, description, etc.</p>

<h3>Export</h3>
<p>Les noeuds média sont inclus dans l'export DOCX avec leurs métadonnées et annotations (format tableau ou séquentiel).</p>

<h3>Intégrité</h3>
<p>Les captures d'écran sont enregistrées comme preuves avec un <strong>EvidenceRecord</strong> et un hash <strong>SHA-256</strong>, garantissant leur intégrité.</p>`,
      },
    ],
  },
  {
    id: 'tasks',
    label: 'Tâches',
    icon: 'mdi-checkbox-marked-outline',
    articles: [
      {
        id: 'task-manage',
        title: 'Gestion des tâches',
        keywords: ['tâche', 'task', 'todo', 'assigner', 'priorité', 'échéance', 'statut', 'progression'],
        content: `<h2>Gestion des tâches</h2>
<p>L'onglet <strong>Tâches</strong> dans la barre latérale permet de suivre les tâches liées au dossier.</p>
<h3>Création</h3>
<p>Créez une tâche avec un titre, une description, une priorité, une date d'échéance et un assignataire.</p>
<h3>Statuts</h3>
<ul>
<li><strong>A faire</strong> — Tâche non commencée</li>
<li><strong>En cours</strong> — Tâche en progression</li>
<li><strong>Terminé</strong> — Tâche complétée</li>
</ul>
<p>Cliquez sur la puce de statut pour faire cycler rapidement entre les états.</p>
<h3>Filtres</h3>
<p>Filtrez les tâches par statut pour vous concentrer sur ce qui est pertinent. Une barre de progression indique l'avancement global.</p>`,
      },
    ],
  },
  {
    id: 'evidence',
    label: 'Intégrité et preuves',
    icon: 'mdi-shield-check-outline',
    articles: [
      {
        id: 'ev-integrity',
        title: 'Vérification d\'intégrité',
        keywords: ['intégrité', 'hash', 'sha256', 'preuve', 'vérification', 'certificat', 'evidence'],
        content: `<h2>Vérification d'intégrité</h2>
<p>Chaque fichier uploadé ou capture est haché en <strong>SHA-256</strong>. Ce hash permet de prouver que le fichier n'a pas été modifié.</p>
<h3>Badge d'intégrité</h3>
<p>Dans l'arborescence, un badge coloré indique le statut de vérification :</p>
<ul>
<li><strong>Vert (valide)</strong> — Le hash correspond, le fichier est intact</li>
<li><strong>Rouge (altéré)</strong> — Le hash ne correspond plus, le fichier a été modifié</li>
<li><strong>Gris (non vérifié)</strong> — La vérification n'a pas encore été effectuée</li>
</ul>
<h3>Panneau de preuve</h3>
<p>Cliquez sur le bouclier à côté d'un noeud pour voir : le hash SHA-256, la date de capture, l'auteur, la taille du fichier et l'URL source.</p>
<h3>Certificat PDF</h3>
<p>Générez un certificat d'intégrité au format PDF pour archivage ou présentation en justice.</p>`,
      },
      {
        id: 'ev-dossier',
        title: 'Vue intégrité du dossier',
        keywords: ['intégrité', 'dossier', 'liste', 'preuves', 'evidence'],
        content: `<h2>Vue intégrité du dossier</h2>
<p>L'onglet <strong>Intégrité</strong> dans la barre latérale affiche l'ensemble des enregistrements de preuve du dossier.</p>
<ul>
<li>Liste de toutes les preuves avec leur statut</li>
<li>Cliquez sur une preuve pour naviguer vers le noeud correspondant</li>
<li>Type de preuve : fichier, capture d'écran</li>
</ul>`,
      },
    ],
  },
  {
    id: 'clipper',
    label: 'Web Clipper',
    icon: 'mdi-content-cut',
    articles: [
      {
        id: 'clip-usage',
        title: 'Capturer du contenu web',
        keywords: ['clipper', 'capture', 'web', 'screenshot', 'url', 'bookmarklet', 'page'],
        content: `<h2>Web Clipper — Capture de contenu web</h2>
<p>Le Web Clipper permet de sauvegarder le contenu de pages web dans vos dossiers.</p>
<h3>Utilisation</h3>
<ol>
<li>Ouvrez un dossier et cliquez sur l'icône de capture (ciseaux) dans la barre d'outils</li>
<li>Entrez l'URL de la page, un titre et le contenu</li>
<li>Sélectionnez le dossier parent</li>
<li>Validez la capture</li>
</ol>
<h3>Capture automatique</h3>
<ul>
<li>Un screenshot pleine page est pris automatiquement</li>
<li>Les bannières de cookies et modals de connexion sont supprimés automatiquement</li>
<li>Le hash SHA-256 est calculé pour la preuve d'intégrité</li>
</ul>
<h3>Annoter une capture</h3>
<p>Les captures d'écran sont insérées comme images dans la note. Vous pouvez les annoter directement en cliquant sur l'image puis sur l'icône crayon (voir <strong>Notes > Annotation d'images</strong>).</p>
<h3>Bookmarklet</h3>
<p>Un bookmarklet est disponible pour capturer une page en un clic depuis votre navigateur. Glissez-le dans votre barre de favoris.</p>`,
      },
    ],
  },
  {
    id: 'export',
    label: 'Export et impression',
    icon: 'mdi-file-export-outline',
    articles: [
      {
        id: 'exp-formats',
        title: 'Exporter un dossier',
        keywords: ['export', 'pdf', 'docx', 'json', 'imprimer', 'impression', 'télécharger', 'import', 'importer'],
        content: `<h2>Exporter un dossier</h2>
<p>Depuis le menu d'export (icône de téléchargement) dans la barre d'outils d'un dossier :</p>
<h3>Formats disponibles</h3>
<ul>
<li><strong>JSON</strong> — Export complet avec toutes les données (backup)</li>
<li><strong>PDF</strong> — Document PDF formaté</li>
<li><strong>DOCX</strong> — Document Word</li>
<li><strong>Impression</strong> — Impression directe depuis le navigateur</li>
</ul>
<h3>Export sélectif</h3>
<p>Pour PDF, DOCX et impression, une boîte de dialogue vous permet de choisir quels noeuds inclure. Utilisez les cases à cocher pour sélectionner/désélectionner des éléments.</p>
<h3>Importer un dossier JSON</h3>
<p>Depuis la page d'accueil, cliquez sur le bouton <strong>Importer</strong> pour charger un fichier JSON exporté précédemment.</p>
<ul>
<li>Un nouveau dossier est créé avec le suffixe « (import) »</li>
<li>Tous les noeuds et leur contenu (notes, mind maps, cartes, datasets) sont restaurés</li>
<li>La hiérarchie des dossiers est conservée</li>
<li>Les fichiers attachés (documents, captures) ne sont pas transférés (seules les métadonnées sont importées)</li>
<li>Le dossier importé n'est pas chiffré, même si l'original l'était</li>
</ul>`,
      },
      {
        id: 'exp-snapshots',
        title: 'Historique de versions',
        keywords: ['snapshot', 'version', 'historique', 'restaurer', 'sauvegarde', 'revenir'],
        content: `<h2>Historique de versions (Snapshots)</h2>
<p>Les snapshots permettent de conserver l'historique des modifications de vos noeuds.</p>
<ul>
<li>Des snapshots sont créés automatiquement lors des modifications</li>
<li>Consultez l'historique via le bouton d'horloge dans la barre d'outils</li>
<li>Restaurez une version antérieure en un clic</li>
<li>Disponible pour les notes, mind maps et cartes</li>
</ul>`,
      },
    ],
  },
  {
    id: 'ai',
    label: 'Intelligence artificielle',
    icon: 'mdi-robot-outline',
    articles: [
      {
        id: 'ai-summary',
        title: 'Résumés IA',
        keywords: ['ia', 'ai', 'résumé', 'synthèse', 'ollama', 'générer'],
        content: `<h2>Résumés IA</h2>
<p>L'IA peut générer des résumés automatiques de vos noeuds ou de l'ensemble d'un dossier.</p>
<ul>
<li><strong>Résumé de noeud</strong> — Synthèse du contenu d'une note</li>
<li><strong>Résumé de dossier</strong> — Vue d'ensemble de toute l'enquête</li>
</ul>
<p>Les résumés sont générés via <strong>Ollama</strong> (IA locale). Aucune donnée ne quitte votre serveur.</p>`,
      },
      {
        id: 'ai-enrichment',
        title: 'Enrichissement d\'entités',
        keywords: ['enrichissement', 'entité', 'ia', 'ai', 'information', 'renseignement'],
        content: `<h2>Enrichissement d'entités par IA</h2>
<p>Chaque entité du dossier peut être enrichie par l'IA pour obtenir des informations complémentaires.</p>
<ul>
<li>Cliquez sur le bouton IA à côté d'une entité</li>
<li>L'IA génère un résumé des informations connues</li>
<li>Fonctionne pour tous les types : identités, téléphones, réseaux sociaux, etc.</li>
</ul>`,
      },
      {
        id: 'ai-report',
        title: 'Rapports IA',
        keywords: ['rapport', 'report', 'ia', 'ai', 'template', 'générer', 'modèle'],
        content: `<h2>Rapports IA</h2>
<p>Générez des rapports complets à partir de templates personnalisables.</p>
<ol>
<li>Ouvrez le menu d'export et sélectionnez <strong>Rapport IA</strong></li>
<li>Choisissez un template de rapport</li>
<li>L'IA analyse le dossier et génère un rapport structure</li>
<li>Éditez le résultat si nécessaire</li>
</ol>
<p>Les templates sont gérés depuis la page <strong>Mes modèles</strong>.</p>`,
      },
    ],
  },
  {
    id: 'security',
    label: 'Sécurité',
    icon: 'mdi-lock-outline',
    articles: [
      {
        id: 'sec-2fa',
        title: 'Authentification à deux facteurs',
        keywords: ['2fa', 'totp', 'authentification', 'sécurité', 'qr', 'code', 'backup'],
        content: `<h2>Authentification à deux facteurs (2FA)</h2>
<p>Renforcez la sécurité de votre compte avec la 2FA TOTP.</p>
<h3>Activation</h3>
<ol>
<li>Allez dans <strong>Profil > Sécurité</strong></li>
<li>Cliquez sur <strong>Activer la 2FA</strong></li>
<li>Scannez le QR code avec une application d'authentification (Google Authenticator, Authy, etc.)</li>
<li>Entrez le code de vérification</li>
</ol>
<h3>Codes de secours</h3>
<p>Des codes de secours sont générés lors de l'activation. Conservez-les en lieu sûr — ils permettent de récupérer l'accès si vous perdez votre appareil.</p>`,
      },
      {
        id: 'sec-encryption',
        title: 'Chiffrement de bout en bout',
        keywords: ['chiffrement', 'encryption', 'e2e', 'clé', 'rsa', 'aes', 'sécurité', 'crypter'],
        content: `<h2>Chiffrement de bout en bout (E2E)</h2>
<p>Protégez le contenu de vos dossiers avec un chiffrement de bout en bout.</p>
<h3>Fonctionnement</h3>
<ul>
<li><strong>Algorithme</strong> : RSA-OAEP 4096 bits + AES-256-GCM</li>
<li>Les données sont chiffrées <strong>avant</strong> d'être envoyées au serveur</li>
<li>Seuls les détenteurs de la clé peuvent déchiffrer le contenu</li>
<li>Le serveur ne voit jamais les données en clair</li>
</ul>
<h3>Activation</h3>
<ol>
<li>Ouvrez le panneau d'informations du dossier</li>
<li>Section <strong>Chiffrement</strong>, activez le chiffrement</li>
<li>Définissez un mot de passe pour protéger votre clé</li>
<li>Partagez la clé avec vos collaborateurs si nécessaire</li>
</ol>`,
      },
      {
        id: 'sec-password',
        title: 'Mot de passe',
        keywords: ['mot de passe', 'password', 'changer', 'modifier', 'sécurité'],
        content: `<h2>Gestion du mot de passe</h2>
<p>Modifiez votre mot de passe depuis <strong>Profil > Sécurité</strong>.</p>
<ul>
<li>Entrez votre mot de passe actuel</li>
<li>Choisissez un nouveau mot de passe</li>
<li>Confirmez le nouveau mot de passe</li>
</ul>`,
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: 'mdi-shield-account-outline',
    articles: [
      {
        id: 'adm-users',
        title: 'Gestion des utilisateurs',
        keywords: ['admin', 'utilisateur', 'rôle', 'activer', 'désactiver', 'administrateur'],
        content: `<h2>Gestion des utilisateurs</h2>
<p>Accessible depuis <strong>Administration > Utilisateurs</strong> (rôle admin requis).</p>
<ul>
<li>Liste de tous les utilisateurs avec statut, rôle et dernière connexion</li>
<li>Activer / désactiver un compte</li>
<li>Promouvoir / rétrograder en administrateur</li>
<li>Supprimer un utilisateur</li>
</ul>`,
      },
      {
        id: 'adm-branding',
        title: 'Personnalisation (branding)',
        keywords: ['branding', 'logo', 'couleur', 'apparence', 'personnaliser', 'nom', 'thème'],
        content: `<h2>Personnalisation de l'application</h2>
<p>Depuis <strong>Administration > Apparence</strong>, personnalisez :</p>
<ul>
<li><strong>Nom de l'application</strong> — Affiché dans la barre et l'onglet</li>
<li><strong>Logo</strong> — Upload d'un logo personnalisé</li>
<li><strong>Couleur d'accent</strong> — Couleur principale de l'interface</li>
<li><strong>Message de connexion</strong> — Texte affiché sur la page de login</li>
<li><strong>Favicon</strong> — Icône de l'onglet navigateur</li>
</ul>`,
      },
      {
        id: 'adm-audit',
        title: 'Journal d\'audit',
        keywords: ['audit', 'journal', 'log', 'activité', 'historique', 'traçabilité'],
        content: `<h2>Journal d'audit</h2>
<p>Le journal d'audit (<strong>Administration > Audit</strong>) enregistre toutes les actions importantes :</p>
<ul>
<li>Connexions et déconnexions</li>
<li>Création, modification et suppression de dossiers et noeuds</li>
<li>Actions d'administration</li>
</ul>
<p>Filtrez par date, utilisateur ou type d'action. Des indicateurs statistiques sont affichés en haut de page.</p>`,
      },
      {
        id: 'adm-ai',
        title: 'Configuration IA',
        keywords: ['ia', 'ai', 'ollama', 'configuration', 'modèle', 'prompt', 'admin'],
        content: `<h2>Configuration de l'IA</h2>
<p>Depuis <strong>Administration > Intelligence Artificielle</strong> :</p>
<ul>
<li><strong>URL Ollama</strong> — Adresse du serveur Ollama</li>
<li><strong>Modèle</strong> — Sélection du modèle de langage</li>
<li><strong>Prompts</strong> — Personnalisation des prompts d'enrichissement et de résumé</li>
<li><strong>Test de connexion</strong> — Vérifiez que le serveur IA est accessible</li>
</ul>
<p>L'IA fonctionne entièrement en local via Ollama. Aucune donnée n'est envoyée à des services externes.</p>`,
      },
      {
        id: 'adm-storage',
        title: 'Stockage',
        keywords: ['stockage', 'upload', 'fichier', 'taille', 'limite', 'espace', 'disque'],
        content: `<h2>Stockage</h2>
<p>Depuis <strong>Administration > Stockage</strong>, configurez les paramètres d'upload :</p>
<ul>
<li><strong>Taille maximale par fichier</strong> — Limite en MB pour chaque upload</li>
<li><strong>Types de fichiers autorisés</strong> — Types MIME et extensions acceptées</li>
<li><strong>Utilisation du stockage</strong> — Visualisation de l'espace disque utilisé (nombre de fichiers et taille totale)</li>
</ul>`,
      },
      {
        id: 'adm-email',
        title: 'Email / SMTP',
        keywords: ['email', 'smtp', 'envoi', 'mail', 'notification', 'serveur', 'tls'],
        content: `<h2>Configuration Email / SMTP</h2>
<p>Depuis <strong>Administration > Email / SMTP</strong>, configurez l'envoi d'emails :</p>
<ul>
<li><strong>Serveur SMTP</strong> — Adresse du serveur (ex: smtp.gmail.com)</li>
<li><strong>Port</strong> — Port de connexion (587 pour TLS, 465 pour SSL, 25 sans chiffrement)</li>
<li><strong>Connexion sécurisée</strong> — Activer TLS/SSL</li>
<li><strong>Identifiant / Mot de passe</strong> — Authentification SMTP</li>
<li><strong>Expéditeur</strong> — Adresse d'envoi (From)</li>
<li><strong>Test de connexion</strong> — Envoi d'un email de test pour vérifier la configuration</li>
</ul>`,
      },
      {
        id: 'adm-clipper',
        title: 'Web Clipper',
        keywords: ['clipper', 'capture', 'screenshot', 'puppeteer', 'timeout', 'proxy', 'qualité'],
        content: `<h2>Configuration du Web Clipper</h2>
<p>Depuis <strong>Administration > Web Clipper</strong>, ajustez les paramètres de capture :</p>
<ul>
<li><strong>Timeout</strong> — Délai d'attente max pour la capture d'une page (en ms)</li>
<li><strong>Qualité JPEG</strong> — Compression des captures (10-100%)</li>
<li><strong>User-Agent</strong> — Permet de simuler un navigateur spécifique</li>
<li><strong>Proxy</strong> — Proxy HTTP(S) pour les captures</li>
</ul>`,
      },
      {
        id: 'adm-defaults',
        title: 'Paramètres par défaut',
        keywords: ['défaut', 'chiffrement', 'encryption', 'corbeille', 'rétention', 'purge'],
        content: `<h2>Paramètres par défaut</h2>
<p>Depuis <strong>Administration > Paramètres par défaut</strong> :</p>
<ul>
<li><strong>Chiffrement E2E par défaut</strong> — Active automatiquement le chiffrement de bout en bout pour les nouveaux dossiers</li>
<li><strong>Purge automatique de la corbeille</strong> — Nombre de jours avant suppression définitive des éléments en corbeille (0 = désactivé)</li>
</ul>`,
      },
      {
        id: 'adm-network',
        title: 'Réseau & Annonces',
        keywords: ['cors', 'origine', 'réseau', 'bannière', 'annonce', 'domaine'],
        content: `<h2>Réseau & Annonces</h2>
<p>Depuis <strong>Administration > Réseau & Annonces</strong> :</p>
<ul>
<li><strong>CORS / Origines autorisées</strong> — Liste des domaines autorisés à accéder à l'API (* = tout autoriser)</li>
<li><strong>Bannière d'annonce</strong> — Affiche un bandeau visible par tous les utilisateurs (info, warning ou erreur)</li>
</ul>`,
      },
      {
        id: 'adm-backup',
        title: 'Sauvegarde & Restauration',
        keywords: ['backup', 'sauvegarde', 'restauration', 'export', 'import', 'base', 'données'],
        content: `<h2>Sauvegarde & Restauration</h2>
<p>Depuis <strong>Administration > Sauvegarde</strong> :</p>
<ul>
<li><strong>Exporter</strong> — Téléchargez une copie complète de la base de données au format JSON (utilisateurs, dossiers, notes, paramètres)</li>
<li><strong>Restaurer</strong> — Importez un fichier de sauvegarde pour remplacer toutes les données actuelles</li>
</ul>
<p><strong>Attention :</strong> la restauration est une opération destructive et irréversible. Elle remplace toutes les données existantes.</p>`,
      },
    ],
  },
  {
    id: 'other',
    label: 'Autres fonctionnalités',
    icon: 'mdi-dots-horizontal-circle-outline',
    articles: [
      {
        id: 'oth-trash',
        title: 'Corbeille',
        keywords: ['corbeille', 'trash', 'supprimer', 'restaurer', 'purger', 'vider', 'automatique', 'purge'],
        content: `<h2>Corbeille</h2>
<p>Les noeuds supprimés sont envoyés dans la corbeille du dossier.</p>
<ul>
<li><strong>Restaurer</strong> — Remettez un noeud dans l'arborescence</li>
<li><strong>Purger</strong> — Supprimez définitivement un noeud et ses fichiers associés</li>
<li><strong>Vider la corbeille</strong> — Supprime définitivement tous les noeuds de la corbeille</li>
</ul>
<p>La suppression définitive supprime également les fichiers physiques et les enregistrements de preuve associés.</p>
<h3>Purge automatique</h3>
<p>Un administrateur peut configurer une purge automatique de la corbeille depuis <strong>Administration > Paramètres par défaut > Rétention des données</strong>.</p>
<ul>
<li>Définissez un nombre de jours (ex : 30) après lequel les éléments de la corbeille seront automatiquement supprimés définitivement</li>
<li>La valeur <strong>0</strong> désactive la purge automatique (par défaut)</li>
<li>Le job de purge s'exécute automatiquement toutes les heures</li>
</ul>`,
      },
      {
        id: 'oth-notifications',
        title: 'Notifications',
        keywords: ['notification', 'alerte', 'mention', 'cloche'],
        content: `<h2>Notifications</h2>
<p>La cloche dans la barre supérieure affiche vos notifications :</p>
<ul>
<li>Mentions par des collaborateurs</li>
<li>Mises à jour de dossiers</li>
<li>Alertes système</li>
</ul>
<p>Les notifications non lues sont indiquées par un badge numérique. Cliquez pour les consulter et les marquer comme lues.</p>`,
      },
      {
        id: 'oth-pomodoro',
        title: 'Timer Pomodoro',
        keywords: ['pomodoro', 'timer', 'minuteur', 'pause', 'focus', 'concentration'],
        content: `<h2>Timer Pomodoro</h2>
<p>Un minuteur Pomodoro intégré pour gérer vos sessions de travail :</p>
<ul>
<li><strong>Focus</strong> — 25 minutes de travail concentré</li>
<li><strong>Pause courte</strong> — 5 minutes</li>
<li><strong>Pause longue</strong> — 15 minutes (après 4 sessions)</li>
</ul>
<p>Le timer émet une notification sonore à la fin de chaque session.</p>`,
      },
      {
        id: 'oth-theme',
        title: 'Thèmes et préférences',
        keywords: ['thème', 'sombre', 'clair', 'dark', 'light', 'préférences', 'police', 'taille'],
        content: `<h2>Thèmes et préférences</h2>
<h3>Thème</h3>
<p>Basculez entre le mode sombre et clair avec le bouton soleil/lune dans la barre supérieure.</p>
<h3>Préférences</h3>
<p>Depuis <strong>Profil > Préférences</strong>, ajustez :</p>
<ul>
<li>Thème par défaut</li>
<li>Largeur de la barre latérale</li>
<li>Taille de police de l'éditeur</li>
</ul>`,
      },
      {
        id: 'oth-templates',
        title: 'Templates de rapport',
        keywords: ['template', 'modèle', 'rapport', 'personnaliser'],
        content: `<h2>Templates de rapport</h2>
<p>Gérez vos modèles de rapport depuis la page <strong>Mes modèles</strong> (accessible depuis le menu avatar).</p>
<ul>
<li>Créez des templates personnalisés</li>
<li>Partagez des templates avec d'autres utilisateurs</li>
<li>Utilisez-les lors de la génération de rapports IA</li>
</ul>`,
      },
    ],
  },
  {
    id: 'espace-perso',
    label: 'Espace personnel',
    icon: 'mdi-account-circle-outline',
    articles: [
      {
        id: 'dashboard-enrichi',
        title: 'Tableau de bord enrichi',
        keywords: ['tableau de bord', 'dashboard', 'accès rapide', 'derniers éléments', 'tâches assignées', 'heatmap', 'contribution', 'streak', 'activité', 'productivité', 'métriques'],
        content: `<h2>Tableau de bord enrichi</h2>
<p>Le tableau de bord personnel centralise vos informations de travail en un coup d'œil.</p>
<h3>Accès rapides</h3>
<ul>
<li><strong>Derniers éléments ouverts</strong> — Retrouvez rapidement les dossiers et noeuds consultés récemment</li>
<li><strong>Tâches assignées</strong> — Visualisez directement les tâches qui vous sont affectées sur tous les dossiers, sans avoir à les ouvrir un par un</li>
</ul>
<h3>Heatmap de contribution</h3>
<p>Un graphique de contribution style GitHub affiche votre activité sur les <strong>6 derniers mois</strong>. Chaque case représente un jour ; son intensité reflète le nombre d'actions effectuées ce jour-là (créations, modifications, captures, etc.).</p>
<h3>Streaks et métriques de productivité</h3>
<ul>
<li><strong>Streak actif</strong> — Nombre de jours consécutifs d'activité</li>
<li><strong>Meilleur streak</strong> — Record personnel de jours consécutifs</li>
<li><strong>Métriques globales</strong> — Nombre total d'actions, moyenne journalière et autres indicateurs de productivité</li>
</ul>`,
      },
      {
        id: 'stats-perso',
        title: 'Statistiques personnelles',
        keywords: ['statistiques', 'stats', 'donut', 'répartition', 'type', 'dossiers actifs', 'tendance', 'hebdomadaire', 'semaine', 'comparaison', 'productivité'],
        content: `<h2>Statistiques personnelles</h2>
<p>La section statistiques offre une analyse détaillée de votre activité sur la plateforme.</p>
<h3>Graphique de répartition</h3>
<p>Un <strong>graphique donut</strong> illustre la répartition de vos contributions par type d'élément :</p>
<ul>
<li>Notes créées ou modifiées</li>
<li>Mind maps</li>
<li>Datasets</li>
<li>Documents uploadés</li>
<li>Captures web</li>
</ul>
<h3>Top 5 dossiers les plus actifs</h3>
<p>Classement des 5 dossiers ayant reçu le plus d'activité de votre part. Ce classement vous permet d'identifier facilement où se concentre votre travail.</p>
<h3>Tendance hebdomadaire</h3>
<p>Un graphique de tendance compare votre activité de la semaine en cours avec celle de la <strong>semaine précédente</strong>. Un indicateur de progression (en hausse ou en baisse) est affiché pour évaluer votre rythme de travail.</p>`,
      },
      {
        id: 'notif-prefs',
        title: 'Préférences de notification',
        keywords: ['notification', 'préférence', 'canal', 'in-app', 'email', 'ne pas déranger', 'push', 'son', 'désactiver', 'throttle', 'fréquence'],
        content: `<h2>Préférences de notification</h2>
<p>Depuis <strong>Profil > Notifications</strong>, configurez finement comment et quand vous êtes notifié.</p>
<h3>Configuration des canaux</h3>
<p>Pour chaque type de notification (mentions, mises à jour de dossiers, tâches assignées, alertes système), choisissez indépendamment :</p>
<ul>
<li><strong>In-app</strong> — Notification dans la cloche de l'interface</li>
<li><strong>Email</strong> — Notification par email (nécessite une configuration SMTP active)</li>
</ul>
<h3>Mode "Ne pas déranger"</h3>
<p>Activez le mode <strong>Ne pas déranger</strong> pour suspendre les notifications push en temps réel. Les notifications continuent d'être enregistrées et restent accessibles dans la cloche, mais n'apparaissent pas en surimpression.</p>
<h3>Son</h3>
<p>Le son de notification est <strong>optionnel et désactivable</strong>. Désactivez-le depuis les préférences pour un environnement de travail silencieux.</p>
<h3>Throttle email</h3>
<p>Pour éviter la surcharge de votre boîte mail, un système de <strong>limitation de fréquence</strong> est appliqué aux emails : au maximum <strong>1 email par type de notification par heure</strong>. Les notifications supplémentaires sont regroupées et envoyées ultérieurement.</p>`,
      },
      {
        id: 'prefs-enrichies',
        title: 'Préférences avancées',
        keywords: ['préférences', 'paramètres', 'thème', 'densité', 'date', 'format', 'langue', 'auto-sauvegarde', 'confirmation', 'node', 'défaut'],
        content: `<h2>Préférences avancées</h2>
<p>Depuis <strong>Mon compte > Préférences</strong>, personnalisez votre expérience en détail.</p>
<h3>Apparence</h3>
<ul>
<li><strong>Thème</strong> — Choisissez entre mode sombre et clair</li>
<li><strong>Densité d'affichage</strong> — Compact, Confortable ou Spacieux pour ajuster l'espacement général</li>
<li><strong>Largeur du sidebar</strong> — Ajustez la largeur du panneau latéral (200px à 500px)</li>
</ul>
<h3>Éditeur</h3>
<ul>
<li><strong>Taille de police</strong> — De 12px à 24px pour le confort de lecture</li>
<li><strong>Auto-sauvegarde</strong> — Intervalle configurable (5s, 10s, 30s, 60s ou désactivé)</li>
<li><strong>Type de noeud par défaut</strong> — Choisissez le type créé par défaut (note, dossier, document, etc.)</li>
</ul>
<h3>Régional</h3>
<ul>
<li><strong>Format de date</strong> — DD/MM/YYYY, YYYY-MM-DD ou MM/DD/YYYY</li>
<li><strong>Langue</strong> — Français (anglais bientôt disponible)</li>
</ul>
<h3>Comportement</h3>
<ul>
<li><strong>Confirmation avant suppression</strong> — Activez ou désactivez la demande de confirmation lors de la suppression d'éléments</li>
</ul>`,
      },
      {
        id: 'securite-avancee',
        title: 'Sécurité avancée',
        keywords: ['sécurité', 'sessions', 'score', 'connexion', 'historique', 'login', 'ip', 'navigateur', 'mot de passe', 'force'],
        content: `<h2>Sécurité avancée</h2>
<p>Depuis <strong>Mon compte > Sessions & score</strong>, surveillez la sécurité de votre compte.</p>
<h3>Score de sécurité</h3>
<p>Un indicateur visuel évalue le niveau de protection de votre compte sur 4 critères :</p>
<ul>
<li><strong>Mot de passe défini</strong> (+25%)</li>
<li><strong>2FA activée</strong> (+25%)</li>
<li><strong>Clés de chiffrement configurées</strong> (+25%)</li>
<li><strong>Mot de passe changé récemment</strong> (moins de 90 jours, +25%)</li>
</ul>
<h3>Historique de connexion</h3>
<p>Consultez vos 20 dernières connexions (7 jours) avec l'adresse IP, le navigateur et l'heure.</p>
<h3>Sessions actives</h3>
<p>Visualisez les sessions actuellement connectées à votre compte. La session en cours est identifiée par un badge vert.</p>`,
      },
      {
        id: 'mes-donnees',
        title: 'Mes données',
        keywords: ['données', 'stockage', 'export', 'rgpd', 'suppression', 'compte', 'espace', 'fichiers', 'télécharger'],
        content: `<h2>Mes données</h2>
<p>Depuis <strong>Mon compte > Mes données</strong>, gérez vos données personnelles.</p>
<h3>Espace de stockage</h3>
<p>Visualisez l'espace occupé par vos fichiers (avatar, signatures, documents uploadés). Une barre de progression indique l'utilisation relative.</p>
<h3>Export de données (RGPD)</h3>
<p>Téléchargez une copie complète de vos données : profil, dossiers, noeuds et historique d'activité au format JSON. Conforme aux exigences du RGPD.</p>
<h3>Suppression de compte</h3>
<p>La zone dangereuse permet de supprimer définitivement votre compte. Cette action est <strong>irréversible</strong> : tous vos dossiers, notes, fichiers et données seront supprimés. Une confirmation par mot de passe est requise.</p>`,
      },
      {
        id: 'journal-activite',
        title: 'Journal d\'activité',
        keywords: ['journal', 'activité', 'historique', 'actions', 'filtre', 'csv', 'export', 'connexion', 'modification'],
        content: `<h2>Journal d'activité</h2>
<p>Depuis <strong>Mon compte > Journal d'activité</strong>, consultez l'historique de vos actions sur les 7 derniers jours.</p>
<h3>Filtrage</h3>
<p>Filtrez par type d'action : connexions, modifications de dossiers, gestion d'éléments, collaborations, commentaires, snapshots, profil et sécurité.</p>
<h3>Export CSV</h3>
<p>Exportez votre historique d'activité au format CSV pour analyse externe ou archivage.</p>
<h3>Informations affichées</h3>
<p>Chaque entrée montre l'action effectuée, l'élément concerné (si applicable), l'heure et l'adresse IP.</p>`,
      },
      {
        id: 'raccourcis-ref',
        title: 'Raccourcis clavier',
        keywords: ['raccourcis', 'clavier', 'shortcut', 'ctrl', 'référence', 'touche'],
        content: `<h2>Raccourcis clavier</h2>
<p>Depuis <strong>Mon compte > Raccourcis clavier</strong>, consultez la référence complète des raccourcis disponibles.</p>
<p>Les raccourcis sont organisés en 4 catégories :</p>
<ul>
<li><strong>Navigation</strong> — Recherche rapide (Ctrl+K), toggle sidebar (Ctrl+B), accueil (Ctrl+H)</li>
<li><strong>Éditeur</strong> — Sauvegarde, annulation, formatage (gras, italique, titres)</li>
<li><strong>Dossiers</strong> — Nouveau noeud (Ctrl+N), suppression (Delete), renommer (F2)</li>
<li><strong>Général</strong> — Préférences (Ctrl+,), fermeture (Escape)</li>
</ul>`,
      },
    ],
  },
];

// Search
interface SearchResult {
  id: string;
  title: string;
  icon: string;
  match: string;
}

const searchResults = ref<SearchResult[]>([]);

function onSearch() {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) {
    searchResults.value = [];
    return;
  }
  const results: SearchResult[] = [];
  for (const cat of categories) {
    for (const article of cat.articles) {
      const inTitle = article.title.toLowerCase().includes(q);
      const inKeywords = article.keywords.some(k => k.includes(q));
      const inContent = article.content.toLowerCase().includes(q);
      if (inTitle || inKeywords || inContent) {
        let match = '';
        if (inContent) {
          const plain = article.content.replace(/<[^>]+>/g, ' ').toLowerCase();
          const idx = plain.indexOf(q);
          if (idx !== -1) {
            const start = Math.max(0, idx - 30);
            const end = Math.min(plain.length, idx + q.length + 40);
            match = (start > 0 ? '...' : '') + plain.substring(start, end).trim() + (end < plain.length ? '...' : '');
          }
        }
        results.push({ id: article.id, title: article.title, icon: cat.icon, match });
      }
    }
  }
  searchResults.value = results;
}

function goToArticle(id: string) {
  activeArticle.value = id;
  // Expand the parent category
  for (const cat of categories) {
    if (cat.articles.some(a => a.id === id)) {
      expandedCategories.value.add(cat.id);
      break;
    }
  }
}

function toggleCategory(id: string) {
  if (expandedCategories.value.has(id)) {
    expandedCategories.value.delete(id);
  } else {
    expandedCategories.value.add(id);
  }
}

const currentArticleComponent = computed<Component | null>(() => {
  if (!activeArticle.value) return null;
  for (const cat of categories) {
    const article = cat.articles.find(a => a.id === activeArticle.value);
    if (article) {
      return { render: () => h('div', { innerHTML: article.content, class: 'help-html' }) };
    }
  }
  return null;
});
</script>

<style scoped>
.help-root {
  display: flex;
  height: calc(100vh - 48px);
  background: var(--me-bg-deep);
}
.help-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border-right: 1px solid var(--me-border);
  overflow: hidden;
}
.help-sidebar-header {
  display: flex;
  align-items: center;
  padding: 16px;
  font-weight: 700;
  font-size: 16px;
  color: var(--me-text-primary);
  border-bottom: 1px solid var(--me-border);
}
.help-search {
  position: relative;
  padding: 12px;
  border-bottom: 1px solid var(--me-border);
}
.help-search-icon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--me-text-muted);
}
.help-search-input {
  width: 100%;
  padding: 8px 32px 8px 32px;
  border-radius: var(--me-radius-sm);
  border: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  color: var(--me-text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.help-search-input:focus {
  border-color: var(--me-accent);
}
.help-search-input::placeholder {
  color: var(--me-text-muted);
}
.help-search-clear {
  position: absolute;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}
.help-search-clear:hover {
  color: var(--me-text-primary);
}
.help-search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.help-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.help-nav-group {
  margin-bottom: 4px;
}
.help-nav-category {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.help-nav-category:hover {
  background: var(--me-accent-glow);
}
.help-nav-chevron {
  margin-left: auto;
  color: var(--me-text-muted);
}
.help-nav-items {
  padding-left: 12px;
}
.help-nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.help-nav-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.help-nav-item.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  font-weight: 600;
}
.help-nav-text {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.help-nav-title {
  font-size: 13px;
}
.help-nav-match {
  font-size: 11px;
  color: var(--me-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.help-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
.help-welcome {
  max-width: 700px;
  margin: 40px auto;
  padding: 40px;
  text-align: center;
}
.help-welcome h1 {
  margin: 16px 0 8px;
  font-size: 24px;
  color: var(--me-text-primary);
}
.help-welcome p {
  color: var(--me-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}
.help-quick-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 24px;
}
.help-quick-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  cursor: pointer;
  border: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.help-quick-card:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.help-article {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px;
}
.help-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--me-radius-xs);
  margin-bottom: 16px;
  transition: all 0.15s;
}
.help-back-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}

/* Article content styles */
:deep(.help-html) {
  color: var(--me-text-primary);
  line-height: 1.7;
}
:deep(.help-html h2) {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--me-text-primary);
}
:deep(.help-html h3) {
  font-size: 16px;
  font-weight: 600;
  margin-top: 20px;
  margin-bottom: 8px;
  color: var(--me-text-primary);
}
:deep(.help-html p) {
  margin-bottom: 12px;
  color: var(--me-text-secondary);
}
:deep(.help-html ul),
:deep(.help-html ol) {
  margin-bottom: 12px;
  padding-left: 20px;
}
:deep(.help-html li) {
  margin-bottom: 6px;
  color: var(--me-text-secondary);
}
:deep(.help-html li strong) {
  color: var(--me-text-primary);
}
:deep(.help-html table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}
:deep(.help-html td) {
  padding: 8px 12px;
  border: 1px solid var(--me-border);
  font-size: 13px;
  color: var(--me-text-secondary);
}
:deep(.help-html td:first-child) {
  white-space: nowrap;
  color: var(--me-text-primary);
  font-family: var(--me-font-mono);
  font-size: 12px;
}
:deep(.help-html kbd) {
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: var(--me-font-mono);
  color: var(--me-text-primary);
}
</style>
