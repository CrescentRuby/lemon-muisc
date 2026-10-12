export async function fetchPicBuffer(picUrl, { size = 0 } = {}) {
  if (!picUrl || !/^https?:\/\//i.test(picUrl)) return null

  const prefer = Number(size) > 0 ? Math.min(500, Math.max(120, Number(size))) : 0
  const candidates = expandPicCandidates(picUrl, prefer)

  const { default: needle } = await import('needle')
  for (let url of candidates) {
    if (url.includes('music.126.net') && !/[?&]param=\d+y\d+/i.test(url)) {
      const dim = prefer || 500
      url += `${url.includes('?') ? '&' : '?'}param=${dim}y${dim}`
    }
    try {
      const resp = await needle('get', url, {
        headers: {
          Referer: pickReferer(url),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        follow_max: 5,
        parse_response: false,
        timeout: 15000,
      })
      if (resp.statusCode === 200 && resp.body?.length) {
        return Buffer.isBuffer(resp.body) ? resp.body : Buffer.from(resp.body)
      }
    } catch {
      // try next candidate
    }
  }
  return null
}

function pickReferer(url) {
  if (/kuwo\.cn/i.test(url)) return 'https://www.kuwo.cn/'
  if (/kugou\.com|kgimg\.com/i.test(url)) return 'https://www.kugou.com/'
  if (/music\.126\.net|netease/i.test(url)) return 'https://music.163.com/'
  if (/migu\.cn/i.test(url)) return 'https://music.migu.cn/'
  return 'https://y.qq.com/'
}

function expandPicCandidates(picUrl, preferSize = 0) {
  const list = [picUrl]
  const size = preferSize || 400

  if (/T002R300x300M000/.test(picUrl)) {
    // 列表用较小图；大图需求再升到 500
    if (preferSize && preferSize <= 300) {
      /* keep 300 */
    } else {
      list.push(picUrl.replace('T002R300x300M000', 'T002R500x500M000'))
    }
  }

  // 酷我：120 常空；列表优先 240/300，否则 500
  if (/kuwo\.cn\/star\/(albumcover|starheads)\//i.test(picUrl)) {
    const target = preferSize && preferSize <= 300 ? '/240/' : '/500/'
    const up = picUrl.replace(/\/120\//, target).replace(/\/240\//, preferSize && preferSize <= 300 ? '/240/' : '/500/')
    if (up !== picUrl) list.push(up)
    for (const host of ['img4.kuwo.cn', 'img2.kuwo.cn', 'img1.kuwo.cn', 'img3.kuwo.cn']) {
      const swapped = up.replace(/https?:\/\/img\d\.kuwo\.cn/i, `https://${host}`)
      if (!list.includes(swapped)) list.push(swapped)
    }
  }

  if (/\{size\}/.test(picUrl)) {
    list.push(picUrl.replace(/\{size\}/g, String(size)))
    if (!preferSize || preferSize > 300) list.push(picUrl.replace(/\{size\}/g, '480'))
  }

  return [...new Set(list)]
}

export function detectImageMime(buffer) {
  if (!buffer?.length) return 'image/jpeg'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  if (buffer.slice(0, 4).toString() === 'RIFF') return 'image/webp'
  return 'image/jpeg'
}
