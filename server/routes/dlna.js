import { Router } from 'express'
import {
  discoverDlnaDevices,
  listCachedDevices,
  dlnaPlay,
  dlnaStop,
  getAdvertisedBaseUrl,
} from '../utils/dlna.js'
import { createStreamTicket } from '../utils/streamTicket.js'
import { resolvePlayStreamRel } from './play.js'

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
    const title = String(req.body?.name || req.body?.title || '音频')
    const artist = String(req.body?.singer || req.body?.artist || '')
    const album = String(req.body?.album || '')

    const { rel } = await resolvePlayStreamRel(req)
    if (!rel) return res.status(400).json({ error: '无法解析可投送的播放地址' })

    const uri = toAbs(req, signRel(req, rel))
    const result = await dlnaPlay(udn, { uri, title, artist, album })
    res.json({ ok: true, ...result, uri })
  } catch (e) {
    const status = Number(e.status) || 400
    res.status(status >= 400 && status < 600 ? status : 400).json({
      error: e.message || '投屏失败',
      code: e.code,
    })
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
