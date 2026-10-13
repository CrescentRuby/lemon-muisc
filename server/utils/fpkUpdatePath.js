/**
 * FPK 安装包落盘路径：固定在系统配置目录 CONFIG_PATH/fpk-updates。
 * 飞牛一般是 /volX/@appdata/lemon-music/config/fpk-updates。
 *
 * 预留供：关于页「加速保存」、以及后续后台自动更新复用同一目录。
 * 勿写入用户音乐/下载目录。
 */
import fs from 'fs'
import path from 'path'

export const FPK_UPDATE_SUBDIR = 'fpk-updates'

export function getConfigRoot() {
  return process.env.CONFIG_PATH || path.join(process.cwd(), 'config')
}

/** 仅解析路径，不创建目录 */
export function peekFpkUpdateDir() {
  return path.join(getConfigRoot(), FPK_UPDATE_SUBDIR)
}

/** 确保目录存在后返回（真正下载/落盘时再调用） */
export function getFpkUpdateDir() {
  const dir = peekFpkUpdateDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
