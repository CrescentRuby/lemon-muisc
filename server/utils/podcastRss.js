import needle from 'needle'

const FETCH_TIMEOUT_MS = 25000
const MAX_BYTES = 8 * 1024 * 1024
const MAX_EPISODES = 400

function stripCdata(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function innerTag(xml, names) {
  const list = Array.isArray(names) ? names : [names]
  for (const name of list) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')
    const m = xml.match(re)
    if (m) return stripCdata(m[1])
  }
  return ''
}

function attrOnTag(xml, tagName, attrName) {
  const re = new RegExp(`<${tagName}\\b[^>]*\\s${attrName}=["']([^"']+)["'][^>]*>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

function parseDuration(raw) {
  const s = String(raw || '').trim()
  if (!s) return 0
  if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Math.round(Number(s)))
  const parts = s.split(':').map((n) => Number(n))
  if (parts.some((n) => !Number.isFinite(n))) return 0
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2])
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1])
  return 0
}

function enclosureUrl(block) {
  const enc = block.match(/<enclosure\b[^>]*>/i)
  if (enc) {
    const url = /(?:url|href)=["']([^"']+)["']/i.exec(enc[0])
    if (url?.[1]) return url[1].trim()
  }
  const links = [...block.matchAll(/<link\b([^>]*)>/gi)]
  for (const m of links) {
    const attrs = m[1] || ''
    const rel = /rel=["']([^"']+)["']/i.exec(attrs)?.[1] || ''
    const type = /type=["']([^"']+)["']/i.exec(attrs)?.[1] || ''
    const href = /href=["']([^"']+)["']/i.exec(attrs)?.[1] || ''
    if (href && (/enclosure/i.test(rel) || /^audio\//i.test(type))) return href.trim()
  }
  const media = attrOnTag(block, 'media:content', 'url')
  return media || ''
}

function parseItems(xml) {
  const blocks = []
  const itemRe = /<item\b[\s\S]*?<\/item>/gi
  const entryRe = /<entry\b[\s\S]*?<\/entry>/gi
  let m
  while ((m = itemRe.exec(xml))) blocks.push(m[0])
  if (!blocks.length) {
    while ((m = entryRe.exec(xml))) blocks.push(m[0])
  }
  const out = []
  for (const block of blocks.slice(0, MAX_EPISODES)) {
    const audioUrl = enclosureUrl(block)
    if (!audioUrl) continue
    const title = innerTag(block, ['title']) || '未命名节目'
    const guid = innerTag(block, ['guid', 'id']) || audioUrl
    const pub = innerTag(block, ['pubDate', 'published', 'updated', 'dc:date'])
    const pubMs = pub ? Date.parse(pub) : NaN
    out.push({
      guid: String(guid).slice(0, 512),
      title: title.slice(0, 500),
      description: innerTag(block, ['description', 'summary', 'content:encoded', 'content']).slice(0, 4000),
      audioUrl,
      duration: parseDuration(innerTag(block, ['itunes:duration', 'duration'])),
      pubDate: Number.isFinite(pubMs) ? pubMs : 0,
      imageUrl: attrOnTag(block, 'itunes:image', 'href')
        || innerTag(block, ['itunes:image'])
        || attrOnTag(block, 'media:thumbnail', 'url')
        || '',
    })
  }
  return out
}

function parseChannel(xml) {
  const channel = (xml.match(/<channel\b[\s\S]*?<\/channel>/i) || xml.match(/<feed\b[\s\S]*?<\/feed>/i) || [xml])[0]
  const image = attrOnTag(channel, 'itunes:image', 'href')
    || innerTag(channel.match(/<image\b[\s\S]*?<\/image>/i)?.[0] || '', ['url'])
    || attrOnTag(channel, 'media:thumbnail', 'url')
    || ''
  const link = innerTag(channel, ['link']) || attrOnTag(channel, 'link', 'href')
  return {
    title: innerTag(channel, ['title']) || '未命名播客',
    author: innerTag(channel, ['itunes:author', 'author', 'managingEditor']) || '',
    description: innerTag(channel, ['description', 'itunes:summary', 'subtitle']).slice(0, 4000),
    imageUrl: image,
    siteUrl: link,
  }
}

const WEB_PAGE_HINT = '这是网页地址，不是播客 RSS。请粘贴订阅源 XML（一般以 rss / feed / xml 结尾），不要贴专辑或节目的网页链接。'

function isLikelyWebPageUrl(url) {
  const u = String(url || '')
  if (/\.(xml|rss|atom)(\?|$)/i.test(u)) return false
  if (/\/(rss|feed|atom)(\/|$|\?)/i.test(u)) return false
  if (/ximalaya\.com\/album\//i.test(u)) return true
  if (/qingting\.fm\/(channels|vchannels)\//i.test(u)) return true
  if (/music\.163\.com\/(dj|radio|program)/i.test(u)) return true
  return false
}

function looksLikeHtml(text, contentType) {
  const ct = String(contentType || '').toLowerCase()
  if (/rss|atom|\bxml\b/.test(ct)) return false
  if (ct.includes('text/html')) return true
  const head = String(text || '').slice(0, 1200).toLowerCase()
  return /<!doctype html|<html[\s>]/.test(head)
}

export async function fetchPodcastFeed(feedUrl) {
  const url = String(feedUrl || '').trim()
  if (!/^https?:\/\//i.test(url)) throw new Error('请填写 http(s) 播客 RSS 地址')
  if (isLikelyWebPageUrl(url)) throw new Error(WEB_PAGE_HINT)
  const res = await needle('get', url, {
    parse_response: false,
    follow_max: 5,
    timeout: FETCH_TIMEOUT_MS,
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      'User-Agent': 'LemonMusic/1.2 (podcast)',
    },
  })
  const status = res.statusCode || 0
  if (status >= 400) throw new Error(`订阅源返回 ${status}`)
  const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(String(res.body || ''), 'utf8')
  const contentType = res.headers?.['content-type'] || ''
  if (buf.length > MAX_BYTES) {
    throw new Error(looksLikeHtml(buf.toString('utf8').slice(0, 1200), contentType)
      ? WEB_PAGE_HINT
      : '订阅源超过 8MB，当前只支持标准播客 RSS，不支持整站网页')
  }
  let xml = buf.toString('utf8').replace(/^\uFEFF/, '')
  if (looksLikeHtml(xml, contentType)) throw new Error(WEB_PAGE_HINT)
  if (!xml.includes('<')) throw new Error('不是有效的 RSS/Atom')
  const meta = parseChannel(xml)
  const episodes = parseItems(xml)
  if (!meta.title && !episodes.length) throw new Error('未能解析到节目，请确认是播客 RSS')
  return { meta, episodes, xmlBytes: buf.length }
}
