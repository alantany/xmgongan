# 部署指南

本系统包含一个 Node.js/Express 后端服务器和一个静态前端。

## 后端部署

### 1. 环境要求

*   **Node.js**: 版本建议 16.x 或更高。
*   **npm**: Node.js 自带的包管理器。
*   **antiword**: 用于从 `.doc` (Microsoft Word 97-2003) 文件中提取文本。**此为必需的系统依赖。**

### 2. 安装依赖

进入 `server` 目录并安装 Node.js 依赖：

```bash
cd server
npm install
```

### 3. 安装 `antiword` (重要系统依赖)

`antiword` 工具必须预先安装在服务器上，并且 Node.js 进程能够通过系统的 `PATH` 环境变量找到它。

#### Linux (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install antiword
```

#### Linux (RHEL/CentOS/Fedora):

```bash
sudo yum install antiword
```
或 (对于较新的 Fedora/RHEL 版本):
```bash
sudo dnf install antiword
```

#### macOS (使用 Homebrew):

```bash
brew install antiword
```

#### Windows:
在 Windows 上直接使用 `antiword` 较为复杂。推荐的方式是：
1.  使用 **Windows Subsystem for Linux (WSL)**，并在 WSL 环境中安装 `antiword` (参照上面的 Linux 指令)。然后确保 Node.js 应用在 WSL 环境中运行，或者能够调用到 WSL 中的 `antiword`。
2.  寻找并配置原生的 Windows 版 `antiword` 可执行文件，并将其路径添加到系统 PATH 环境变量中。可执行文件可能需要从 `antiword` 官网或其他第三方源获取。

**验证安装：**
安装完成后，在终端或命令行中执行 `antiword`。如果看到用法说明或版本信息，则表示安装成功且在 PATH 中。如果提示命令未找到，请检查安装步骤或 PATH 配置。

### 4. 运行服务器

在 `server` 目录下：

```bash
npm start
```
或者
```bash
node app.js
```

默认情况下，服务器会运行在 `http://localhost:3000`。

## 前端访问

前端静态文件由后端服务器托管在 `/` 路径。直接在浏览器中访问服务器地址即可，例如 `http://localhost:3000` 会加载聊天界面，`http://localhost:3000/admin.html` 会加载后台管理界面。

## 模型配置

通过访问 `/admin.html` 页面可以配置大语言模型。配置文件 `models.json` 位于 `server` 目录下。首次运行时，如果该文件不存在，可能会自动创建或需要通过管理界面添加第一个模型。 