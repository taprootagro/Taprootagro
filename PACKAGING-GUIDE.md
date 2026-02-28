# 📦 项目打包指南

## 🎯 上传到阿里云ESA Pages必需文件

### ✅ 必须包含的文件和目录

```
项目根目录/
├── pages.json                 ⭐ 必需：ESA Pages配置文件
├── package.json               ⭐ 必需：依赖声明
├── vite.config.ts            ⭐ 必需：Vite构建配置
├── postcss.config.mjs        ⭐ 必需：Tailwind CSS配置
├── tsconfig.json             （如果存在）
├── src/                      ⭐ 必需：源代码目录
│   ├── app/
│   │   ├── App.tsx          ⭐ 入口组件
│   │   ├── routes.tsx
│   │   ├── components/      ⭐ 所有组件
│   │   ├── hooks/           ⭐ useLanguage等hooks
│   │   ├── contexts/
│   │   └── utils/
│   └── styles/              ⭐ 样式文件
│       ├── index.css
│       ├── tailwind.css
│       ├── theme.css
│       └── fonts.css
├── public/                   ⭐ 必需：静态资源
│   ├── service-worker.js    ⭐ PWA核心文件
│   ├── manifest.json        ⭐ PWA配置
│   ├── icon-192.png         ⭐ PWA图标
│   ├── icon-512.png         ⭐ PWA图标
│   ├── clear-cache.html
│   ├── models/              （如果使用AI功能）
│   └── taprootagro/         （远程版本检查端点）
│       └── global/
│           └── main.tsx
└── index.html               ⭐ HTML入口
```

---

## ❌ 不需要包含的文件（可省略以减小ZIP大小）

```
❌ node_modules/          会在云端自动安装
❌ dist/                  会在云端自动构建
❌ .git/                  版本控制（仅用于Git仓库部署）
❌ .vscode/               IDE配置
❌ .idea/                 IDE配置
❌ *.log                  日志文件
❌ .DS_Store              MacOS系统文件
❌ .env.local             本地环境变量（敏感信息）
```

---

## 📋 打包步骤

### 方法1：手动ZIP（Windows）
1. 选中所有必需文件和文件夹
2. 右键 → 发送到 → 压缩(zipped)文件夹
3. 重命名为 `taprootagro-pwa.zip`

### 方法2：手动ZIP（macOS）
1. 选中所有必需文件和文件夹
2. 右键 → 压缩项目
3. 重命名为 `taprootagro-pwa.zip`

### 方法3：命令行ZIP（推荐）
```bash
# macOS/Linux
zip -r taprootagro-pwa.zip . \
  -x "node_modules/*" \
  -x "dist/*" \
  -x ".git/*" \
  -x "*.log" \
  -x ".DS_Store"

# Windows PowerShell
Compress-Archive -Path * -DestinationPath taprootagro-pwa.zip -Force
```

### 方法4：使用Git导出
```bash
git archive --format=zip --output=taprootagro-pwa.zip HEAD
```

---

## 🔍 打包后检查清单

上传前，解压ZIP确认包含：

- [ ] `pages.json` 在根目录
- [ ] `package.json` 包含 `"build": "vite build"` 脚本
- [ ] `src/` 目录完整
- [ ] `public/service-worker.js` 存在
- [ ] `public/manifest.json` 存在
- [ ] `public/icon-192.png` 和 `icon-512.png` 存在
- [ ] 没有 `node_modules/` 目录（体积会很大）
- [ ] 没有 `dist/` 目录（会在云端生成）

---

## 📊 预期ZIP大小

- **正常大小**: 2-10 MB（不含node_modules和dist）
- **如果超过50MB**: 可能包含了不必要的文件，检查是否排除了node_modules
- **如果小于1MB**: 可能缺少源代码或public目录

---

## 🚀 上传到ESA Pages

1. 访问：https://esa.console.aliyun.com/
2. 进入 Pages → 新建应用
3. 选择"上传ZIP包"
4. 上传你的 `taprootagro-pwa.zip`
5. ESA会自动：
   - 读取 `pages.json` 配置
   - 执行 `npm install`（安装依赖）
   - 执行 `npm run build`（构建项目）
   - 部署 `dist/` 目录内容
6. 部署完成，获得访问URL

---

## 🔧 故障排查

### Q: 上传后构建失败，提示"找不到package.json"
A: 确保ZIP包的根目录直接包含 `package.json`，不要多套一层文件夹

### Q: 构建成功但页面空白
A: 检查浏览器控制台，可能是路径问题。确保 `vite.config.ts` 没有设置 `base`

### Q: Service Worker不工作
A: 检查 `public/service-worker.js` 是否被正确包含在ZIP中

### Q: ZIP太大无法上传
A: 删除 `node_modules/` 和 `dist/` 目录

---

## 📝 快速打包命令（推荐）

创建一个 `pack.sh` 脚本：

```bash
#!/bin/bash
# pack.sh - 一键打包脚本

echo "📦 正在打包项目..."

# 删除旧的ZIP
rm -f taprootagro-pwa.zip

# 创建新的ZIP（排除不需要的文件）
zip -r taprootagro-pwa.zip . \
  -x "node_modules/*" \
  -x "dist/*" \
  -x ".git/*" \
  -x "*.log" \
  -x ".DS_Store" \
  -x ".vscode/*" \
  -x ".idea/*"

echo "✅ 打包完成: taprootagro-pwa.zip"
ls -lh taprootagro-pwa.zip
```

使用：
```bash
chmod +x pack.sh
./pack.sh
```

---

## 🎉 打包完成

ZIP包已准备好，可以上传到阿里云ESA Pages进行部署！
