import { api } from '../api.js'
import { appConfirm } from '../stores/appDialog.js'
import { removeLibraryTracks } from '../stores/library.js'
import { getTrackFilePath } from './trackPath.js'

/**
 * 物理删除音乐库文件，并清掉客户端曲库/收藏/队列里的幽灵项。
 * @returns {{ deleted: string[], filePath: string }}
 */
export async function deleteLibraryDiskFile(filePath) {
  const path = String(filePath || '').trim()
  if (!path) throw new Error('未找到该歌曲的本地文件')
  const res = await api.library.deleteFiles([path])
  const failed = res?.data?.failed || []
  if (failed.length) throw new Error(failed[0]?.error || '删除失败')
  const deleted = Array.isArray(res?.data?.deleted) && res.data.deleted.length
    ? res.data.deleted
    : [path]
  removeLibraryTracks(deleted)
  return { deleted, filePath: path }
}

/**
 * 二次确认后删除曲目对应本地文件。
 * @returns {Promise<{ cancelled: true, noPath?: boolean } | { cancelled: false, deleted: string[], filePath: string }>}
 */
export async function confirmDeleteLibraryTrack(song, opts = {}) {
  const filePath = getTrackFilePath(song)
  if (!filePath) return { cancelled: true, noPath: true }
  const name = song?.name || song?.fileName || filePath
  const ok = await appConfirm({
    title: opts.title || '删除歌曲',
    message: opts.message || `确定从磁盘永久删除「${name}」？`,
    hint: opts.hint || '文件将被物理删除，此操作不可恢复。',
    confirmText: '删除',
    danger: true,
    cover: opts.cover !== undefined ? opts.cover : (song?.picUrl || song?.img || ''),
  })
  if (!ok) return { cancelled: true }
  const result = await deleteLibraryDiskFile(filePath)
  return { cancelled: false, ...result }
}
