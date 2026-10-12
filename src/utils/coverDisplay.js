import { withStreamAuth } from './streamAuth.js'
import { isAppIconUrl } from './appIcon.js'

/**
 * 把外链封面转成同源代理，避免音源 CDN 按 Referer 防盗链导致播放器裂图。
 * @param {string} url
 * @param {{ size?: number }} [opts] size：列表缩略图边长（如 240），写入 w= 供服务端选较小 CDN 图并分缓存键
 */
export function toPlayableCoverUrl(url, opts = {}) {
  const raw = String(url || '').trim()
  if (!raw || isAppIconUrl(raw)) return raw
  if (/^(data:|blob:)/i.test(raw)) return raw
  const size = Number(opts.size) > 0 ? Math.min(500, Math.round(Number(opts.size))) : 0

  const withSize = (u) => {
    if (!size) return u
    if (/[?&]w=\d+/i.test(u)) return u
    const sep = u.includes('?') ? '&' : '?'
    return `${u}${sep}w=${size}`
  }

  if (raw.includes('/api/play/cover-img') || raw.startsWith('/api/tag/cover')) {
    return withStreamAuth(withSize(raw))
  }
  if (/^https?:\/\//i.test(raw)) {
    return withStreamAuth(withSize(`/api/play/cover-img?url=${encodeURIComponent(raw)}`))
  }
  return raw
}
