# 部署指南

本系统包含一个 Node.js/Express 后端服务器和一个静态前端。

## 后端部署

### 1. 环境要求

*   **Node.js**: 版本建议 16.x 或更高。
*   **npm**: Node.js 自带的包管理器。
*   **antiword**: 用于从 `.doc` (Microsoft Word 97-2003) 文件中提取文本。**此为必需的系统依赖。**
*   **LibreOffice**: 用于从 `.wps` (WPS Office) 等多种文档格式中提取文本。**此为必需的系统依赖。** `soffice` 或 `libreoffice` 命令需在系统 PATH 中可访问。

### 2. 安装依赖

进入 `server` 目录并安装 Node.js 依赖：

```bash
cd server
npm install
```

### 3. 安装系统依赖 (重要)

#### 3.1. 安装 `antiword`

`antiword` 工具必须预先安装在服务器上，并且 Node.js 进程能够通过系统的 `PATH` 环境变量找到它。

##### Linux (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install antiword
```

##### Linux (RHEL/CentOS/Fedora):

```bash
sudo yum install antiword
```
或 (对于较新的 Fedora/RHEL 版本):
```bash
sudo dnf install antiword
```

##### macOS (使用 Homebrew):

```bash
brew install antiword
```

##### Windows:
在 Windows 上直接使用 `antiword` 较为复杂。推荐的方式是使用 WSL 并在其中安装，或配置原生可执行文件并添加到 PATH。

**验证 `antiword` 安装：**
执行 `antiword` 命令，若显示用法说明则表示成功。

#### 3.2. 安装 `LibreOffice`

LibreOffice 用于处理 `.wps` 等复杂文档格式。需要安装完整的 LibreOffice 套件，其命令行工具 `soffice` (或 `libreoffice`) 必须在系统的 `PATH` 环境变量中可被 Node.js 进程调用。

##### Linux (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install libreoffice  # 这会安装包含 writer, calc, impress 等的完整套件
# 或者，如果只需要 headless 功能，可以尝试安装更精简的包，但这可能因发行版而异
# sudo apt install libreoffice-writer # 通常 writer 包含了 headless 转换所需的功能
```

##### Linux (RHEL/CentOS/Fedora):

```bash
sudo yum groupinstall "Office Suite and Productivity" # RHEL/CentOS 7
sudo yum install libreoffice-headless libreoffice-writer # RHEL/CentOS 7/8 (具体包名可能变化)
sudo dnf groupinstall "Office Suite" # Fedora
sudo dnf install libreoffice-headless libreoffice-writer # Fedora (具体包名可能变化)
```
确保安装了 `libreoffice-headless` (如果可用) 和至少一个如 `libreoffice-writer` 的组件以支持文档转换。

##### macOS (从官网下载):
推荐从 [LibreOffice 官网](https://www.libreoffice.org/download/download/) 下载适用于 macOS 的安装包并进行安装。安装后，`soffice` 命令通常位于 `/Applications/LibreOffice.app/Contents/MacOS/soffice`。你可能需要将其添加到 PATH 或在 Node.js 代码中指定完整路径（当前代码假设它在 PATH 中）。

一个将其添加到 PATH 的临时方法 (在当前终端会话中): 
`export PATH="/Applications/LibreOffice.app/Contents/MacOS:$PATH"`
要永久添加，需修改 shell 配置文件 (如 `.zshrc`, `.bash_profile`)。

##### Windows (从官网下载):
从 [LibreOffice 官网](https://www.libreoffice.org/download/download/) 下载适用于 Windows 的安装包并进行安装。安装过程中，确保勾选了添加到系统 PATH 的选项（如果有），或者手动将 LibreOffice 的 `program` 目录 (例如 `C:\Program Files\LibreOffice\program`) 添加到系统环境变量 PATH 中。

**验证 `LibreOffice (soffice)` 安装：**
安装完成后，在终端或命令行中执行 `soffice --version` 或 `libreoffice --version`。如果看到版本信息，则表示安装成功且在 PATH 中。如果提示命令未找到，请检查安装步骤或 PATH 配置。

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