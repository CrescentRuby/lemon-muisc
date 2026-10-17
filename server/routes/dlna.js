import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import {
  discoverDlnaDevices,
  listCachedDevices,
  dlnaPlay,
  dlnaStop,
  dlnaGetStatus,
  getAdvertisedBaseUrl,
} from '../utils/dlna.js'
import { createStreamTicket } from '../utils/streamTicket.js'
import { resolvePlayStreamRel } from './play.js'
import { ensureDlnaPlayMp3 } from '../utils/dlnaTranscode.js'
import { resolvePathByTrackId } from '../utils/libraryCache.js'
import { mapToContainerPath } from '../utils/filePaths.js'

export const dlnaRouter = Router()

function toAbs(req, relUrl) {
  let base = getAdvertisedBaseUrl(req)
  // 音箱几乎不支持 HTTPS
  base = String(base || '').replace(/^https:/i, 'http:')
  if (!relUrl) return ''
  if (/^https?:\/\//i.test(relUrl)) return relUrl.replace(/^https:/i, 'http:')
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

function isLosslessQuality(q) {
  return /flac|hires|hi-res|hi_res|master|ape|wav|sq|999k|2000k/i.test(String(q || ''))
}

function toDlnaFriendlyRel(rel, extra = {}) {
  const raw = String(rel || '')
  if (!raw) return raw
  if (extra.local) {
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
    return `/api/play/dlna.mp3${q}`
  }
  if (raw.includes('/play/proxy?')) return raw.replace('/play/proxy?', '/play/proxy.mp3?')
  return raw
}

async function resolveDlnaStreamRel(req) {
  if (!isLosslessQuality(req.body?.quality)) {
    const result = await resolvePlayStreamRel(req)
    return { ...result, rel: toDlnaFriendlyRel(result.rel, result.extra) }
  }
  const saved = req.body
  for (const quality of ['320k', '128k']) {
    try {
      req.body = { ...saved, quality, type: quality }
      const result = await resolvePlayStreamRel(req)
      if (result?.rel) {
        req.body = saved
        return { ...result, rel: toDlnaFriendlyRel(result.rel, result.extra) }
      }
    } catch {}
  }
  req.body = saved
  const result = await resolvePlayStreamRel(req)
  return { ...result, rel: toDlnaFriendlyRel(result.rel, result.extra) }
}

async function warmupDlnaMp3(req) {
  const tid = String(req.body?.trackId || '').trim()
  let file = tid ? (resolvePathByTrackId(tid) || '') : ''
  if (!file) file = String(req.body?.localPath || req.body?.filePath || '')
  if (!file) return
  const resolved = path.resolve(mapToContainerPath(file) || file)
  const exists = fs.existsSync(resolved) ? resolved : path.resolve(file)
  if (!fs.existsSync(exists)) return
  if (path.extname(exists).toLowerCase() === '.mp3') return
  await ensureDlnaPlayMp3(exists)
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
    const title = String(req.body?.name || req.body?.title || '音频')
    const artist = String(req.body?.singer || req.body?.artist || '')
    const album = String(req.body?.album || '')

    const { rel, extra } = await resolveDlnaStreamRel(req)
    if (!rel) return res.status(400).json({ error: '无法解析可投送的播放地址' })
    if (extra?.local) {
      try { await warmupDlnaMp3(req) } catch {}
    }

    const uri = toAbs(req, signRel(req, rel))
    const result = await dlnaPlay(udn, { uri, title, artist, album, mime: 'audio/mpeg' })
    res.json({ ok: true, ...result, uri })
  } catch (e) {
    const status = Number(e.status) || 400
    res.status(status >= 400 && status < 600 ? status : 400).json({
      error: e.message || '投屏失败',
      code: e.code,
    })
  }
})

dlnaRouter.get('/status', async (req, res) => {
  try {
    const udn = String(req.query.udn || '').trim()
    if (!udn) return res.status(400).json({ error: '缺少设备' })
    const result = await dlnaGetStatus(udn)
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ error: e.message || '查询投屏状态失败' })
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
