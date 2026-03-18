/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

/**
 * Strava profile & activity scraper.
 *
 * URL patterns supported:
 *   - https://www.strava.com/athletes/{id}           → athlete profile
 *   - https://www.strava.com/athletes/{id}/follows    → follower list (redirects to profile)
 *   - https://www.strava.com/activities/{id}          → single activity
 *   - https://www.strava.com/clubs/{slug}             → club page
 *
 * OSINT value:
 *   - Profile: name, location, bio, photo, stats (distance, elevation, activities)
 *   - Activities: GPS traces, start/end points (home identification), timestamps, routines
 *   - Clubs: group membership, social connections
 *   - Segments: leaderboards revealing who runs/rides where and when
 */
export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'strava',
    username: '',
    displayName: '',
    bio: '',
    profileImageUrl: '',
    stats: {},
    registrationDate: null,
    extraImages: [],
    rawMetadata: {},
  };

  try {
    // ── Detect URL type ──
    const athleteMatch = url.match(/strava\.com\/athletes\/([^/?#]+)/i);
    const activityMatch = url.match(/strava\.com\/activities\/(\d+)/i);
    const clubMatch = url.match(/strava\.com\/clubs\/([^/?#]+)/i);

    if (athleteMatch) {
      result.username = athleteMatch[1];
      result.rawMetadata.urlType = 'athlete';
    } else if (activityMatch) {
      result.rawMetadata.urlType = 'activity';
      result.rawMetadata.activityId = activityMatch[1];
    } else if (clubMatch) {
      result.rawMetadata.urlType = 'club';
      result.rawMetadata.clubSlug = clubMatch[1];
    }

    // ── Intercept API / XHR responses ──
    let apiAthleteData: any = null;
    let apiActivityData: any = null;
    let apiClubData: any = null;

    const responseHandler = async (response: any) => {
      try {
        const rUrl = response.url();
        const ct = response.headers()['content-type'] || '';
        if (!ct.includes('json') && !ct.includes('javascript')) return;

        // Athlete feed / profile API
        if (rUrl.includes('/athletes/') && rUrl.includes('.json')) {
          const json = await response.json().catch(() => null);
          if (json) apiAthleteData = json;
        }
        // Activity API
        if (rUrl.includes('/activities/') && rUrl.includes('.json')) {
          const json = await response.json().catch(() => null);
          if (json) apiActivityData = json;
        }
        // Club API
        if (rUrl.includes('/clubs/') && rUrl.includes('.json')) {
          const json = await response.json().catch(() => null);
          if (json) apiClubData = json;
        }
        // React initial state / __NEXT_DATA__ / appContext
        if (rUrl.includes('react_') || rUrl.includes('bundle')) return; // skip JS bundles
      } catch {
        // Ignore
      }
    };

    page.on('response', responseHandler);

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await randomDelay();

    // Dismiss cookie / login banners
    await page.evaluate(() => {
      // Cookie consent
      const cookieBtn = document.querySelector<HTMLElement>(
        'button[data-cy="accept-cookies"], .btn-accept-cookie-banner, [class*="cookie"] button'
      );
      if (cookieBtn) cookieBtn.click();
      // Login modal overlay
      const overlay = document.querySelector<HTMLElement>('.modal-overlay, [class*="upsell"] button[class*="close"]');
      if (overlay) overlay.click();
    });
    await delay(1500);

    // ── Route to specific extractor ──
    if (result.rawMetadata.urlType === 'activity') {
      await extractActivity(page, result, apiActivityData);
    } else if (result.rawMetadata.urlType === 'club') {
      await extractClub(page, result, apiClubData);
    } else {
      await extractAthlete(page, result, apiAthleteData);
    }

    // ── React / server-rendered data extraction (fallback) ──
    const serverData = await page.evaluate(() => {
      // Check for __NEXT_DATA__ or embedded JSON
      const nextScript = document.querySelector('script#__NEXT_DATA__');
      if (nextScript) {
        try { return JSON.parse(nextScript.textContent || '{}'); } catch { /* ignore */ }
      }
      // Check for data-react-props
      const reactEl = document.querySelector('[data-react-class]');
      if (reactEl) {
        try { return JSON.parse(reactEl.getAttribute('data-react-props') || '{}'); } catch { /* ignore */ }
      }
      return null;
    });

    if (serverData) {
      result.rawMetadata.serverData = serverData;
      // Try to extract athlete info from server data
      const athlete = serverData?.props?.pageProps?.athlete
        || serverData?.athlete
        || serverData?.props?.athlete;
      if (athlete) {
        if (!result.displayName && athlete.name) result.displayName = athlete.name;
        if (!result.profileImageUrl && athlete.profile) result.profileImageUrl = athlete.profile;
        if (!result.bio && athlete.bio) result.bio = athlete.bio;
        if (athlete.city) result.rawMetadata.city = athlete.city;
        if (athlete.state) result.rawMetadata.state = athlete.state;
        if (athlete.country) result.rawMetadata.country = athlete.country;
      }
    }

    // ── og:image fallback ──
    if (!result.profileImageUrl) {
      result.profileImageUrl = await page.evaluate(() =>
        document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
      );
    }

    // og:description for bio
    if (!result.bio) {
      result.bio = await page.evaluate(() =>
        document.querySelector('meta[property="og:description"]')?.getAttribute('content') || ''
      );
    }

    page.off('response', responseHandler);
  } catch (error: any) {
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

/**
 * Extract athlete profile data from DOM.
 */
async function extractAthlete(page: Page, result: ProfileData, apiData: any): Promise<void> {
  // ── API data first ──
  if (apiData) {
    result.rawMetadata.apiAthlete = apiData;
    const a = apiData.athlete || apiData;
    if (a.firstname || a.lastname) {
      result.displayName = `${a.firstname || ''} ${a.lastname || ''}`.trim();
    }
    if (a.profile || a.profile_medium) {
      result.profileImageUrl = a.profile || a.profile_medium;
    }
    if (a.bio) result.bio = a.bio;
    if (a.city) result.rawMetadata.city = a.city;
    if (a.state) result.rawMetadata.state = a.state;
    if (a.country) result.rawMetadata.country = a.country;
    if (a.sex) result.rawMetadata.gender = a.sex === 'M' ? 'Homme' : a.sex === 'F' ? 'Femme' : a.sex;
    if (a.premium) result.rawMetadata.premium = true;
    if (a.summit) result.rawMetadata.summit = true;
    if (a.created_at) result.registrationDate = a.created_at;
    if (a.follower_count != null) result.stats.followers = a.follower_count;
    if (a.friend_count != null) result.stats.following = a.friend_count;
    if (a.mutual_friend_count != null) result.stats.mutualFriends = a.mutual_friend_count;
  }

  // ── DOM extraction (profile page) ──
  const domData = await page.evaluate(() => {
    const data: Record<string, any> = {};

    // Name
    const nameEl = document.querySelector('h1.athlete-name, h1[class*="AthleteHeader"], .athlete-title h1, h1, [data-testid="athlete-name"]');
    data.displayName = nameEl?.textContent?.trim() || '';

    // Profile photo
    const avatarImg = document.querySelector<HTMLImageElement>(
      'img.avatar-img, img[class*="avatar"], .athlete-avatar img, .avatar img, .profile-picture img'
    );
    data.profileImageUrl = avatarImg?.src || '';
    if (data.profileImageUrl.includes('/medium.jpg')) {
      data.profileImageUrl = data.profileImageUrl.replace('/medium.jpg', '/large.jpg');
    }

    // Location
    const locEl = document.querySelector('.location, [class*="location"], .athlete-location');
    data.location = locEl?.textContent?.trim() || '';

    // Bio / description
    const bioEl = document.querySelector('.athlete-bio, [class*="bio"], .description');
    data.bio = bioEl?.textContent?.trim() || '';

    // Stats section
    const statEls = document.querySelectorAll('.stat, [class*="Stat"], .inline-stats li, .athlete-stats li');
    const stats: Record<string, string> = {};
    statEls.forEach(el => {
      const label = el.querySelector('.stat-subtext, .label, small, [class*="label"]')?.textContent?.trim()?.toLowerCase() || '';
      const value = el.querySelector('.stat-text, .value, [class*="value"], b, strong')?.textContent?.trim() || '';
      if (label && value) {
        if (label.includes('following') || label.includes('abonnement')) stats.following = value;
        else if (label.includes('follower') || label.includes('abonn')) stats.followers = value;
        else if (label.includes('activit')) stats.activities = value;
      }
    });
    data.stats = stats;

    // Clubs
    const clubs: string[] = [];
    document.querySelectorAll('a[href*="/clubs/"]').forEach(el => {
      const name = el.textContent?.trim();
      if (name && !clubs.includes(name)) clubs.push(name);
    });
    data.clubs = clubs;

    // Trophies / badges
    const trophies: string[] = [];
    document.querySelectorAll('[class*="trophy"], [class*="badge"], [class*="achievement"]').forEach(el => {
      const text = el.textContent?.trim();
      if (text && !trophies.includes(text)) trophies.push(text);
    });
    data.trophies = trophies;

    return data;
  });

  // Merge DOM data (don't overwrite API data)
  if (domData.displayName && !result.displayName) result.displayName = domData.displayName;
  if (domData.profileImageUrl && !result.profileImageUrl) result.profileImageUrl = domData.profileImageUrl;
  if (domData.location && !result.rawMetadata.city) {
    result.rawMetadata.location = domData.location;
  }
  if (domData.bio && !result.bio) result.bio = domData.bio;

  if (domData.stats && Object.keys(domData.stats).length > 0) {
    for (const [k, v] of Object.entries(domData.stats)) {
      if (!result.stats[k]) result.stats[k] = v as string;
    }
  }
  if (domData.clubs?.length > 0) result.rawMetadata.clubs = domData.clubs;
  if (domData.trophies?.length > 0) result.rawMetadata.trophies = domData.trophies;

  // Build location string
  const parts = [result.rawMetadata.city, result.rawMetadata.state, result.rawMetadata.country].filter(Boolean);
  if (parts.length > 0 && !result.rawMetadata.location) {
    result.rawMetadata.location = parts.join(', ');
  }

  // ── Yearly stats from profile page ──
  const yearlyStats = await page.evaluate(() => {
    const statsData: Record<string, any> = {};
    const statSections = document.querySelectorAll('[class*="stat-section"], [class*="year-stat"], .interval-stats, .athlete-stats');
    statSections.forEach(section => {
      const heading = section.querySelector('h3, h4, [class*="heading"]')?.textContent?.trim() || 'stats';
      const items: Record<string, string> = {};
      section.querySelectorAll('[class*="stat"], .stat, li').forEach(item => {
        const label = item.querySelector('[class*="label"], small, .stat-subtext')?.textContent?.trim() || '';
        const value = item.querySelector('[class*="value"], b, strong, .stat-text')?.textContent?.trim() || '';
        if (label && value) items[label] = value;
      });
      if (Object.keys(items).length > 0) statsData[heading] = items;
    });
    return statsData;
  });
  if (Object.keys(yearlyStats).length > 0) {
    result.rawMetadata.yearlyStats = yearlyStats;
  }

  // ── Username from URL or page ──
  if (!result.username) {
    const pageUsername = await page.evaluate(() => {
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      const match = canonical.match(/athletes\/([^/?#]+)/);
      return match ? match[1] : '';
    });
    if (pageUsername) result.username = pageUsername;
  }

  // ── FULL ACTIVITY HISTORY: scroll the feed to load all activities ──
  const allActivities = await scrollAndCollectActivities(page);
  if (allActivities.length > 0) {
    result.rawMetadata.recentActivities = allActivities;
    // Collect first 10 map images
    let mapCount = 0;
    for (const act of allActivities) {
      if (act.mapUrl && mapCount < 10 && !result.extraImages.includes(act.mapUrl)) {
        result.extraImages.push(act.mapUrl);
        mapCount++;
      }
    }
  }

  // ── Navigate to training log for historical overview ──
  const athleteId = result.username;
  if (athleteId) {
    try {
      await extractTrainingLog(page, result, athleteId);
    } catch (e: any) {
      console.log(`[Strava] Training log extraction failed: ${e.message}`);
    }
  }
}

/**
 * Scroll the athlete feed to load ALL activities (not just recent).
 * Strava uses infinite scroll — we keep scrolling until no new activities appear.
 */
async function scrollAndCollectActivities(page: Page): Promise<any[]> {
  const MAX_SCROLLS = 50; // Safety limit (~200+ activities)
  const SCROLL_PAUSE = 1500;

  let previousCount = 0;
  let noChangeRounds = 0;

  for (let i = 0; i < MAX_SCROLLS; i++) {
    const currentCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/activities/"]').length;
    });

    if (currentCount === previousCount) {
      noChangeRounds++;
      if (noChangeRounds >= 3) break; // No new content after 3 scrolls — we've reached the end
    } else {
      noChangeRounds = 0;
    }
    previousCount = currentCount;

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(SCROLL_PAUSE);

    // Click "Show more" or "Load more" button if present
    await page.evaluate(() => {
      const moreBtn = document.querySelector<HTMLElement>(
        'button[class*="load-more"], [class*="show-more"], [class*="btn-more"], [data-testid="load-more"]'
      );
      if (moreBtn) moreBtn.click();
    });
  }

  // Now collect ALL loaded activities
  const activities = await page.evaluate(() => {
    const results: any[] = [];
    const seen = new Set<string>();

    // Collect all activity links and their surrounding context
    document.querySelectorAll('[class*="activity"], .feed-entry, .activity-card, [data-testid="activity-entry"], .entry-container').forEach(card => {
      const linkEl = card.querySelector('a[href*="/activities/"]');
      const link = linkEl?.getAttribute('href') || '';
      if (!link || seen.has(link)) return;
      seen.add(link);

      const title = card.querySelector('[class*="entry-title"], [class*="activity-name"], h3, a[href*="/activities/"]')?.textContent?.trim() || '';
      const time = card.querySelector('time, [class*="timestamp"], [class*="date"]')?.textContent?.trim()
        || card.querySelector('[class*="time"]')?.textContent?.trim() || '';
      const statsText = card.querySelector('[class*="stats"], [class*="entry-stat"], [class*="inline-stats"]')?.textContent?.trim() || '';
      const typeEl = card.querySelector('[class*="activity-icon"], [class*="app-icon"], [class*="activity-type"]');
      const actType = typeEl?.getAttribute('title') || typeEl?.textContent?.trim() || '';
      const mapImg = card.querySelector<HTMLImageElement>('img[class*="map"], img[src*="maps"], img[src*="polyline"]');
      const mapUrl = mapImg?.src || '';

      results.push({
        title,
        link: link.startsWith('http') ? link : `https://www.strava.com${link}`,
        time,
        stats: statsText,
        type: actType,
        mapUrl,
      });
    });

    // Fallback: also collect standalone activity links not in cards
    document.querySelectorAll('a[href*="/activities/"]').forEach(el => {
      const link = el.getAttribute('href') || '';
      if (!link || seen.has(link)) return;
      const match = link.match(/\/activities\/(\d+)/);
      if (!match) return;
      seen.add(link);
      results.push({
        title: el.textContent?.trim() || `Activité ${match[1]}`,
        link: link.startsWith('http') ? link : `https://www.strava.com${link}`,
        time: '',
        stats: '',
        type: '',
        mapUrl: '',
      });
    });

    return results;
  });

  return activities;
}

/**
 * Navigate to training log page to extract historical activity data.
 * URL: /athletes/{id}/training/log?sport=&time_period=all
 * This shows a calendar/table of all past activities grouped by week.
 */
async function extractTrainingLog(page: Page, result: ProfileData, athleteId: string): Promise<void> {
  const trainingUrl = `https://www.strava.com/athletes/${athleteId}/training/log`;
  await page.goto(trainingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2000);

  // Extract the training log data
  const logData = await page.evaluate(() => {
    const data: Record<string, any> = {};

    // Activity year range — find all year selectors/tabs
    const years: string[] = [];
    document.querySelectorAll('[class*="year"], option, [data-year], a[href*="year_offset"]').forEach(el => {
      const text = el.textContent?.trim() || '';
      const yearMatch = text.match(/20\d{2}/);
      if (yearMatch && !years.includes(yearMatch[0])) years.push(yearMatch[0]);
    });
    data.activeYears = years.sort();

    // Training log entries (weekly summaries)
    const entries: any[] = [];
    document.querySelectorAll('tr, [class*="training-log-entry"], [class*="week-row"]').forEach(row => {
      const cells = row.querySelectorAll('td, [class*="cell"]');
      if (cells.length >= 2) {
        const dateCell = cells[0]?.textContent?.trim() || '';
        const dataCell = cells[1]?.textContent?.trim() || '';
        if (dateCell && dataCell) {
          entries.push({ date: dateCell, summary: dataCell });
        }
      }
    });
    data.trainingEntries = entries.slice(0, 200); // Limit

    // Activities from the log view
    const logActivities: any[] = [];
    const seen = new Set<string>();
    document.querySelectorAll('a[href*="/activities/"]').forEach(el => {
      const link = el.getAttribute('href') || '';
      if (!link || seen.has(link)) return;
      seen.add(link);
      const title = el.textContent?.trim() || '';
      // Try to find date context from parent row
      const parentRow = el.closest('tr, [class*="row"], [class*="entry"]');
      const dateEl = parentRow?.querySelector('time, [class*="date"], td:first-child');
      const date = dateEl?.textContent?.trim() || '';
      logActivities.push({
        title,
        link: link.startsWith('http') ? link : `https://www.strava.com${link}`,
        date,
      });
    });
    data.logActivities = logActivities;

    // Overall totals if visible
    const totals: Record<string, string> = {};
    document.querySelectorAll('[class*="total"], [class*="summary"]').forEach(el => {
      const label = el.querySelector('[class*="label"], small')?.textContent?.trim() || '';
      const value = el.querySelector('[class*="value"], strong, b')?.textContent?.trim() || '';
      if (label && value) totals[label] = value;
    });
    data.totals = totals;

    return data;
  });

  if (logData.activeYears?.length > 0) {
    result.rawMetadata.activeYears = logData.activeYears;
    // Deduce activity range
    const first = logData.activeYears[0];
    const last = logData.activeYears[logData.activeYears.length - 1];
    result.rawMetadata.activityRange = `${first} — ${last}`;
  }

  if (logData.totals && Object.keys(logData.totals).length > 0) {
    result.rawMetadata.trainingTotals = logData.totals;
  }

  // Merge log activities with existing ones (deduplicate by link)
  if (logData.logActivities?.length > 0) {
    const existingLinks = new Set((result.rawMetadata.recentActivities || []).map((a: any) => a.link));
    const newActivities = logData.logActivities.filter((a: any) => !existingLinks.has(a.link));
    if (newActivities.length > 0) {
      result.rawMetadata.recentActivities = [
        ...(result.rawMetadata.recentActivities || []),
        ...newActivities.map((a: any) => ({
          title: a.title,
          link: a.link,
          time: a.date,
          stats: '',
          type: '',
          mapUrl: '',
        })),
      ];
    }
  }

  if (logData.trainingEntries?.length > 0) {
    result.rawMetadata.trainingLog = logData.trainingEntries;
  }
}

/**
 * Extract single activity data from DOM.
 * OSINT value: GPS trace, timestamps, start location, elevation, route.
 */
async function extractActivity(page: Page, result: ProfileData, apiData: any): Promise<void> {
  if (apiData) {
    result.rawMetadata.apiActivity = apiData;
  }

  const actData = await page.evaluate(() => {
    const data: Record<string, any> = {};

    // Activity title
    const titleEl = document.querySelector('h1[class*="Activity"], .activity-name h1, h1, [data-testid="activity_name"]');
    data.activityTitle = titleEl?.textContent?.trim() || '';

    // Athlete name (activity owner)
    const nameEl = document.querySelector('a[href*="/athletes/"], [class*="owner-name"], [data-testid="owner-name"]');
    data.displayName = nameEl?.textContent?.trim() || '';
    const nameLink = nameEl?.getAttribute('href') || '';
    const idMatch = nameLink.match(/athletes\/(\d+)/);
    data.athleteId = idMatch ? idMatch[1] : '';

    // Activity date/time
    const timeEl = document.querySelector('time, [class*="date"], [class*="timestamp"]');
    data.activityDate = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

    // Activity type
    const typeEl = document.querySelector('[class*="activity-type"], [class*="sport-type"], [data-testid="activity_type"]');
    data.activityType = typeEl?.textContent?.trim() || '';

    // Stats (distance, elevation, time, pace, etc.)
    const stats: Record<string, string> = {};
    document.querySelectorAll('[class*="stat"], .inline-stats li, [class*="Stat"]').forEach(el => {
      const label = el.querySelector('[class*="label"], .label, small, .unit')?.textContent?.trim() || '';
      const value = el.querySelector('[class*="value"], .value, b, strong')?.textContent?.trim()
        || el.querySelector('[class*="number"]')?.textContent?.trim() || '';
      if (label && value) stats[label] = value;
      else if (value) {
        // Try to identify by parent class
        const parent = el.className || '';
        if (parent.includes('distance')) stats['Distance'] = value;
        else if (parent.includes('elev')) stats['Dénivelé'] = value;
        else if (parent.includes('time') || parent.includes('duration')) stats['Durée'] = value;
        else if (parent.includes('pace') || parent.includes('speed')) stats['Allure/Vitesse'] = value;
        else if (parent.includes('calorie')) stats['Calories'] = value;
        else if (parent.includes('heart') || parent.includes('hr')) stats['FC moy.'] = value;
      }
    });
    data.stats = stats;

    // Location
    const locEl = document.querySelector('[class*="location"], .activity-location');
    data.location = locEl?.textContent?.trim() || '';

    // Description
    const descEl = document.querySelector('[class*="description"], .activity-description');
    data.description = descEl?.textContent?.trim() || '';

    // Map image (static polyline map or screenshot)
    const mapImg = document.querySelector<HTMLImageElement>(
      'img[class*="map"], img[src*="maps"], img[src*="polyline"], [class*="activity-map"] img'
    );
    data.mapImageUrl = mapImg?.src || '';

    // Kudos count
    const kudosEl = document.querySelector('[class*="kudos"] [class*="count"], [data-testid="kudos_count"]');
    data.kudos = kudosEl?.textContent?.trim() || '';

    // Comments count
    const commentsEl = document.querySelector('[class*="comments"] [class*="count"], [data-testid="comments_count"]');
    data.comments = commentsEl?.textContent?.trim() || '';

    // Athlete profile image
    const avatar = document.querySelector<HTMLImageElement>('img[class*="avatar"], .avatar img');
    data.profileImageUrl = avatar?.src || '';

    // Segments
    const segments: any[] = [];
    document.querySelectorAll('[class*="segment"], tr[data-segment-id]').forEach((seg, i) => {
      if (i >= 20) return;
      const name = seg.querySelector('[class*="name"], a')?.textContent?.trim() || '';
      const time = seg.querySelector('[class*="time"], [class*="result"]')?.textContent?.trim() || '';
      segments.push({ name, time });
    });
    data.segments = segments;

    // Photos
    const photos: string[] = [];
    document.querySelectorAll('[class*="photo"] img, [class*="PhotoGrid"] img').forEach(img => {
      const src = (img as HTMLImageElement).src;
      if (src && !src.includes('avatar')) photos.push(src);
    });
    data.photos = photos;

    return data;
  });

  // Map activity data to ProfileData
  result.displayName = actData.displayName || '';
  result.username = actData.athleteId || result.rawMetadata.activityId || '';
  result.bio = actData.description || '';
  result.profileImageUrl = actData.profileImageUrl || '';

  if (actData.mapImageUrl) {
    result.extraImages.push(actData.mapImageUrl);
  }
  if (actData.photos?.length > 0) {
    result.extraImages.push(...actData.photos);
  }

  result.rawMetadata.activityTitle = actData.activityTitle;
  result.rawMetadata.activityType = actData.activityType;
  result.rawMetadata.activityDate = actData.activityDate;
  result.rawMetadata.location = actData.location;
  result.rawMetadata.kudos = actData.kudos;
  result.rawMetadata.commentsCount = actData.comments;
  result.rawMetadata.segments = actData.segments;
  result.rawMetadata.photos = actData.photos;

  // Stats
  for (const [k, v] of Object.entries(actData.stats || {})) {
    result.stats[k] = v as string;
  }
}

/**
 * Extract club data from DOM.
 */
async function extractClub(page: Page, result: ProfileData, apiData: any): Promise<void> {
  if (apiData) {
    result.rawMetadata.apiClub = apiData;
  }

  const clubData = await page.evaluate(() => {
    const data: Record<string, any> = {};

    // Club name
    const nameEl = document.querySelector('h1, [class*="club-name"], [data-testid="club-name"]');
    data.name = nameEl?.textContent?.trim() || '';

    // Club image
    const img = document.querySelector<HTMLImageElement>('.club-avatar img, [class*="club"] img.avatar, img[class*="club-image"]');
    data.imageUrl = img?.src || '';

    // Location
    const locEl = document.querySelector('[class*="location"], .club-location');
    data.location = locEl?.textContent?.trim() || '';

    // Description
    const descEl = document.querySelector('[class*="description"], .club-description, .club-bio');
    data.description = descEl?.textContent?.trim() || '';

    // Club type & sport
    const typeEl = document.querySelector('[class*="club-type"], [class*="sport-type"]');
    data.clubType = typeEl?.textContent?.trim() || '';

    // Member count
    const memberEl = document.querySelector('[class*="member-count"], [class*="members"] .count');
    data.memberCount = memberEl?.textContent?.trim() || '';

    // Members list (visible ones)
    const members: any[] = [];
    document.querySelectorAll('[class*="member"], .club-member, a[href*="/athletes/"]').forEach((el, i) => {
      if (i >= 50) return;
      const name = el.textContent?.trim() || '';
      const link = el.getAttribute('href') || '';
      const idMatch = link.match(/athletes\/(\d+)/);
      if (name && idMatch) {
        members.push({ name, athleteId: idMatch[1], profileUrl: `https://www.strava.com${link}` });
      }
    });
    data.members = members;

    // Recent activity
    const activities: any[] = [];
    document.querySelectorAll('[class*="activity"], .feed-entry').forEach((card, i) => {
      if (i >= 10) return;
      const title = card.querySelector('[class*="entry-title"], h3, a[href*="/activities/"]')?.textContent?.trim() || '';
      const athlete = card.querySelector('a[href*="/athletes/"]')?.textContent?.trim() || '';
      const link = card.querySelector('a[href*="/activities/"]')?.getAttribute('href') || '';
      if (title || athlete) activities.push({ title, athlete, link: link ? `https://www.strava.com${link}` : '' });
    });
    data.recentActivities = activities;

    return data;
  });

  result.displayName = clubData.name || '';
  result.username = result.rawMetadata.clubSlug || '';
  result.bio = clubData.description || '';
  result.profileImageUrl = clubData.imageUrl || '';
  result.rawMetadata.location = clubData.location;
  result.rawMetadata.clubType = clubData.clubType;
  result.rawMetadata.memberCount = clubData.memberCount;
  result.rawMetadata.members = clubData.members;
  result.rawMetadata.recentActivities = clubData.recentActivities;
  result.rawMetadata.accountType = 'club';

  if (clubData.memberCount) result.stats.members = clubData.memberCount;
}
