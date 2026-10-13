import path from 'path'
import { splitArtists } from './artistTag.js'
import { isPlaceholderName } from './filenameParse.js'

export function sanitizePathSegment(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim()
}

const VARIOUS_ARTISTS_DIR = '群星 (Various Artists)'

function parseTaskMeta(task = {}) {
  let meta = task.meta
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta || '{}') } catch { meta = {} }
  }
  return meta && typeof meta === 'object' ? meta : {}
}

/** 真实可用的目录名：去掉空串与「未知专辑」等占位 */
function usablePathSegment(raw) {
  const text = String(raw || '').trim()
  if (!text || isPlaceholderName(text)) return ''
  return sanitizePathSegment(text)
}

export function resolveDownloadGroupMode(settings = {}) {
  const mode = String(settings['download.savePathGroupBy'] || '').trim()
  if (mode === 'artist' || mode === 'album' || mode === 'artist-album') return mode
  if (settings['download.isSavePathGroupByListName'] === 'true') return 'album'
  return 'none'
}

function resolveGroupMode(settings = {}) {
  return resolveDownloadGroupMode(settings)
}

/** 多歌手归档到群星；单歌手取唯一署名（占位歌手视为无） */
function pickArtistSegment(task = {}) {
  const artists = splitArtists(task.singer || task.albumArtist || '')
  if (artists.length >= 2) return VARIOUS_ARTISTS_DIR
  const one = String(artists[0] || '').trim()
  if (!one || isPlaceholderName(one)) return ''
  return one
}

/** 专辑分组名：任务列优先，其次 meta；未知/空不建文件夹 */
function pickAlbumSegment(task = {}) {
  const meta = parseTaskMeta(task)
  return usablePathSegment(task.album || meta.album || '')
}

function pickGroupSegment(mode, task = {}) {
  if (mode === 'album') return pickAlbumSegment(task)
  if (mode === 'artist') return pickArtistSegment(task)
  return ''
}

function namesEqual(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'accent' }) === 0
}

/**
 * 把分组段接到 savePath 上；若末尾已是这些段（含同名套娃），先剥掉再只拼一层。
 * 例：download/专辑/专辑 + [专辑] → download/专辑
 *     download/周杰伦 + [周杰伦, 七里香] → download/周杰伦/七里香
 */
export function joinDownloadGroupSegments(savePath, segments = []) {
  const segs = (Array.isArray(segments) ? segments : [])
    .map((s) => sanitizePathSegment(s))
    .filter(Boolean)
  if (!segs.length) return savePath

  let root = path.resolve(savePath || '.')

  // 收集末尾路径组件（不含盘符根）
  const tail = []
  let cur = root
  for (let i = 0; i < 64; i++) {
    const parent = path.dirname(cur)
    const base = path.basename(cur)
    if (!base || parent === cur) break
    tail.unshift(base)
    cur = parent
  }

  // 末尾已匹配「分组路径前缀」的最长长度
  let matchedPrefix = 0
  const max = Math.min(tail.length, segs.length)
  for (let n = max; n >= 1; n--) {
    let ok = true
    for (let i = 0; i < n; i++) {
      if (!namesEqual(tail[tail.length - n + i], segs[i])) {
        ok = false
        break
      }
    }
    if (ok) {
      matchedPrefix = n
      break
    }
  }

  for (let i = 0; i < matchedPrefix; i++) {
    const parent = path.dirname(root)
    if (parent === root) break
    root = parent
  }

  // 单段或首段同名套娃：继续剥到不再是 segs[0]
  while (namesEqual(path.basename(root), segs[0])) {
    const parent = path.dirname(root)
    if (parent === root) break
    root = parent
  }

  return path.join(root, ...segs)
}

/** 从任务或 meta 取出歌单文件夹名（循序/批量下载可选） */
function pickListName(task = {}) {
  if (task.listName) return task.listName
  const meta = parseTaskMeta(task)
  if (meta.listName) return meta.listName
  return ''
}

/** 根据设置解析下载保存目录（可在根目录下按歌手/专辑分子文件夹；可选歌单文件夹前缀） */
export function resolveDownloadGroupDir(savePath, settings, task) {
  const listName = usablePathSegment(pickListName(task))
  let base = savePath
  if (listName) {
    base = joinDownloadGroupSegments(savePath, [listName])
  }

  const mode = resolveGroupMode(settings)

  if (mode === 'artist-album') {
    const artist = usablePathSegment(pickArtistSegment(task))
    const album = pickAlbumSegment(task)
    // 有专辑无歌手：仍按专辑落一层，避免再落到「未知专辑」
    if (artist && album) return joinDownloadGroupSegments(base, [artist, album])
    if (artist) return joinDownloadGroupSegments(base, [artist])
    if (album) return joinDownloadGroupSegments(base, [album])
    return base
  }

  const segment = usablePathSegment(pickGroupSegment(mode, task))
  if (!segment) return base
  return joinDownloadGroupSegments(base, [segment])
}
