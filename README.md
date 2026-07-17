# PET Speaking Coach 1.0

这是一个 iPad 友好的儿童 PET 英语口语陪练。孩子端以语音对话为主，屏幕同步显示简短字幕；练习结束后生成一句鼓励、一个纠错、几个新词和家长中文报告。

项目背景、目标、当前进展和交接说明见：

```text
PROJECT_CONTEXT.md
```

## 本地运行

1. 复制环境变量文件：

```bash
cp .env.example .env
```

2. 打开 `.env`，填入你的 OpenAI API Key：

```bash
OPENAI_API_KEY=sk-...
APP_ACCESS_CODE=自己设置一个家庭访问码
```

3. 启动：

```bash
npm start
```

4. 在电脑浏览器打开：

```text
http://localhost:3000
```

## 推荐使用方式：云端 PWA

正式给孩子用时，推荐部署到云端 HTTPS 地址。这样 Mac 只负责开发和发布，iPad 可以独立使用，Mac 关机也不影响。

整体结构是：

```text
iPad Safari / 主屏幕图标
  ↓
云端 Node 服务
  ↓
OpenAI Realtime / GPT 报告
```

不要把 OpenAI API Key 放在 iPad 里。API Key 应该只放在云端服务的环境变量中。

同时要设置 `APP_ACCESS_CODE`。否则别人如果知道你的网址，也可能调用你的服务并消耗你的 OpenAI 额度。

## 如果不想上云

如果目标是“iPad 完全本地运行，Mac 不开机，也不上 Render/Railway”，需要换成另一个方案：**做原生 iPad App**。

原因是这个 1.0 项目现在是网页 PWA：

```text
iPad 网页
  ↓
后端服务
  ↓
OpenAI
```

后端服务有两个重要作用：

1. 保存 `OPENAI_API_KEY`，不让它暴露在 iPad 网页里。
2. 创建 OpenAI Realtime 语音会话。

如果没有云端，也没有 Mac 后端，纯网页就只能把 OpenAI API Key 放进 iPad 前端代码或浏览器存储里，这不安全，也不适合作为长期方案。

可选路线：

### 路线 A：原生 iPad App

用 Swift / SwiftUI 开发 iPad App，App 直接调用 OpenAI API。API Key 可以由家长在设置页输入，并保存在 iPad Keychain 中。

优点：

- iPad 可以独立使用
- 不依赖 Render / Railway
- 使用体验最像真正 App

缺点：

- 需要重新做一版原生 App
- 需要 Xcode
- 如果要长期安装，通常需要 Apple Developer 账号或 TestFlight
- API Key 仍然在 iPad 上，只是比网页前端更安全一些

### 路线 B：iPad 本地运行后端

理论上可以用 a-Shell、Pythonista、Working Copy 等工具在 iPad 上跑一个小服务，但不适合孩子日常使用。

缺点很明显：

- 每次使用前要先启动本地服务
- 后台运行不稳定
- 调试麻烦
- 不像一个给孩子用的产品

### 路线 C：继续使用云端 PWA

这是当前 1.0 最推荐路线。它不是把孩子的数据交给复杂平台，而只是让一个很小的 Node 服务在云端代替 Mac 运行。

如果你坚持“不上云”，建议下一步不要继续扩展当前 PWA，而是新建一个 SwiftUI iPad App 版本。

## 在 iPad 上安装

这里的“安装”指的是把网页应用添加到 iPad 主屏幕。完成后，它看起来和普通 App 很像，孩子直接点图标就能用。

前提：你已经把应用部署到 Render / Railway，并拿到了一个 `https://...` 地址。

1. 在 iPad 上打开 Safari。
2. 输入你的应用地址，例如：

```text
https://pet-speaking-coach.onrender.com
```

3. 第一次打开时，输入你设置的家庭访问码并保存。
4. 页面打开后，点 `Start Speaking`。
5. Safari 询问麦克风权限时，选择“允许”。
6. 确认可以听到 AI 说话，也可以正常录到孩子的声音。
7. 点 Safari 顶部或底部的分享按钮。
8. 选择“添加到主屏幕”。
9. 名称可以填：

```text
PET Coach
```

10. 点“添加”。

以后孩子使用时，只需要点 iPad 主屏幕上的 `PET Coach` 图标。Mac 不需要开机，因为应用运行在云端。

如果以后你更新了代码并重新部署，iPad 上的图标不用重新安装，直接打开就是新版。若页面没有刷新到新版，可以在 Safari 里重新打开一次网址。

## 从 Mac 开发到 iPad 使用

### 1. Mac 本地开发测试

在 Mac 上先跑通界面和基本流程：

```bash
cp .env.example .env
```

把 `.env` 里的 `OPENAI_API_KEY` 改成你的 key，然后启动：

```bash
npm start
```

Mac 浏览器打开：

```text
http://localhost:3000
```

### 2. 发布到 Render

1. 把这个文件夹放到 GitHub 仓库。
2. 打开 Render，选择 `New` → `Blueprint`。
3. 连接这个 GitHub 仓库。
4. Render 会读取 `render.yaml`。
5. 在环境变量里填入：

```text
OPENAI_API_KEY=sk-...
APP_ACCESS_CODE=自己设置一个家庭访问码
```

6. 部署完成后，Render 会给你一个固定 HTTPS 地址，例如：

```text
https://pet-speaking-coach.onrender.com
```

### 3. iPad 安装到主屏幕

1. 用 iPad Safari 打开 Render 的 HTTPS 地址。
2. 第一次打开时，输入家庭访问码并保存。
3. 点 `Start Speaking`，允许麦克风。
4. 点 Safari 分享按钮。
5. 选择“添加到主屏幕”。
6. 以后孩子直接点 iPad 主屏幕上的 PET Coach 图标。

这样 iPad 就能独立使用，不需要 Mac 一直开着。

## 临时测试方式：Mac + ngrok

如果还没准备部署到 Render，可以临时用 ngrok 测试 iPad 语音。

1. 在 Mac 上启动应用：

```bash
npm start
```

2. 另开一个终端，启动 ngrok：

```bash
ngrok http 3000
```

3. ngrok 会给你一个类似这样的 HTTPS 地址：

```text
https://xxxx.ngrok-free.app
```

4. 在 iPad Safari 打开这个 HTTPS 地址。

5. 第一次点 `Start Speaking` 时，允许麦克风权限。

6. 点 Safari 分享按钮，选择“添加到主屏幕”。

以后使用时：

1. Mac 先运行 `npm start`
2. ngrok 也保持运行
3. iPad 点主屏幕上的 PET Coach 图标

免费 ngrok 的地址可能会变化。如果地址变了，需要重新在 iPad Safari 打开新地址并添加到主屏幕。想固定地址，可以用 ngrok 的付费固定域名，或者部署到 Render/Railway。

## 同一 Wi-Fi 直接访问，只适合看界面

如果只是看界面，不测试语音，可以让 iPad 直接访问 Mac：

```bash
npm run lan
```

然后在 Mac 上查看本机局域网 IP：

```bash
ipconfig getifaddr en0
```

iPad Safari 打开：

```text
http://你的Mac局域网IP:3000
```

注意：这种 `http://` 局域网方式在 iPad 上大概率不能正常使用麦克风，所以不适合作为最终语音练习方式。

## 家长端

右上角按钮进入家长页。默认 PIN 是：

```text
2580
```

1.0 先做成家庭自用版本，没有复杂账号系统。

## 备选：部署到 Railway

Railway 也可以：

1. 新建 Project，选择 GitHub 仓库。
2. 添加环境变量：
   - `OPENAI_API_KEY`
   - `REALTIME_MODEL=gpt-realtime-2.1`
   - `REPORT_MODEL=gpt-5.5`
3. Railway 会自动识别 Node 项目。
4. 生成公开域名后，用 iPad Safari 打开并添加到主屏幕。

## 费用提醒

实时语音会消耗 OpenAI Realtime API 费用。建议一开始每天控制在 5-10 分钟，并在 OpenAI 控制台设置预算提醒。
