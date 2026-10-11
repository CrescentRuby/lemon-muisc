# 飞牛应用中心 · 应用介绍（精简版）

> 用于 `fpk/manifest` 的 `desc`，以及上架表单「应用介绍」。
> 已去掉重置密码（登录页有说明）。图片需已 push 到 `main`。

## 图片链接（国内）

`desc` 中 `<img>` 当前使用 **ghfast 加速 GitHub raw**（与本项目下载加速一致）：

`https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/<文件名>`

备用 CDN（jsDelivr）：

`https://cdn.jsdelivr.net/gh/jia070310/lemon-muisc@main/docs/screenshots/<文件名>`

| 顺序 | 文件 | ghfast（已写入 manifest） | jsDelivr 备用 |
|------|------|---------------------------|---------------|
| 1 | `intro-daily-mix-v1.2.17.png` | `https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-daily-mix-v1.2.17.png` | `https://cdn.jsdelivr.net/gh/jia070310/lemon-muisc@main/docs/screenshots/intro-daily-mix-v1.2.17.png` |
| 2 | `intro-search-v1.2.17.png` | `https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-search-v1.2.17.png` | `https://cdn.jsdelivr.net/gh/jia070310/lemon-muisc@main/docs/screenshots/intro-search-v1.2.17.png` |
| 3 | `intro-file-manager-v1.2.17.png` | `https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-file-manager-v1.2.17.png` | `https://cdn.jsdelivr.net/gh/jia070310/lemon-muisc@main/docs/screenshots/intro-file-manager-v1.2.17.png` |
| 4 | `intro-player-lyrics-v1.2.17.png` | `https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-player-lyrics-v1.2.17.png` | `https://cdn.jsdelivr.net/gh/jia070310/lemon-muisc@main/docs/screenshots/intro-player-lyrics-v1.2.17.png` |
| 5 | `intro-appearance-v1.2.17.png` | `https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-appearance-v1.2.17.png` | `https://cdn.jsdelivr.net/gh/jia070310/lemon-muisc@main/docs/screenshots/intro-appearance-v1.2.17.png` |

## 纯文字

多平台搜歌、本地音乐库、标签整理与高品质下载。兼容落雪自定义音源，浏览器内完成找歌 → 试听 → 下载 → 整理。

**亮点**
- 搜索：酷我 / 酷狗 / QQ / 网易云 / 咪咕；FLAC · Hi-Res · 母带可选，支持批量下载
- 音乐库：每日推荐（本地+平台混搭）、推荐歌单、漫游播放
- 文件管理：标签编辑、去重、伪 FLAC 检测、按歌手整理
- 播放：全屏逐字歌词、频谱与风格配色

**依赖**：应用中心 Node.js v22。目录可在安装向导或「访问权限」中指定；卸载可选保留配置。

**免责声明**：仅供个人合法使用。请确保对所管理音乐拥有相应权利，并遵守当地法律与平台条款。

## HTML（已写入 manifest desc）

```html
<b>多平台搜歌、本地音乐库、标签整理与高品质下载</b>。兼容落雪自定义音源，浏览器内完成找歌 → 试听 → 下载 → 整理。<br><br><b>亮点</b><br>· 搜索：酷我 / 酷狗 / QQ / 网易云 / 咪咕；FLAC · Hi-Res · 母带可选，支持批量下载<br>· 音乐库：每日推荐（本地+平台混搭）、推荐歌单、漫游播放<br>· 文件管理：标签编辑、去重、伪 FLAC 检测、按歌手整理<br>· 播放：全屏逐字歌词、频谱与风格配色<br><img src="https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-daily-mix-v1.2.17.png" alt="每日推荐：本地与平台混搭" style="max-width:100%;height:auto;border-radius:8px;margin:6px 0" loading="lazy"><br><img src="https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-search-v1.2.17.png" alt="多平台搜索与音质选择" style="max-width:100%;height:auto;border-radius:8px;margin:6px 0" loading="lazy"><br><img src="https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-file-manager-v1.2.17.png" alt="文件管理：标签编辑与整理" style="max-width:100%;height:auto;border-radius:8px;margin:6px 0" loading="lazy"><br><img src="https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-player-lyrics-v1.2.17.png" alt="全屏播放与逐字歌词" style="max-width:100%;height:auto;border-radius:8px;margin:6px 0" loading="lazy"><br><img src="https://ghfast.top/https://raw.githubusercontent.com/jia070310/lemon-muisc/main/docs/screenshots/intro-appearance-v1.2.17.png" alt="风格样式：明暗与配色" style="max-width:100%;height:auto;border-radius:8px;margin:6px 0" loading="lazy"><br><br><b>依赖</b>：应用中心 <b>Node.js v22</b>。目录可在安装向导或「访问权限」中指定；卸载可选保留配置，不会删除音乐库 / 下载目录中的音频。<br><br><b>免责声明</b>：仅供个人合法使用。请确保对所管理音乐拥有相应权利，并遵守当地法律与平台条款。违规后果由用户自行承担。
```
