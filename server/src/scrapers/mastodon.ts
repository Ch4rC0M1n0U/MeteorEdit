/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

// Mastodon uses public API — no Puppeteer needed, but we receive the Page for interface compatibility
export async function scrape(_page: Page, url: string): Promise<ProfileData> {
  // Extract instance and username from URL
  // Formats: https://mastodon.social/@username, https://instance.tld/@user
  const urlObj = new URL(url);
  const instance = urlObj.origin;
  const pathMatch = urlObj.pathname.match(/^\/@([^\/]+)/);
  if (!pathMatch) throw new Error('Invalid Mastodon URL');
  const username = pathMatch[1];

  // Call Mastodon public API directly (no Puppeteer needed)
  const apiUrl = `${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(username)}`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`Mastodon API error: ${response.status}`);
  const data = await response.json() as any;

  // Extract custom fields (links, pronouns, etc.)
  const fields = (data.fields || []).map((f: any) => `${f.name}: ${f.value?.replace(/<[^>]*>/g, '')}`);

  // Strip HTML from bio
  const bio = (data.note || '').replace(/<[^>]*>/g, '').trim();

  return {
    platform: 'mastodon',
    username: data.username || username,
    displayName: data.display_name || username,
    bio,
    profileImageUrl: data.avatar || '',
    stats: {
      followers: data.followers_count || 0,
      following: data.following_count || 0,
      posts: data.statuses_count || 0,
    },
    registrationDate: data.created_at || null,
    extraImages: data.header && !data.header.includes('missing') ? [data.header] : [],
    rawMetadata: {
      ...data,
      instance,
      customFields: fields,
    },
  };
}
