import { randomUUID } from 'crypto'
import { getDB } from '../db.js'
import { fetchPodcastFeed } from './podcastRss.js'

export function ensurePodcastTables() {
  const db = getDB()
  if (!db) return
  db.exec(`
    CREATE TABLE IF NOT EXISTS podcast_feeds (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT DEFAULT '',
      author TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      site_url TEXT DEFAULT '',
      last_error TEXT DEFAULT '',
      last_fetched_at INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(user_id, url)
    );
    CREATE INDEX IF NOT EXISTS idx_podcast_feeds_user ON podcast_feeds(user_id);

    CREATE TABLE IF NOT EXISTS podcast_episodes (
      id TEXT PRIMARY KEY,
      feed_id TEXT NOT NULL,
      guid TEXT NOT NULL,
      title TEXT DEFAULT '',
      description TEXT DEFAULT '',
      audio_url TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      pub_date INTEGER DEFAULT 0,
      image_url TEXT DEFAULT '',
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(feed_id, guid),
      FOREIGN KEY (feed_id) REFERENCES podcast_feeds(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_podcast_episodes_feed ON podcast_episodes(feed_id, pub_date DESC);
  `)
}

function mapFeed(row, extra = {}) {
  if (!row) return null
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    author: row.author,
    description: row.description,
    imageUrl: row.image_url,
    siteUrl: row.site_url,
    lastError: row.last_error || '',
    lastFetchedAt: row.last_fetched_at || 0,
    createdAt: row.created_at,
    episodeCount: extra.episodeCount ?? row.episode_count ?? 0,
  }
}

function mapEpisode(row, feed = null) {
  if (!row) return null
  return {
    id: row.id,
    feedId: row.feed_id,
    guid: row.guid,
    title: row.title,
    description: row.description,
    audioUrl: row.audio_url,
    duration: row.duration || 0,
    pubDate: row.pub_date || 0,
    imageUrl: row.image_url || feed?.imageUrl || '',
    feedTitle: feed?.title || row.feed_title || '',
    feedAuthor: feed?.author || row.feed_author || '',
    feedImageUrl: feed?.imageUrl || row.feed_image_url || '',
  }
}

export function episodeToTrack(ep) {
  if (!ep) return null
  const singer = ep.feedAuthor || ep.feedTitle || '播客'
  return {
    id: ep.id,
    key: `podcast:${ep.id}`,
    source: 'podcast',
    name: ep.title,
    singer,
    album: ep.feedTitle || '播客',
    albumName: ep.feedTitle || '播客',
    duration: ep.duration || 0,
    picUrl: ep.imageUrl || ep.feedImageUrl || '',
    img: ep.imageUrl || ep.feedImageUrl || '',
    podcastEpisodeId: ep.id,
    podcastFeedId: ep.feedId,
  }
}

function upsertEpisodes(feedId, episodes) {
  const db = getDB()
  const insert = db.prepare(`
    INSERT INTO podcast_episodes (id, feed_id, guid, title, description, audio_url, duration, pub_date, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(feed_id, guid) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      audio_url = excluded.audio_url,
      duration = excluded.duration,
      pub_date = excluded.pub_date,
      image_url = excluded.image_url
  `)
  const tx = db.transaction((list) => {
    for (const ep of list) {
      insert.run(
        randomUUID(),
        feedId,
        ep.guid,
        ep.title,
        ep.description,
        ep.audioUrl,
        ep.duration || 0,
        ep.pubDate || 0,
        ep.imageUrl || '',
      )
    }
  })
  tx(episodes)
}

export function listFeeds(userId) {
  ensurePodcastTables()
  const rows = getDB().prepare(`
    SELECT f.*, (SELECT COUNT(*) FROM podcast_episodes e WHERE e.feed_id = f.id) AS episode_count
    FROM podcast_feeds f
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(userId)
  return rows.map((r) => mapFeed(r))
}

export function getFeed(userId, feedId) {
  ensurePodcastTables()
  const row = getDB().prepare('SELECT * FROM podcast_feeds WHERE id = ? AND user_id = ?').get(feedId, userId)
  if (!row) return null
  const episodeCount = getDB().prepare('SELECT COUNT(*) AS n FROM podcast_episodes WHERE feed_id = ?').get(feedId)?.n || 0
  return mapFeed(row, { episodeCount })
}

export function listEpisodes(userId, feedId, { page = 1, limit = 50 } = {}) {
  const feed = getFeed(userId, feedId)
  if (!feed) return null
  const lim = Math.min(100, Math.max(1, Number(limit) || 50))
  const pg = Math.max(1, Number(page) || 1)
  const offset = (pg - 1) * lim
  const total = getDB().prepare('SELECT COUNT(*) AS n FROM podcast_episodes WHERE feed_id = ?').get(feedId)?.n || 0
  const rows = getDB().prepare(`
    SELECT * FROM podcast_episodes WHERE feed_id = ?
    ORDER BY pub_date DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(feedId, lim, offset)
  return {
    feed,
    total,
    page: pg,
    limit: lim,
    episodes: rows.map((r) => mapEpisode(r, feed)),
  }
}

export function getEpisodeForUser(userId, episodeId) {
  ensurePodcastTables()
  const row = getDB().prepare(`
    SELECT e.*, f.title AS feed_title, f.author AS feed_author, f.image_url AS feed_image_url, f.user_id
    FROM podcast_episodes e
    JOIN podcast_feeds f ON f.id = e.feed_id
    WHERE e.id = ? AND f.user_id = ?
  `).get(episodeId, userId)
  return mapEpisode(row)
}

export async function subscribeFeed(userId, url) {
  ensurePodcastTables()
  const normalized = String(url || '').trim()
  const parsed = await fetchPodcastFeed(normalized)
  const existing = getDB().prepare('SELECT id FROM podcast_feeds WHERE user_id = ? AND url = ?').get(userId, normalized)
  const id = existing?.id || randomUUID()
  getDB().prepare(`
    INSERT INTO podcast_feeds (id, user_id, url, title, author, description, image_url, site_url, last_error, last_fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', unixepoch())
    ON CONFLICT(user_id, url) DO UPDATE SET
      title = excluded.title,
      author = excluded.author,
      description = excluded.description,
      image_url = excluded.image_url,
      site_url = excluded.site_url,
      last_error = '',
      last_fetched_at = unixepoch()
  `).run(
    id,
    userId,
    normalized,
    parsed.meta.title,
    parsed.meta.author,
    parsed.meta.description,
    parsed.meta.imageUrl,
    parsed.meta.siteUrl,
  )
  upsertEpisodes(id, parsed.episodes)
  return getFeed(userId, id)
}

export async function refreshFeed(userId, feedId) {
  const feed = getFeed(userId, feedId)
  if (!feed) throw new Error('订阅不存在')
  try {
    const parsed = await fetchPodcastFeed(feed.url)
    getDB().prepare(`
      UPDATE podcast_feeds SET
        title = ?, author = ?, description = ?, image_url = ?, site_url = ?,
        last_error = '', last_fetched_at = unixepoch()
      WHERE id = ? AND user_id = ?
    `).run(
      parsed.meta.title,
      parsed.meta.author,
      parsed.meta.description,
      parsed.meta.imageUrl,
      parsed.meta.siteUrl,
      feedId,
      userId,
    )
    upsertEpisodes(feedId, parsed.episodes)
    return getFeed(userId, feedId)
  } catch (e) {
    getDB().prepare('UPDATE podcast_feeds SET last_error = ? WHERE id = ? AND user_id = ?')
      .run(String(e.message || e).slice(0, 300), feedId, userId)
    throw e
  }
}

export function unsubscribeFeed(userId, feedId) {
  ensurePodcastTables()
  const info = getDB().prepare('DELETE FROM podcast_feeds WHERE id = ? AND user_id = ?').run(feedId, userId)
  if (info.changes) {
    getDB().prepare('DELETE FROM podcast_episodes WHERE feed_id = ?').run(feedId)
  }
  return info.changes > 0
}
