# 柠檬音乐 v1.2.17.7

## 更新内容

- **系统目录**：封面缓存、发现页缓存改存 `CONFIG_PATH`（飞牛 `@appdata/…/config`），不再写入用户下载目录
- **安装包**：FPK「加速保存」改存 `CONFIG_PATH/fpk-updates`，预留后台更新复用；打开关于页不再生成「柠檬音乐更新」文件夹
- **关于页**：交流反馈 / 安装到桌面 / 排查与日志宽屏三栏并排
- **Docker**：多架构构建避免 QEMU 下 npm 崩溃

## 安装 / 更新

- x86：`lemon-music-1.2.17.7-x86.fpk`
- ARM：`lemon-music-1.2.17.7-arm.fpk`
