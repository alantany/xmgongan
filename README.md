# 公安案件处理AI辅助分析系统 - 项目文档

## 1. 项目概述

本项目旨在开发一个公安案件处理的AI辅助分析系统。核心功能包括一个与大语言模型 (LLM) 进行交互的聊天界面，以及一个用于管理和配置LLM的后台管理面板。系统支持文本提问、文件上传（包括文档、图片等多种格式，并进行内容提取和OCR识别），并将处理后的信息发送给LLM获取分析结果。

## 2. 核心技术

*   **后端**: Node.js, Express.js
*   **前端**: HTML, CSS, JavaScript
*   **数据存储**: JSON 文件 (`server/models.json`) 用于存储LLM配置
*   **文档处理**:
    *   `.pdf`: `pdf-parse`
    *   `.docx`: `mammoth`
    *   `.doc`: `antiword` (通过子进程调用)
    *   `.wps`: `LibreOffice` (通过子进程调用 `soffice`)
    *   `.xlsx`, `.xls`: `xlsx` (SheetJS)
    *   图片 (OCR): `tesseract.js`
    *   `.csv`, `.txt`: 直接文本读取
*   **实时通信**: Server-Sent Events (SSE) 用于流式传输AI回复

## 3. 项目目录结构

```
.
├── DEPLOYMENT.md             # 部署指南，包括 antiword, LibreOffice 等依赖的安装
├── README.md                 # 本项目文档
└── server/
    ├── app.js                # 后端 Express 服务器核心逻辑
    ├── models.json           # 存储 LLM 模型配置
    ├── package.json          # 后端 Node.js 项目依赖及脚本配置
    ├── package-lock.json     # 锁定后端依赖版本
    ├── node_modules/         # 后端 Node.js 依赖库 (自动生成)
    └── public/               # 存放所有前端静态文件
        ├── index.html        # 用户聊天主界面
        ├── script.js         # 聊天主界面的 JavaScript 逻辑
        ├── style.css         # 聊天主界面的 CSS 样式
        ├── admin.html        # LLM 模型管理后台界面
        ├── admin.js          # 管理后台的 JavaScript 逻辑
        └── admin.css         # 管理后台的 CSS 样式
```

## 4. 模块/文件功能介绍

### 4.1. 后端 (`server/`)

*   **`server/app.js`**:
    *   基于 Express.js 构建的后端主应用。
    *   提供 RESTful API 用于对 `models.json` 中的 LLM 配置进行增删改查。
    *   实现 `/api/models/active` 接口，用于获取和设置当前激活的 LLM 模型。
    *   实现 `/api/relay` 核心代理接口：
        *   接收前端的聊天请求（文本和附件）。
        *   处理上传的附件：
            *   根据文件类型（PDF, DOCX, DOC, WPS, XLSX/XLS, CSV, TXT, 图片）调用相应的库或工具进行文本内容提取。
            *   图片使用 `tesseract.js` 进行 OCR。
            *   `.doc` 文件通过调用系统安装的 `antiword` 工具提取文本。
            *   `.wps` 文件通过调用系统安装的 `LibreOffice` (soffice) 工具转换为文本提取。
        *   将提取的文本内容和用户问题整合后，根据当前激活模型的配置，转发给相应的 LLM API。
        *   处理 LLM 的流式响应 (Server-Sent Events) 并将其转发给前端。
    *   托管 `server/public/` 目录下的所有静态前端文件。

*   **`server/models.json`**:
    *   以 JSON 格式存储大语言模型的配置列表。
    *   每个模型对象通常包含：`id`, `name` (模型显示名称), `apiUrl` (模型接口地址), `apikey` (模型API密钥), `modelName` (具体模型标识，如 `gpt-4`), `type` (模型提供商类型，如 `openrouter`, `ollama`), `isActive` (布尔值，标记是否为当前活动模型)等。

*   **`server/package.json`**:
    *   定义了后端项目所需的 Node.js 依赖库（如 `express`, `cors`, `body-parser`, `node-fetch`, `pdf-parse`, `mammoth`, `xlsx`, `tesseract.js` 等）。
    *   包含项目的启动脚本 (如 `npm start`, `npm run dev`)。

### 4.2. 前端 (`server/public/`)

*   **聊天界面**
    *   `server/public/index.html`:
        *   用户与AI进行交互的主聊天界面结构。
        *   包含消息显示区域、文本输入框、文件上传按钮、发送按钮等元素。
    *   `server/public/script.js`:
        *   处理聊天界面的所有动态逻辑。
        *   从后端 `/api/models/active` 获取当前激活模型信息。
        *   捕获用户输入和文件选择 (包括 `.wps` 等新支持的格式)。
        *   将用户消息和文件（Base64编码或文本内容）发送到后端 `/api/relay` 接口。
        *   接收并处理来自后端的流式响应，实时更新聊天界面中的AI回复。
        *   使用 `marked.js` (通过CDN引入) 将Markdown格式的AI回复渲染为HTML。
        *   管理文件上传列表的显示与交互。
    *   `server/public/style.css`:
        *   定义聊天界面的外观样式，包括消息气泡、输入区域、按钮等。

*   **管理后台**
    *   `server/public/admin.html`:
        *   用于管理LLM模型配置的后台界面结构。
        *   提供表单用于添加、编辑模型信息。
        *   显示当前所有模型的列表，并允许删除和设置活动模型。
        *   提供导入/导出 `models.json` 配置的功能。
    *   `server/public/admin.js`:
        *   处理管理后台的交互逻辑。
        *   通过调用后端API (如 `/api/models`, `/api/models/active`) 来获取、添加、修改、删除LLM配置。
        *   实现模型配置的导入导出功能。
    *   `server/public/admin.css`:
        *   定义管理后台界面的外观样式。

### 4.3. 部署文档

*   **`DEPLOYMENT.md`**:
    *   详细说明了项目的部署步骤。
    *   包括环境要求（Node.js, npm）。
    *   特别强调了**必需的系统依赖 `antiword` (用于 .doc) 和 `LibreOffice` (用于 .wps)** 及其在不同操作系统上的安装方法。
    *   指导如何安装后端依赖和运行服务器。

## 5. 核心功能回顾

*   **LLM 模型管理**: 通过管理后台增、删、改、查LLM配置，设置活动模型，导入导出配置。
*   **AI 聊天交互**: 用户在主界面与当前激活的LLM进行对话。
*   **多格式文件上传与处理**:
    *   支持 `.txt`, `.pdf`, `.doc`, `.docx`, `.wps`, `.xls`, `.xlsx`, `.csv` 等文档格式，以及 `.jpeg`, `.jpg`, `.png` 等图片格式。
    *   后端自动从这些文件中提取文本内容（对图片进行OCR）。
    *   提取的内容会与用户当前的问题一并发送给LLM。
*   **流式响应**: AI的回复以流式方式逐字显示在界面上，提升用户体验。
*   **Markdown 渲染**: AI的回复支持Markdown格式，并在前端正确渲染。
*   **UI 优化**: 包括加载指示器、用户/AI头像图标、Enter键发送消息等。
