import { Router } from 'express'
import path from 'path'
import {
  discoverDlnaDevices,
  listCachedDevices,
  dlnaPlay,
  dlnaStop,
  getAdvertisedBaseUrl,
} from '../utils/dlna.js'
import { createStreamTicket } from '../utils/streamTicket.js'
import { resolvePathByTrackId } from '../utils/libraryCache.js'
import { isAllowedMediaPath, mapToContainerPath } from '../utils/filePaths.js'
import { getEpisodeForUser } from '../utils/podcastStore.js'

function wrapRemotePlayUrl(url, source) {
  if (!url || String(url).startsWith('/api/play/')) return url
  if (!/^https?:\/\//i.test(url)) return url
  return `/api/play/proxy?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source || '')}`
}

export const dlnaRouter = Router()

function toAbs(req, relUrl) {
  const base = getAdvertisedBaseUrl(req)
  if (!relUrl) return ''
  if (/^https?:\/\//i.test(relUrl)) return relUrl
  const pathPart = relUrl.startsWith('/') ? relUrl : `/${relUrl}`
  return `${base}${pathPart}`
}

function signRel(req, relUrl) {
  const ticket = createStreamTicket({
    userId: req.user.id,
    role: req.user.role,
    scope: String(relUrl).includes('/play/proxy') ? 'proxy' : 'local',
    ttlSec: 4 * 60 * 60,
  })
  const join = relUrl.includes('?') ? '&' : '?'
  return `${relUrl}${join}ticket=${encodeURIComponent(ticket)}`
}

dlnaRouter.get('/devices', async (req, res) => {
  try {
    const refresh = String(req.query.refresh || '') === '1'
    const devices = refresh ? await discoverDlnaDevices() : listCachedDevices()
    if (!devices.length && !refresh) {
      const found = await discoverDlnaDevices()
      return res.json({ ok: true, data: found, advertisedBase: getAdvertisedBaseUrl(req) })
    }
    res.json({ ok: true, data: devices, advertisedBase: getAdvertisedBaseUrl(req) })
  } catch (e) {
    res.status(500).json({ error: e.message || '搜索 DLNA 设备失败。Docker 需使用 host 网络才能发现电视/音箱。' })
  }
})

dlnaRouter.post('/play', async (req, res) => {
  try {
    const udn = String(req.body?.udn || '').trim()
    if (!udn) return res.status(400).json({ error: '请选择设备' })
    const trackId = String(req.body?.trackId || '').trim()
    const episodeId = String(req.body?.podcastEpisodeId || req.body?.episodeId || '').trim()
    const title = String(req.body?.name || req.body?.title || '音频')
    const artist = String(req.body?.singer || req.body?.artist || '')
    const album = String(req.body?.album || '')

    let rel = ''
    if (episodeId) {
      const ep = getEpisodeForUser(req.user.id, episodeId)
      if (!ep?.audioUrl) return res.status(404).json({ error: '节目不存在' })
      rel = wrapRemotePlayUrl(ep.audioUrl, 'podcast')
    } else if (trackId) {
      const filePath = resolvePathByTrackId(trackId)
      if (!filePath || !isAllowedMediaPath(filePath, { userId: req.user.id })) {
        return res.status(400).json({ error: '仅支持投送本账号音乐库中的本地曲目（或播客节目）' })
      }
      const mapped = mapToContainerPath(filePath) || filePath
      const ext = path.extname(mapped).toLowerCase()
      const qs = `trackId=${encodeURIComponent(trackId)}`
      rel = (ext === '.ape' || ext === '.dsf' || ext === '.dff')
        ? `/api/play/local-smooth?${qs}`
        : `/api/play/local?${qs}`
    } else {
      const localPath = String(req.body?.localPath || req.body?.filePath || '').trim()
      if (!localPath || !isAllowedMediaPath(localPath, { userId: req.user.id })) {
        return res.status(400).json({ error: '请提供 trackId、本地路径或播客节目 id' })
      }
      const mapped = mapToContainerPath(localPath) || localPath
      const resolved = path.resolve(mapped)
      const ext = path.extname(resolved).toLowerCase()
      const qs = `path=${encodeURIComponent(resolved)}`
      rel = (ext === '.ape' || ext === '.dsf' || ext === '.dff')
        ? `/api/play/local-smooth?${qs}`
        : `/api/play/local?${qs}`
    }

    const uri = toAbs(req, signRel(req, rel))
    const result = await dlnaPlay(udn, { uri, title, artist, album })
    res.json({ ok: true, ...result, uri })
  } catch (e) {
    res.status(400).json({ error: e.message || '投屏失败' })
  }
})

dlnaRouter.post('/stop', async (req, res) => {
  try {
    const udn = String(req.body?.udn || '').trim()
    if (!udn) return res.status(400).json({ error: '请选择设备' })
    const result = await dlnaStop(udn)
    res.json(result)
  } catch (e) {
    res.status(400).json({ error: e.message || '停止失败' })
  }
})
