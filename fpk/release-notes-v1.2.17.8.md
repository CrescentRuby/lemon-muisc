# 柠檬音乐 v1.2.17.8

## 更新内容

- **播客**：订阅 RSS/Atom，节目加入播放队列；入口在音乐库右上角
- **DLNA**：播放栏可将本地库或播客投到局域网电视 / 音箱
- **音乐库**：打开库不再每次全盘扫描，本地缓存配合服务端更新信号
- **Docker**：默认拉 `ghcr.io/jia070310/lemon-muisc:latest`，`docker compose up -d` 或 `docker pull` + `docker run` 即可，不必 clone / `--build`
- **路径**：Docker 已挂载 `/music` 时不再误报未配置路径

## 安装 / 更新

- x86：`lemon-music-1.2.17.8-x86.fpk`
- ARM：`lemon-music-1.2.17.8-arm.fpk`
