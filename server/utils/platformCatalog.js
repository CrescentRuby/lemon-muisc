/** 内置搜索/发现 SDK 覆盖的平台（顺序与设置页一致） */
export const CORE_PLATFORM_ORDER = ['tx', 'wy', 'kw', 'kg', 'mg']

/** 展示名；脚本可另给 name，未知 key 回退为 key 本身 */
export const PLATFORM_LABELS = {
  kw: '酷我',
  kg: '酷狗',
  tx: 'QQ音乐',
  wy: '网易云',
  mg: '咪咕',
  qs: '汽水',
  bili: 'B站',
  ytb: 'YouTube',
  xm: '喜马拉雅',
}

const PLATFORM_KEY_RE = /^[a-z][a-z0-9_-]{0,15}$/i

export function isValidPlatformKey(key) {
  const k = String(key || '').trim()
  if (!k || k === 'local' || k === 'podcast') return false
  return PLATFORM_KEY_RE.test(k)
}

export function platformDisplayName(key, info = {}) {
  const custom = String(info?.name || '').trim()
  if (custom && custom !== key) return custom
  return PLATFORM_LABELS[key] || String(key || '')
}

/** 内置五家保持固定顺序，其余按脚本出现顺序（去重） */
export function orderPlatformKeys(keys, hintOrder = []) {
  const seen = new Set()
  const out = []
  const push = (raw) => {
    const k = String(raw || '').trim()
    if (!isValidPlatformKey(k) || seen.has(k)) return
    seen.add(k)
    out.push(k)
  }
  for (const k of CORE_PLATFORM_ORDER) {
    if ((keys || []).includes(k)) push(k)
  }
  for (const k of hintOrder) push(k)
  for (const k of keys || []) push(k)
  return out
}
