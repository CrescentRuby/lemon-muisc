/**
 * DSF / DFF（DSD）标签写入：容器内嵌 ID3v2，不重编码音频。
 * DSF：规范 metadataPointer → 文件末尾 ID3
 * DFF：非官方 ID3 chunk（与 music-metadata 读取一致）
 */
import fs from 'fs'
import NodeID3 from 'node-id3'
import { detectImageMime } from './fetchPic.js'
import { normalizeArtistForWrite } from './artistTag.js'

const DSF_PRESERVE_KEYS = [
  'title', 'artist', 'album', 'performerInfo', 'year', 'genre', 'comment',
  'trackNumber', 'partOfSet', 'composer', 'unsynchronisedLyrics', 'image',
]

export function canWriteDsdExt(ext) {
  const e = String(ext || '').toLowerCase()
  return e === '.dsf' || e === '.dff'
}

/**
 * @param {string} filePath
 * @param {object} meta
 * @param {{ decodePicInput?: Function, atomicReplaceFile?: Function }} [hooks]
 */
export function writeDsfMeta(filePath, meta, hooks = {}) {
  const fd = fs.openSync(filePath, 'r+')
  try {
    const header = Buffer.alloc(28)
    const n = fs.readSync(fd, header, 0, 28, 0)
    if (n < 28 || header.slice(0, 4).toString('ascii') !== 'DSD ') {
      throw new Error('不是有效的 DSF 文件')
    }
    const dsdChunkSize = readU64LE(header, 4)
    if (dsdChunkSize !== 28n) {
      throw new Error(`不支持的 DSF 头大小: ${dsdChunkSize}`)
    }

    const st = fs.fstatSync(fd)
    const fileSizeField = readU64LE(header, 12)
    const metaPtr = readU64LE(header, 20)
    const physicalSize = BigInt(st.size)

    // 音频区终点：已有 ID3 则从其起点截断；否则取头声明大小或物理长度
    let audioEnd = metaPtr > 0n
      ? metaPtr
      : (fileSizeField > 28n && fileSizeField <= physicalSize ? fileSizeField : physicalSize)
    if (audioEnd <= 28n || audioEnd > physicalSize) {
      throw new Error('DSF metadata 指针异常，已取消写入以免损坏文件')
    }

    const prev = readId3FromFd(fd, metaPtr, physicalSize)
    const tags = mergeId3Tags(prev, meta, hooks.decodePicInput)
    const id3 = NodeID3.create(tags)
    if (!Buffer.isBuffer(id3) || id3.length < 10 || id3.slice(0, 3).toString('ascii') !== 'ID3') {
      throw new Error('DSF ID3 生成失败')
    }

    const audioEndNum = bigToSafeNumber(audioEnd, 'DSF 音频区')
    fs.ftruncateSync(fd, audioEndNum)
    fs.writeSync(fd, id3, 0, id3.length, audioEndNum)

    const newSize = BigInt(audioEndNum + id3.length)
    writeU64LE(header, 12, newSize)
    writeU64LE(header, 20, audioEnd)
    fs.writeSync(fd, header, 0, 28, 0)
  } finally {
    try { fs.closeSync(fd) } catch {}
  }
}

/**
 * @param {string} filePath
 * @param {object} meta
 * @param {{ decodePicInput?: Function, atomicReplaceFile?: Function }} [hooks]
 */
export function writeDffMeta(filePath, meta, hooks = {}) {
  const original = fs.readFileSync(filePath)
  if (original.length < 16 || original.slice(0, 4).toString('ascii') !== 'FRM8') {
    throw new Error('不是有效的 DFF（DSDIFF）文件')
  }

  const formSize = readU64BE(original, 4)
  const formType = original.slice(12, 16).toString('ascii').trim()
  if (formType !== 'DSD') {
    throw new Error(`不支持的 DSDIFF 类型: ${formType || '?'}`)
  }

  const localStart = 16
  const localEnd = bigToSafeNumber(12n + formSize, 'DFF 表单') // FRM8 头 12 + formSize
  if (localEnd > original.length) {
    throw new Error('DFF 表单大小异常')
  }

  const kept = []
  let prevId3 = null
  let off = localStart
  while (off + 12 <= localEnd) {
    const id = original.slice(off, off + 4).toString('ascii')
    const size = readU64BE(original, off + 4)
    const sizeNum = bigToSafeNumber(size, `DFF chunk ${id}`)
    const dataStart = off + 12
    const dataEnd = dataStart + sizeNum
    if (dataEnd > localEnd) throw new Error(`DFF chunk ${id} 越界`)
    const pad = sizeNum % 2 === 1 ? 1 : 0
    const next = dataEnd + pad

    if (id.trim() === 'ID3') {
      try {
        prevId3 = NodeID3.read(original.subarray(dataStart, dataEnd)) || null
      } catch {
        prevId3 = null
      }
    } else {
      kept.push(original.subarray(off, next))
    }
    off = next
  }

  const tags = mergeId3Tags(prevId3 || {}, meta, hooks.decodePicInput)
  const id3 = NodeID3.create(tags)
  if (!Buffer.isBuffer(id3) || id3.length < 10) throw new Error('DFF ID3 生成失败')

  const id3Chunk = buildDffId3Chunk(id3)
  const body = Buffer.concat([original.subarray(12, 16), ...kept, id3Chunk])
  const out = Buffer.alloc(12 + body.length)
  out.write('FRM8', 0, 4, 'ascii')
  writeU64BE(out, 4, BigInt(body.length))
  body.copy(out, 12)

  if (hooks.atomicReplaceFile) hooks.atomicReplaceFile(filePath, out)
  else {
    const tmp = `${filePath}.lemon-dff-tmp`
    fs.writeFileSync(tmp, out)
    fs.renameSync(tmp, filePath)
  }
}

function buildDffId3Chunk(id3Buf) {
  const size = id3Buf.length
  const pad = size % 2 === 1 ? 1 : 0
  const chunk = Buffer.alloc(12 + size + pad)
  chunk.write('ID3 ', 0, 4, 'ascii')
  writeU64BE(chunk, 4, BigInt(size))
  id3Buf.copy(chunk, 12)
  return chunk
}

function mergeId3Tags(prev, meta, decodePicInput) {
  const tags = pickPreserved(prev)
  if (meta.title != null) tags.title = meta.title
  if (meta.artist != null) tags.artist = normalizeArtistForWrite(meta.artist).display
  if (meta.albumArtist != null) tags.performerInfo = normalizeArtistForWrite(meta.albumArtist).display
  if (meta.album != null) tags.album = meta.album
  if (meta.year != null) tags.year = String(meta.year)
  if (meta.genre != null) tags.genre = meta.genre
  if (meta.comment != null) tags.comment = { language: 'chi', text: String(meta.comment) }

  const picBuf = decodePicInput ? decodePicInput(meta.pic) : null
  if (picBuf) {
    tags.image = {
      mime: detectImageMime(picBuf),
      type: { id: 3, name: 'front cover' },
      description: 'Cover',
      imageBuffer: picBuf,
    }
  } else if (meta.clearPicture === true || meta.pic === '') {
    delete tags.image
  }

  if (meta.lyric != null) {
    tags.unsynchronisedLyrics = { language: 'chi', text: String(meta.lyric) }
  }
  return tags
}

function pickPreserved(prev = {}) {
  const out = {}
  if (!prev || typeof prev !== 'object') return out
  for (const key of DSF_PRESERVE_KEYS) {
    if (prev[key] == null || prev[key] === '') continue
    out[key] = prev[key]
  }
  if (out.comment != null) {
    const text = typeof out.comment === 'string' ? out.comment : (out.comment?.text || '')
    out.comment = { language: 'chi', text: String(text || '') }
  }
  if (out.unsynchronisedLyrics != null && typeof out.unsynchronisedLyrics === 'string') {
    out.unsynchronisedLyrics = { language: 'chi', text: out.unsynchronisedLyrics }
  }
  return out
}

function readId3FromFd(fd, metaPtr, physicalSize) {
  if (!(metaPtr > 0n) || metaPtr + 10n > physicalSize) return {}
  try {
    const start = bigToSafeNumber(metaPtr, 'ID3 offset')
    const len = bigToSafeNumber(physicalSize - metaPtr, 'ID3 length')
    const buf = Buffer.alloc(len)
    fs.readSync(fd, buf, 0, len, start)
    if (buf.slice(0, 3).toString('ascii') !== 'ID3') return {}
    return NodeID3.read(buf) || {}
  } catch {
    return {}
  }
}

function readU64LE(buf, off) {
  return buf.readBigUInt64LE(off)
}

function writeU64LE(buf, off, value) {
  buf.writeBigUInt64LE(BigInt(value), off)
}

function readU64BE(buf, off) {
  return buf.readBigUInt64BE(off)
}

function writeU64BE(buf, off, value) {
  buf.writeBigUInt64BE(BigInt(value), off)
}

function bigToSafeNumber(v, label) {
  const n = typeof v === 'bigint' ? v : BigInt(v)
  if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label}超出可处理范围`)
  }
  return Number(n)
}
