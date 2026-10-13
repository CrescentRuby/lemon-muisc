import { Router } from 'express'
import {
  fetchNewSongs,
  fetchNewAlbums,
  fetchToplists,
  fetchToplistDetail,
  getDiscoverRegions,
} from '../discoverSdk.js'
import { getDisplaySources } from '../utils/displaySources.js'
import { formatUserError } from '../utils/userError.js'
import { createLimiter, withTimeout } from '../utils/asyncLimit.js'
import {
  buildDiscoverFeedKey,
  getOrFetchDiscoverFeed,
} from '../utils/discoverFeedCache.js'

export const discoverRouter = Router()

const availableSources = (req) => getDisplaySources(req.user?.id)
const discoverLimiter = createLimiter(4)
/** 与前端发现页超时对齐：失败尽快返回，避免拖到 30s×重试 */
const TIMEOUT_MS = 18000

function guardSource(req, source) {
  if (!availableSources(req)[source]) {
    const err = new Error(`不支持的平台: ${source}`)
    err.status = 400
    throw err
  }
}

function sendFeed(res, result) {
  // 命中磁盘/内存时可被浏览器短缓存；未命中仍可缓存极短时间减少连点
  res.setHeader('Cache-Control', result.cached
    ? (result.stale ? 'private, max-age=30' : 'private, max-age=120')
    : 'private, max-age=15')
  res.json({
    ok: true,
    data: result.data,
    cached: result.cached,
    stale: result.stale,
  })
}

discoverRouter.get('/regions', (req, res) => {
  const { source = 'tx', kind = 'songs' } = req.query
  if (!availableSources(req)[source]) {
    return res.status(400).json({ error: `不支持的平台: ${source}` })
  }
  res.json({ ok: true, regions: getDiscoverRegions(String(source), String(kind)) })
})

discoverRouter.get('/new-songs', async (req, res) => {
  try {
    const { source = 'tx', region = '', page = 1, limit = 27 } = req.query
    guardSource(req, source)
    const pageNum = Number(page) || 1
    const limitNum = Number(limit) || 27
    const cacheKey = buildDiscoverFeedKey(['newsongs', source, region, pageNum, limitNum])
    const result = await getOrFetchDiscoverFeed(cacheKey, () => discoverLimiter(() => withTimeout(
      fetchNewSongs(String(source), String(region), pageNum, limitNum),
      TIMEOUT_MS,
      '获取新歌超时，请稍后重试',
    )))
    sendFeed(res, result)
  } catch (e) {
    res.status(e.status || 500).json({ error: formatUserError(e, '获取新歌失败，请稍后重试') })
  }
})

discoverRouter.get('/new-albums', async (req, res) => {
  try {
    const { source = 'tx', region = '', page = 1, limit = 20 } = req.query
    guardSource(req, source)
    const pageNum = Number(page) || 1
    const limitNum = Number(limit) || 20
    const cacheKey = buildDiscoverFeedKey(['newalbums', source, region, pageNum, limitNum])
    const result = await getOrFetchDiscoverFeed(cacheKey, () => discoverLimiter(() => withTimeout(
      fetchNewAlbums(String(source), String(region), pageNum, limitNum),
      TIMEOUT_MS,
      '获取新碟超时，请稍后重试',
    )))
    sendFeed(res, result)
  } catch (e) {
    res.status(e.status || 500).json({ error: formatUserError(e, '获取新碟失败，请稍后重试') })
  }
})

discoverRouter.get('/toplists', async (req, res) => {
  try {
    const { source = 'tx' } = req.query
    guardSource(req, source)
    const cacheKey = buildDiscoverFeedKey(['toplists', source])
    const result = await getOrFetchDiscoverFeed(cacheKey, () => discoverLimiter(() => withTimeout(
      fetchToplists(String(source)),
      TIMEOUT_MS,
      '获取排行榜超时，请稍后重试',
    )))
    sendFeed(res, result)
  } catch (e) {
    res.status(e.status || 500).json({ error: formatUserError(e, '获取排行榜失败，请稍后重试') })
  }
})

discoverRouter.get('/toplist', async (req, res) => {
  try {
    const { source = 'tx', id = '', page = 1, limit = 100 } = req.query
    guardSource(req, source)
    if (!id) return res.status(400).json({ error: '缺少榜单 ID' })
    const pageNum = Number(page) || 1
    const limitNum = Number(limit) || 100
    const cacheKey = buildDiscoverFeedKey(['toplist', source, id, pageNum, limitNum])
    const result = await getOrFetchDiscoverFeed(cacheKey, () => discoverLimiter(() => withTimeout(
      fetchToplistDetail(String(source), String(id), pageNum, limitNum),
      TIMEOUT_MS,
      '获取榜单详情超时，请稍后重试',
    )))
    sendFeed(res, result)
  } catch (e) {
    res.status(e.status || 500).json({ error: formatUserError(e, '获取榜单详情失败，请稍后重试') })
  }
})
