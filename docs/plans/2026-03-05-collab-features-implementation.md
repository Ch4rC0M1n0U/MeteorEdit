# Collaboration & Advanced Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tags, advanced search, activity logs, notifications, and real-time collaborative editing (Yjs) to MeteorEdit.

**Architecture:** 5 features in dependency order. Tags and contentText extraction enable advanced search. Activity logs provide audit trail. Notifications use Socket.io for real-time delivery. Collaboration uses Yjs + y-websocket (port 3002) for CRDT sync on TipTap and Excalidraw, with awareness for cursors/presence.

**Tech Stack:** yjs + y-websocket + y-leveldb (collab server) | @tiptap/extension-collaboration + @tiptap/extension-collaboration-cursor (client) | Existing: Mongoose, Socket.io, Pinia, Vuetify, TipTap, Excalidraw

**Design doc:** `docs/plans/2026-03-05-collab-features-design.md`

---

## Task 1: Install dependencies

**Step 1: Install server deps**

```bash
cd server && npm install yjs y-websocket y-leveldb
```

**Step 2: Install client deps**

```bash
cd client && npm install yjs y-websocket @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor
```

**Step 3: Commit**

```bash
git add server/package.json server/package-lock.json client/package.json client/package-lock.json
git commit -m "chore: add yjs, y-websocket, collaboration dependencies"
```

---

## Task 2: Add tags to Dossier model

**Files:**
- Modify: `server/src/types/index.ts:40-52`
- Modify: `server/src/models/Dossier.ts:18-31`
- Modify: `client/src/types/index.ts:20-33`

**Step 1: Add tags to IDossier interface**

In `server/src/types/index.ts`, add `tags` field to IDossier (after `judicialFacts` line 46):

```typescript
tags: string[];
```

**Step 2: Add tags to Dossier schema**

In `server/src/models/Dossier.ts`, add after `judicialFacts` (line 25):

```typescript
tags: [{ type: String, lowercase: true, trim: true }],
```

Add index after the text index (line 33):

```typescript
dossierSchema.index({ tags: 1 });
```

**Step 3: Add tags to client Dossier type**

In `client/src/types/index.ts`, add to Dossier interface (after `judicialFacts` line 28):

```typescript
tags: string[];
```

**Step 4: Commit**

```bash
git add server/src/types/index.ts server/src/models/Dossier.ts client/src/types/index.ts
git commit -m "feat: add tags field to Dossier model"
```

---

## Task 3: Tags endpoint + dossier controller update

**Files:**
- Modify: `server/src/controllers/dossierController.ts`
- Modify: `server/src/routes/dossiers.ts`

**Step 1: Add getTags controller**

In `server/src/controllers/dossierController.ts`, add at the end (before the closing):

```typescript
export async function getTags(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const tags = await Dossier.distinct('tags', {
      $or: [{ owner: userId }, { collaborators: userId }],
    });
    res.json(tags.filter(Boolean).sort());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
```

**Step 2: Add route**

In `server/src/routes/dossiers.ts`, import `getTags` and add route BEFORE `/:id` routes:

```typescript
router.get('/tags', getTags);
```

**Step 3: Commit**

```bash
git add server/src/controllers/dossierController.ts server/src/routes/dossiers.ts
git commit -m "feat: add GET /dossiers/tags endpoint"
```

---

## Task 4: Tags UI in dossier info panel

**Files:**
- Modify: `client/src/components/dossier/DossierInfo.vue` (the info panel component)

**Step 1: Add tags section to the info panel**

Find the dossier info panel component. Add a tags section with:
- A `v-combobox` (Vuetify) with `chips`, `multiple`, `closable-chips` props
- Model bound to `dossier.tags`
- Items loaded from `GET /dossiers/tags` for autocomplete
- On change, emit update to save tags via `updateDossier`

```vue
<v-combobox
  v-model="localTags"
  :items="availableTags"
  label="Tags"
  multiple
  chips
  closable-chips
  density="compact"
  hide-details
  @update:model-value="saveTags"
/>
```

Script additions:
```typescript
const localTags = ref<string[]>([]);
const availableTags = ref<string[]>([]);

watch(() => props.dossier?.tags, (tags) => {
  localTags.value = tags || [];
}, { immediate: true });

onMounted(async () => {
  const { data } = await api.get('/dossiers/tags');
  availableTags.value = data;
});

async function saveTags(tags: string[]) {
  const cleaned = tags.map(t => t.toLowerCase().trim()).filter(Boolean);
  localTags.value = cleaned;
  await dossierStore.updateDossier(props.dossier!._id, { tags: cleaned });
}
```

**Step 2: Display tags in dossier list**

In the dossier list component, add tags display under title:

```vue
<div v-if="dossier.tags?.length" class="dossier-tags">
  <span v-for="tag in dossier.tags" :key="tag" class="dossier-tag mono">{{ tag }}</span>
</div>
```

CSS:
```css
.dossier-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.dossier-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--me-accent-glow);
  color: var(--me-accent);
  text-transform: lowercase;
}
```

**Step 3: Commit**

```bash
git add client/src/components/dossier/
git commit -m "feat: add tags UI in dossier info panel and list"
```

---

## Task 5: Add contentText to DossierNode + extraction helper

**Files:**
- Modify: `server/src/types/index.ts:54-68`
- Modify: `server/src/models/DossierNode.ts`
- Create: `server/src/utils/extractText.ts`
- Modify: `server/src/controllers/nodeController.ts:50-67`

**Step 1: Add contentText to IDossierNode**

In `server/src/types/index.ts`, add to IDossierNode (after `content` line 60):

```typescript
contentText: string | null;
```

**Step 2: Add contentText to DossierNode schema**

In `server/src/models/DossierNode.ts`, add after `content` field (line 11):

```typescript
contentText: { type: String, default: null },
```

Add text index after the composite index (line 21):

```typescript
dossierNodeSchema.index({ contentText: 'text', title: 'text' });
```

**Step 3: Create extractText helper**

Create `server/src/utils/extractText.ts`:

```typescript
export function extractTextFromTipTap(json: any): string {
  if (!json || !json.content) return '';
  const parts: string[] = [];
  function walk(node: any) {
    if (node.text) parts.push(node.text);
    if (node.content) node.content.forEach(walk);
  }
  walk(json);
  return parts.join(' ').trim();
}
```

**Step 4: Update nodeController.updateNode**

In `server/src/controllers/nodeController.ts`, import the helper at top:

```typescript
import { extractTextFromTipTap } from '../utils/extractText';
```

In `updateNode` function (line 50-67), before `await node.save()` (line 62), add:

```typescript
if (req.body.content && node.type === 'note') {
  node.contentText = extractTextFromTipTap(req.body.content);
}
```

Also in `createNode` (line 26-48), before `res.status(201).json(node)`, if content is provided:

```typescript
// After DossierNode.create, update contentText if note with content
if (node.type === 'note' && req.body.content) {
  node.contentText = extractTextFromTipTap(req.body.content);
  await node.save();
}
```

**Step 5: Commit**

```bash
git add server/src/types/index.ts server/src/models/DossierNode.ts server/src/utils/extractText.ts server/src/controllers/nodeController.ts
git commit -m "feat: add contentText extraction for full-text search on notes"
```

---

## Task 6: Advanced search backend

**Files:**
- Rewrite: `server/src/controllers/searchController.ts`

**Step 1: Rewrite searchController**

Replace `server/src/controllers/searchController.ts` entirely:

```typescript
import { Response } from 'express';
import Dossier from '../models/Dossier';
import DossierNode from '../models/DossierNode';
import { AuthRequest } from '../middleware/auth';

export async function search(req: AuthRequest, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string || '').trim();
    const status = req.query.status as string | undefined;
    const tags = req.query.tags as string | undefined;
    const owner = req.query.owner as string | undefined;
    const collaborator = req.query.collaborator as string | undefined;
    const nodeType = req.query.nodeType as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const sort = (req.query.sort as string) || 'relevance';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const userId = req.user!.userId;

    // --- Dossier search ---
    const dossierQuery: any = {
      $or: [{ owner: userId }, { collaborators: userId }],
    };

    if (q.length >= 2) {
      dossierQuery.$text = { $search: q };
    }
    if (status) {
      dossierQuery.status = status;
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (tagList.length) dossierQuery.tags = { $all: tagList };
    }
    if (owner) {
      dossierQuery.owner = owner;
    }
    if (collaborator) {
      dossierQuery.collaborators = collaborator;
    }
    if (dateFrom || dateTo) {
      dossierQuery.createdAt = {};
      if (dateFrom) dossierQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dossierQuery.createdAt.$lte = new Date(dateTo);
    }

    let dossierSort: any = { updatedAt: -1 };
    if (sort === 'title') dossierSort = { title: 1 };
    if (sort === 'date') dossierSort = { createdAt: -1 };

    const [dossiers, dossierTotal] = await Promise.all([
      Dossier.find(dossierQuery).select('title description status tags updatedAt owner').sort(dossierSort).skip(skip).limit(limit),
      Dossier.countDocuments(dossierQuery),
    ]);

    // --- Node search ---
    // Get accessible dossier IDs
    const accessibleDossierIds = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    }).distinct('_id');

    const nodeQuery: any = {
      dossierId: { $in: accessibleDossierIds },
      deletedAt: null,
    };

    if (q.length >= 2) {
      nodeQuery.$or = [
        { title: { $regex: q, $options: 'i' } },
        { contentText: { $regex: q, $options: 'i' } },
      ];
    }
    if (nodeType) {
      nodeQuery.type = nodeType;
    }

    const [nodes, nodeTotal] = await Promise.all([
      DossierNode.find(nodeQuery).select('dossierId title type contentText updatedAt').sort({ updatedAt: -1 }).skip(skip).limit(limit),
      DossierNode.countDocuments(nodeQuery),
    ]);

    res.json({
      dossiers,
      nodes,
      pagination: {
        page,
        limit,
        dossierTotal,
        nodeTotal,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
```

**Step 2: Commit**

```bash
git add server/src/controllers/searchController.ts
git commit -m "feat: advanced search with filters (status, tags, owner, date, nodeType, full-text)"
```

---

## Task 7: Advanced search UI

**Files:**
- Rewrite: `client/src/components/common/SearchBar.vue`

**Step 1: Enhance SearchBar with filter panel**

Rewrite `client/src/components/common/SearchBar.vue` to add:

1. A "Filtres" toggle button next to the search input
2. A dropdown filter panel with:
   - Status chips (Ouvert, En cours, Ferme) — toggle on/off
   - Tags combobox with autocomplete from `GET /dossiers/tags`
   - Node type chips (Note, Mindmap, Document, Dossier)
   - Date range: two date inputs (dateFrom, dateTo)
3. Active filters displayed as removable chips above results
4. Results grouped: dossiers section then nodes section
5. Pagination: "Charger plus" button if more results
6. Search term highlighting in titles via a `highlight(text, query)` helper

The search request becomes:
```typescript
const params: any = {};
if (query.value.length >= 2) params.q = query.value;
if (filters.status) params.status = filters.status;
if (filters.tags.length) params.tags = filters.tags.join(',');
if (filters.nodeType) params.nodeType = filters.nodeType;
if (filters.dateFrom) params.dateFrom = filters.dateFrom;
if (filters.dateTo) params.dateTo = filters.dateTo;
params.page = page.value;
params.limit = 20;

const { data } = await api.get('/search', { params });
```

**Step 2: Commit**

```bash
git add client/src/components/common/SearchBar.vue
git commit -m "feat: advanced search UI with filter panel, highlighting, pagination"
```

---

## Task 8: Activity Log model + helper

**Files:**
- Create: `server/src/models/ActivityLog.ts`
- Modify: `server/src/types/index.ts`
- Create: `server/src/utils/activityLogger.ts`

**Step 1: Add IActivityLog interface**

In `server/src/types/index.ts`, add at the end:

```typescript
export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  action: string;
  targetType: 'dossier' | 'user' | 'system';
  targetId: Types.ObjectId | null;
  metadata: Record<string, any>;
  ip: string;
  timestamp: Date;
}
```

**Step 2: Create ActivityLog model**

Create `server/src/models/ActivityLog.ts`:

```typescript
import mongoose, { Schema } from 'mongoose';
import { IActivityLog } from '../types';

const activityLogSchema = new Schema<IActivityLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: [
      'login', 'dossier.create', 'dossier.delete', 'dossier.update',
      'collaborator.add', 'collaborator.remove',
      'user.role_change', 'user.activate', 'user.deactivate', 'user.delete',
      'admin.reset_password', 'admin.reset_2fa',
    ],
    required: true,
  },
  targetType: { type: String, enum: ['dossier', 'user', 'system'], required: true },
  targetId: { type: Schema.Types.ObjectId, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true },
});

activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
```

**Step 3: Create logger helper**

Create `server/src/utils/activityLogger.ts`:

```typescript
import ActivityLog from '../models/ActivityLog';

export async function logActivity(
  userId: string,
  action: string,
  targetType: 'dossier' | 'user' | 'system',
  targetId: string | null,
  metadata: Record<string, any> = {},
  ip: string = ''
): Promise<void> {
  try {
    await ActivityLog.create({ userId, action, targetType, targetId, metadata, ip });
  } catch (err) {
    console.error('Activity log error:', err);
  }
}
```

**Step 4: Commit**

```bash
git add server/src/types/index.ts server/src/models/ActivityLog.ts server/src/utils/activityLogger.ts
git commit -m "feat: add ActivityLog model and logActivity helper"
```

---

## Task 9: Wire activity logging into controllers

**Files:**
- Modify: `server/src/controllers/authController.ts` (login)
- Modify: `server/src/controllers/dossierController.ts` (create, delete, update, collaborators)
- Modify: `server/src/controllers/adminController.ts` (all functions)

**Step 1: Add logging to login**

In `server/src/controllers/authController.ts`, import:

```typescript
import { logActivity } from '../utils/activityLogger';
```

After `await LoginLog.create(...)` in the `login` function, add:

```typescript
await logActivity(user._id.toString(), 'login', 'system', null, {}, user.lastLoginIp || '');
```

**Step 2: Add logging to dossier operations**

In `server/src/controllers/dossierController.ts`, import:

```typescript
import { logActivity } from '../utils/activityLogger';
```

In `createDossier`, after `Dossier.create`:
```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '';
await logActivity(req.user!.userId, 'dossier.create', 'dossier', dossier._id.toString(), { title: dossier.title }, ip);
```

In `deleteDossier`, after `dossier.deleteOne()`:
```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '';
await logActivity(req.user!.userId, 'dossier.delete', 'dossier', req.params.id, { title: dossier.title }, ip);
```

In `updateDossier`, after `dossier.save()`:
```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '';
await logActivity(req.user!.userId, 'dossier.update', 'dossier', dossier._id.toString(), { title: dossier.title }, ip);
```

In `updateCollaborators`, after `dossier.save()`:
```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '';
// Log added/removed collaborators
const previous = (await Dossier.findById(req.params.id))?.collaborators.map(c => c.toString()) || [];
const current = dossier.collaborators.map(c => c.toString());
const added = current.filter(c => !previous.includes(c));
const removed = previous.filter(c => !current.includes(c));
for (const uid of added) await logActivity(req.user!.userId, 'collaborator.add', 'dossier', dossier._id.toString(), { collaboratorId: uid }, ip);
for (const uid of removed) await logActivity(req.user!.userId, 'collaborator.remove', 'dossier', dossier._id.toString(), { collaboratorId: uid }, ip);
```

**Step 3: Add logging to admin operations**

In `server/src/controllers/adminController.ts`, import:

```typescript
import { logActivity } from '../utils/activityLogger';
```

In `updateUser`, after `User.findByIdAndUpdate`, log relevant changes:
```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '';
if (typeof isActive === 'boolean') {
  await logActivity(req.user!.userId, isActive ? 'user.activate' : 'user.deactivate', 'user', id as string, { email: user!.email }, ip);
}
if (role && role !== user!.role) {
  await logActivity(req.user!.userId, 'user.role_change', 'user', id as string, { email: user!.email, newRole: role }, ip);
}
```

In `resetUserPassword`, after `user.save()`:
```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '';
await logActivity(req.user!.userId, 'admin.reset_password', 'user', id as string, { email: user.email }, ip);
```

In `resetUser2FA`, after `user.save()`:
```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '';
await logActivity(req.user!.userId, 'admin.reset_2fa', 'user', id as string, { email: user.email }, ip);
```

In `deleteUser`, after `User.findByIdAndDelete`:
```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '';
await logActivity(req.user!.userId, 'user.delete', 'user', id as string, { email: user!.email }, ip);
```

**Step 4: Commit**

```bash
git add server/src/controllers/authController.ts server/src/controllers/dossierController.ts server/src/controllers/adminController.ts
git commit -m "feat: wire activity logging into auth, dossier, and admin controllers"
```

---

## Task 10: Activity logs admin endpoint

**Files:**
- Create: `server/src/controllers/activityLogController.ts`
- Modify: `server/src/routes/admin.ts`

**Step 1: Create controller**

Create `server/src/controllers/activityLogController.ts`:

```typescript
import { Response } from 'express';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middleware/auth';

export async function getActivityLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from as string);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to as string);
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('userId', 'firstName lastName email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
```

**Step 2: Add route**

In `server/src/routes/admin.ts`, import and add:

```typescript
import { getActivityLogs } from '../controllers/activityLogController';

router.get('/logs', getActivityLogs);
```

**Step 3: Commit**

```bash
git add server/src/controllers/activityLogController.ts server/src/routes/admin.ts
git commit -m "feat: add GET /admin/logs endpoint with pagination and filters"
```

---

## Task 11: Activity logs admin UI

**Files:**
- Create: `client/src/components/admin/AdminActivity.vue`
- Modify: `client/src/views/AdminView.vue`

**Step 1: Create AdminActivity component**

Create `client/src/components/admin/AdminActivity.vue`:

A paginated table showing:
- Timestamp (formatted fr-FR)
- User (firstName lastName from populated userId)
- Action (with icon mapping and translated label)
- Target (from metadata)
- IP

Filters at the top:
- Action select (all action enum values)
- Date range inputs
- "Charger plus" pagination button

Action label/icon mapping:
```typescript
const actionLabels: Record<string, { label: string; icon: string }> = {
  'login': { label: 'Connexion', icon: 'mdi-login' },
  'dossier.create': { label: 'Creation dossier', icon: 'mdi-folder-plus-outline' },
  'dossier.delete': { label: 'Suppression dossier', icon: 'mdi-folder-remove-outline' },
  'dossier.update': { label: 'Modification dossier', icon: 'mdi-folder-edit-outline' },
  'collaborator.add': { label: 'Ajout collaborateur', icon: 'mdi-account-plus-outline' },
  'collaborator.remove': { label: 'Retrait collaborateur', icon: 'mdi-account-minus-outline' },
  'user.role_change': { label: 'Changement role', icon: 'mdi-shield-account-outline' },
  'user.activate': { label: 'Activation compte', icon: 'mdi-account-check-outline' },
  'user.deactivate': { label: 'Desactivation compte', icon: 'mdi-account-off-outline' },
  'user.delete': { label: 'Suppression compte', icon: 'mdi-account-remove-outline' },
  'admin.reset_password': { label: 'Reset mot de passe', icon: 'mdi-lock-reset' },
  'admin.reset_2fa': { label: 'Reset 2FA', icon: 'mdi-shield-off-outline' },
};
```

Style: same admin table patterns as AdminUsers.vue (glass-card, admin-table, mono, at-badge).

**Step 2: Register in AdminView**

In `client/src/views/AdminView.vue`:

Import:
```typescript
import AdminActivity from '../components/admin/AdminActivity.vue';
```

Add section to sections array:
```typescript
{ id: 'activity', label: 'Activite', icon: 'mdi-history' },
```

Add template condition:
```vue
<AdminActivity v-else-if="activeSection === 'activity'" />
```

**Step 3: Commit**

```bash
git add client/src/components/admin/AdminActivity.vue client/src/views/AdminView.vue
git commit -m "feat: add activity logs section in admin panel"
```

---

## Task 12: Notification model + backend

**Files:**
- Modify: `server/src/types/index.ts`
- Create: `server/src/models/Notification.ts`
- Create: `server/src/controllers/notificationController.ts`
- Create: `server/src/routes/notifications.ts`
- Modify: `server/src/index.ts`

**Step 1: Add INotification interface**

In `server/src/types/index.ts`, add:

```typescript
export interface INotification extends Document {
  userId: Types.ObjectId;
  type: 'collaborator.added' | 'collaborator.removed' | 'dossier.updated' | 'node.updated';
  message: string;
  dossierId: Types.ObjectId | null;
  fromUserId: Types.ObjectId | null;
  read: boolean;
  createdAt: Date;
}
```

**Step 2: Create Notification model**

Create `server/src/models/Notification.ts`:

```typescript
import mongoose, { Schema } from 'mongoose';
import { INotification } from '../types';

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['collaborator.added', 'collaborator.removed', 'dossier.updated', 'node.updated'],
      required: true,
    },
    message: { type: String, required: true },
    dossierId: { type: Schema.Types.ObjectId, ref: 'Dossier', default: null },
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model<INotification>('Notification', notificationSchema);
```

**Step 3: Create notification controller**

Create `server/src/controllers/notificationController.ts`:

```typescript
import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user!.userId })
        .populate('fromUserId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId: req.user!.userId }),
      Notification.countDocuments({ userId: req.user!.userId, read: false }),
    ]);

    res.json({ notifications, total, unreadCount, page, limit });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function markRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.userId },
      { read: true }
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function markAllRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await Notification.updateMany({ userId: req.user!.userId, read: false }, { read: true });
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
```

**Step 4: Create routes**

Create `server/src/routes/notifications.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getNotifications, markRead, markAllRead } from '../controllers/notificationController';

const router = Router();
router.use(authenticate);

router.get('/', getNotifications);
router.patch('/:id/read', markRead);
router.patch('/read-all', markAllRead);

export default router;
```

**Step 5: Register route in index.ts**

In `server/src/index.ts`, add import and route (after searchRoutes, line 51):

```typescript
import notificationRoutes from './routes/notifications';
// ...
app.use('/api/notifications', notificationRoutes);
```

**Step 6: Commit**

```bash
git add server/src/types/index.ts server/src/models/Notification.ts server/src/controllers/notificationController.ts server/src/routes/notifications.ts server/src/index.ts
git commit -m "feat: add Notification model, CRUD endpoints, and routes"
```

---

## Task 13: Notification creation helper + Socket.io emission

**Files:**
- Create: `server/src/utils/notifier.ts`
- Modify: `server/src/socket/index.ts`

**Step 1: Export io instance from socket setup**

In `server/src/socket/index.ts`, export the io instance so the notifier can use it:

Add at top of file:
```typescript
let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}
```

In `setupSocket`, before `return io`:
```typescript
ioInstance = io;
```

Also, we need to track which socket belongs to which user. Add a Map:

```typescript
const userSockets = new Map<string, Set<string>>();

export function getUserSockets(): Map<string, Set<string>> {
  return userSockets;
}
```

On connection, add socket to user's set:
```typescript
if (!userSockets.has(user.userId)) userSockets.set(user.userId, new Set());
userSockets.get(user.userId)!.add(socket.id);
```

On disconnect, remove:
```typescript
userSockets.get(user.userId)?.delete(socket.id);
if (userSockets.get(user.userId)?.size === 0) userSockets.delete(user.userId);
```

**Step 2: Create notifier helper**

Create `server/src/utils/notifier.ts`:

```typescript
import Notification from '../models/Notification';
import { getIO, getUserSockets } from '../socket';

export async function createNotification(
  userId: string,
  type: 'collaborator.added' | 'collaborator.removed' | 'dossier.updated' | 'node.updated',
  message: string,
  dossierId: string | null = null,
  fromUserId: string | null = null
): Promise<void> {
  try {
    const notification = await Notification.create({ userId, type, message, dossierId, fromUserId });
    const populated = await notification.populate('fromUserId', 'firstName lastName');

    const io = getIO();
    const sockets = getUserSockets().get(userId);
    if (io && sockets) {
      for (const socketId of sockets) {
        io.to(socketId).emit('notification:new', populated);
      }
    }
  } catch (err) {
    console.error('Notification error:', err);
  }
}
```

**Step 3: Commit**

```bash
git add server/src/socket/index.ts server/src/utils/notifier.ts
git commit -m "feat: add notification creation helper with Socket.io real-time emission"
```

---

## Task 14: Wire notifications into collaboration events

**Files:**
- Modify: `server/src/controllers/dossierController.ts`

**Step 1: Add notifications to collaborator changes**

In `server/src/controllers/dossierController.ts`, import:

```typescript
import { createNotification } from '../utils/notifier';
import User from '../models/User';
```

In `updateCollaborators`, after saving, notify added/removed users:

```typescript
const actor = await User.findById(req.user!.userId).select('firstName lastName');
const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Un utilisateur';

for (const uid of added) {
  await createNotification(uid, 'collaborator.added', `${actorName} vous a ajoute au dossier "${dossier.title}"`, dossier._id.toString(), req.user!.userId);
}
for (const uid of removed) {
  await createNotification(uid, 'collaborator.removed', `${actorName} vous a retire du dossier "${dossier.title}"`, dossier._id.toString(), req.user!.userId);
}
```

**Step 2: Add notifications on dossier update for collaborators**

In `updateDossier`, after save, notify collaborators:

```typescript
const actor = await User.findById(req.user!.userId).select('firstName lastName');
const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Un utilisateur';
for (const collab of dossier.collaborators) {
  const collabId = collab.toString();
  if (collabId !== req.user!.userId) {
    await createNotification(collabId, 'dossier.updated', `${actorName} a modifie le dossier "${dossier.title}"`, dossier._id.toString(), req.user!.userId);
  }
}
```

**Step 3: Commit**

```bash
git add server/src/controllers/dossierController.ts
git commit -m "feat: send notifications on collaborator add/remove and dossier updates"
```

---

## Task 15: Notification UI (bell + dropdown)

**Files:**
- Create: `client/src/composables/useNotifications.ts`
- Create: `client/src/components/common/NotificationBell.vue`
- Modify: `client/src/components/common/AppBar.vue` (or wherever the navbar is)

**Step 1: Create useNotifications composable**

Create `client/src/composables/useNotifications.ts`:

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import api from '../services/api';
import { getSocket } from '../services/socket';

interface Notification {
  _id: string;
  type: string;
  message: string;
  dossierId: string | null;
  fromUserId: { firstName: string; lastName: string } | null;
  read: boolean;
  createdAt: string;
}

const notifications = ref<Notification[]>([]);
const unreadCount = ref(0);

export function useNotifications() {
  async function fetch() {
    const { data } = await api.get('/notifications', { params: { limit: 20 } });
    notifications.value = data.notifications;
    unreadCount.value = data.unreadCount;
  }

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    const n = notifications.value.find(n => n._id === id);
    if (n && !n.read) {
      n.read = true;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    notifications.value.forEach(n => n.read = true);
    unreadCount.value = 0;
  }

  function setupSocketListener() {
    const socket = getSocket();
    if (!socket) return;
    socket.on('notification:new', (notif: Notification) => {
      notifications.value.unshift(notif);
      unreadCount.value++;
    });
  }

  function cleanupSocketListener() {
    const socket = getSocket();
    socket?.off('notification:new');
  }

  return { notifications, unreadCount, fetch, markRead, markAllRead, setupSocketListener, cleanupSocketListener };
}
```

**Step 2: Create NotificationBell component**

Create `client/src/components/common/NotificationBell.vue`:

Bell icon with badge showing unreadCount. On click, opens a dropdown (absolute positioned) listing recent notifications. Each notification shows:
- Icon by type
- Message text
- Time ago (relative)
- Unread indicator (dot)
- Click: marks as read + navigates to dossier if dossierId exists

Header with "Tout marquer comme lu" button.

Style: same glass-card pattern, max-height 400px, scrollable.

**Step 3: Add NotificationBell to AppBar**

In the AppBar component, import and place `<NotificationBell />` next to the user menu / settings area.

**Step 4: Commit**

```bash
git add client/src/composables/useNotifications.ts client/src/components/common/NotificationBell.vue client/src/components/common/AppBar.vue
git commit -m "feat: add notification bell with dropdown and real-time updates"
```

---

## Task 16: Collaborator management UI

**Files:**
- Modify: `client/src/components/dossier/DossierInfo.vue` (or the info panel)

**Step 1: Add collaborator management section**

In the dossier info panel, add a "Collaborateurs" section:

- List of current collaborators with avatar initials + name + remove button (owner only)
- Autocomplete input to search users: `GET /admin/users` filtered client-side (or add a public `GET /api/users/search?q=` endpoint)
- "Inviter" button that calls `PATCH /dossiers/:id/collaborators`

We need a user search endpoint accessible to non-admins. Add to auth routes:

Create `server/src/controllers/userSearchController.ts`:
```typescript
import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

export async function searchUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) { res.json([]); return; }
    const users = await User.find({
      isActive: true,
      _id: { $ne: req.user!.userId },
      $or: [
        { email: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
      ],
    }).select('firstName lastName email').limit(10);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}
```

Add route in `server/src/routes/auth.ts` (or create a users route):
```typescript
router.get('/users/search', authenticate, searchUsers);
```

**Step 2: Build the collaborator UI**

In DossierInfo.vue, add:
```vue
<div class="collab-section" v-if="isOwner">
  <h4 class="mono">Collaborateurs</h4>
  <div v-for="collab in collaborators" :key="collab._id" class="collab-row">
    <span class="at-avatar">{{ (collab.firstName[0] + collab.lastName[0]).toUpperCase() }}</span>
    <span>{{ collab.firstName }} {{ collab.lastName }}</span>
    <button @click="removeCollaborator(collab._id)" class="at-action-btn at-action-danger">
      <v-icon size="14">mdi-close</v-icon>
    </button>
  </div>
  <v-autocomplete
    v-model="selectedUser"
    :items="userSearchResults"
    :search="userSearch"
    item-title="email"
    item-value="_id"
    label="Ajouter un collaborateur"
    density="compact"
    hide-details
    return-object
    @update:search="searchUsersDebounced"
    @update:model-value="addCollaborator"
  />
</div>
```

The collaborators data needs to be populated (currently just ObjectId array). Either populate on getDossier or fetch user info client-side.

**Step 3: Commit**

```bash
git add server/src/controllers/userSearchController.ts server/src/routes/auth.ts client/src/components/dossier/DossierInfo.vue
git commit -m "feat: add collaborator management UI with user search"
```

---

## Task 17: Yjs WebSocket server

**Files:**
- Create: `server/src/yjs-server.ts`
- Modify: `server/src/index.ts`

**Step 1: Create Yjs WebSocket server**

Create `server/src/yjs-server.ts`:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { LeveldbPersistence } from 'y-leveldb';
import path from 'path';

const persistence = new LeveldbPersistence(path.join(__dirname, '..', 'yjs-docs'));

export function startYjsServer(port: number = 3002) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws: WebSocket, req) => {
    // Extract token from query params
    const url = new URL(req.url || '', `http://localhost:${port}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    // Extract room name from URL path (e.g., /node:abc123)
    const docName = url.pathname.slice(1); // remove leading /

    setupWSConnection(ws, req, {
      docName,
      gc: true,
    });
  });

  console.log(`Yjs WebSocket server running on port ${port}`);
  return wss;
}
```

**Step 2: Start Yjs server from index.ts**

In `server/src/index.ts`, add at the end of the `start()` function, after `httpServer.listen`:

```typescript
import { startYjsServer } from './yjs-server';

// Inside start():
const yjsPort = parseInt(process.env.YJS_PORT || '3002');
startYjsServer(yjsPort);
```

Add to `.env`:
```
YJS_PORT=3002
```

Add `yjs-docs/` to `.gitignore`.

**Step 3: Commit**

```bash
git add server/src/yjs-server.ts server/src/index.ts server/.env.example .gitignore
git commit -m "feat: add Yjs WebSocket server with JWT auth and LevelDB persistence"
```

---

## Task 18: Collaborative TipTap editor

**Files:**
- Modify: `client/src/components/editor/NoteEditor.vue`

**Step 1: Add Yjs collaboration to NoteEditor**

In `client/src/components/editor/NoteEditor.vue`:

Add imports:
```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
```

Setup Yjs doc and provider when component mounts (using the nodeId):

```typescript
const ydoc = new Y.Doc();
const yjsUrl = import.meta.env.VITE_YJS_URL || 'ws://localhost:3002';
const token = localStorage.getItem('accessToken');
const provider = new WebsocketProvider(yjsUrl, `node:${props.node._id}`, ydoc, {
  params: { token: token || '' },
});

// Set awareness user info
const authStore = useAuthStore();
const userColor = '#' + Math.floor(Math.abs(Math.sin(authStore.user!.id.charCodeAt(0)) * 16777215) % 16777215).toString(16).padStart(6, '0');
provider.awareness.setLocalStateField('user', {
  name: `${authStore.user!.firstName} ${authStore.user!.lastName}`,
  color: userColor,
});
```

Replace StarterKit and manual content loading with Collaboration extension:

```typescript
// In editor extensions array, replace StarterKit with:
StarterKit.configure({ history: false }), // Disable history, Yjs handles it
Collaboration.configure({ document: ydoc }),
CollaborationCursor.configure({
  provider,
  user: { name: `${authStore.user!.firstName}`, color: userColor },
}),
```

Remove the manual debounced save for content (Yjs handles sync). Keep the API save as a fallback/persistence sync:
- On `provider.on('synced')`, if ydoc is empty but node has content, initialize ydoc from existing content
- Periodically (every 30s), extract content from ydoc and save to API to keep MongoDB in sync

Add presence indicators at the top of the editor:
```vue
<div class="collab-users">
  <span v-for="user in awarenessUsers" :key="user.name" class="collab-avatar" :style="{ borderColor: user.color }">
    {{ user.name[0] }}
  </span>
</div>
```

On unmount, destroy provider and ydoc:
```typescript
onUnmounted(() => {
  provider.destroy();
  ydoc.destroy();
});
```

**Step 2: Commit**

```bash
git add client/src/components/editor/NoteEditor.vue
git commit -m "feat: add Yjs collaborative editing to TipTap with cursors and presence"
```

---

## Task 19: Collaborative Excalidraw editor

**Files:**
- Modify: `client/src/components/excalidraw/ExcalidrawWrapper.vue`

**Step 1: Add Yjs collaboration to Excalidraw**

In `client/src/components/excalidraw/ExcalidrawWrapper.vue`:

Add imports:
```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
```

Setup Yjs doc and provider (same pattern as NoteEditor):

```typescript
const ydoc = new Y.Doc();
const yjsUrl = import.meta.env.VITE_YJS_URL || 'ws://localhost:3002';
const token = localStorage.getItem('accessToken');
const provider = new WebsocketProvider(yjsUrl, `node:${props.node._id}`, ydoc, {
  params: { token: token || '' },
});
```

Use a `Y.Map` to store Excalidraw elements:

```typescript
const yElements = ydoc.getMap('excalidraw-elements');
const yAppState = ydoc.getMap('excalidraw-appstate');
```

Sync strategy:
- On Excalidraw `onChange`, update yElements with the new elements array
- Observe yElements changes and update Excalidraw scene via `excalidrawAPI.updateScene()`
- Use awareness for pointer/cursor positions via `onPointerUpdate` callback

```typescript
// When Excalidraw changes (local)
function handleChange(elements: any[], appState: any) {
  yElements.set('elements', elements);
}

// When Yjs doc changes (remote)
yElements.observe(() => {
  const elements = yElements.get('elements');
  if (elements && excalidrawAPI) {
    excalidrawAPI.updateScene({ elements });
  }
});
```

Add presence indicators (same pattern as NoteEditor).

Remove old Socket.io excalidraw-update emit/listen — Yjs handles it.

On unmount:
```typescript
provider.destroy();
ydoc.destroy();
```

**Step 2: Commit**

```bash
git add client/src/components/excalidraw/ExcalidrawWrapper.vue
git commit -m "feat: add Yjs collaborative editing to Excalidraw with presence"
```

---

## Task 20: Yjs-to-MongoDB persistence sync

**Files:**
- Modify: `server/src/yjs-server.ts`

**Step 1: Add periodic MongoDB sync**

The Yjs server needs to periodically sync document content back to MongoDB so that search indexing (contentText) and API reads stay up to date.

In `server/src/yjs-server.ts`, add:

```typescript
import DossierNode from './models/DossierNode';
import { extractTextFromTipTap } from './utils/extractText';
import * as Y from 'yjs';

// After setupWSConnection, set up a debounced sync
const syncTimers = new Map<string, NodeJS.Timeout>();

function scheduleMongoPersist(docName: string) {
  if (syncTimers.has(docName)) clearTimeout(syncTimers.get(docName));
  syncTimers.set(docName, setTimeout(async () => {
    try {
      const ydoc = await persistence.getYDoc(docName);
      const nodeId = docName.replace('node:', '');

      // Check if it's a note (has XML fragment) or mindmap (has map)
      const xmlFragment = ydoc.getXmlFragment('default');
      const yMap = ydoc.getMap('excalidraw-elements');

      if (xmlFragment.length > 0) {
        // TipTap content — convert Y.XmlFragment to JSON would be complex,
        // so we store a signal that Yjs is the source of truth
        // The client will sync content to API periodically
      }

      if (yMap.get('elements')) {
        const node = await DossierNode.findById(nodeId);
        if (node) {
          node.excalidrawData = yMap.get('elements');
          await node.save();
        }
      }

      ydoc.destroy();
    } catch (err) {
      console.error('Yjs MongoDB sync error:', err);
    }
  }, 10000)); // 10s debounce
}
```

Hook into y-websocket's document update callbacks to trigger sync.

**Step 2: Commit**

```bash
git add server/src/yjs-server.ts
git commit -m "feat: add Yjs-to-MongoDB periodic persistence sync"
```

---

## Task 21: Remove obsolete Socket.io node sync events

**Files:**
- Modify: `server/src/socket/index.ts`
- Modify: `client/src/stores/dossier.ts`

**Step 1: Keep Socket.io events but mark as fallback**

In `server/src/socket/index.ts`, the `node-update` and `excalidraw-update` events can remain as fallback for non-collaborative scenarios (e.g., when Yjs is unavailable). No changes needed — they'll simply not be emitted by the client anymore for notes/mindmaps using Yjs.

In `client/src/stores/dossier.ts`, the `emitNodeUpdate` and `emitExcalidrawUpdate` functions remain but the NoteEditor and ExcalidrawWrapper no longer call them when Yjs is active. The socket listeners for `node-updated` and `excalidraw-updated` serve as fallback.

Add a comment documenting this:

```typescript
// Note: emitNodeUpdate/emitExcalidrawUpdate are fallback for non-Yjs mode.
// When Yjs collaboration is active, sync happens via y-websocket.
```

**Step 2: Commit**

```bash
git add server/src/socket/index.ts client/src/stores/dossier.ts
git commit -m "refactor: document Socket.io events as fallback, Yjs is primary sync"
```

---

## Task 22: Environment config + Docker update

**Files:**
- Modify: `server/.env` (add YJS_PORT)
- Modify: `client/.env` (add VITE_YJS_URL)
- Modify: `docker-compose.yml` (if exists, expose port 3002)

**Step 1: Update env files**

Server `.env`:
```
YJS_PORT=3002
```

Client `.env`:
```
VITE_YJS_URL=ws://localhost:3002
```

**Step 2: Update Docker config if present**

If `docker-compose.yml` exists, add port 3002 mapping to the server service.

**Step 3: Commit**

```bash
git add server/.env.example client/.env.example docker-compose.yml
git commit -m "chore: add Yjs WebSocket config to env files and Docker"
```

---

## Summary

| Task | Feature | Files |
|------|---------|-------|
| 1 | Dependencies | package.json |
| 2-4 | Tags | Dossier model, controller, UI |
| 5-7 | Advanced Search | DossierNode model, searchController, SearchBar |
| 8-11 | Activity Logs | ActivityLog model, helper, controllers, admin UI |
| 12-15 | Notifications | Notification model, controller, Socket.io, bell UI |
| 16 | Collaborator UI | User search, DossierInfo |
| 17-21 | Real-time Collab | Yjs server, TipTap collab, Excalidraw collab, sync |
| 22 | Config | Env files, Docker |
