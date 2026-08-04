# H5-NDI-Bridge V1 测试报告

更新时间：2026-08-04

## 当前目标

验证自定义 H5 页面通过 `window.H5NdiSource` 提供 RGBA 帧，Chrome 插件连接本地 Helper，Helper 以 NDI RGBA 源输出到下游接收端，并保留 Alpha。

## 已完成的代码

- H5 测试页面：`test-page/index.html`
- Chrome MV3 插件：`extension/`
- Native Messaging 配置模板：`native-host/`
- 本地 WebSocket RGBA 接收：`src/ipc/IPCReceiver.ts`
- NDI DLL 加载：`src/core/DLLoader.ts`
- NDI RGBA 视频发送：`src/core/NDISender.ts`
- 固定容量 Ring Buffer：`src/core/RingBuffer.ts`
- Native Messaging 主机协议：`src/nativeHost.ts`

## 已通过

| 检查项 | 结果 |
|---|---|
| TypeScript 编译 | 通过 |
| 插件 JavaScript 语法检查 | 通过 |
| Ring Buffer 满载丢弃旧帧检查 | 通过 |
| Mock sender RGBA 帧尺寸路径 | 待执行 |
| 项目依赖安全审计 | `npm install --ignore-scripts` 后无已报告漏洞 |

## 当前阻塞

普通 `npm install` 在当前机器失败，因为：

- Node.js 版本为 `v24.14.0`
- `ffi-napi` 尝试通过 `node-gyp` 编译
- 系统没有可用的 Python 构建环境

使用 `npm install --ignore-scripts` 可以完成 TypeScript 静态构建，但这不代表 `ffi-napi` 的运行时原生绑定已经可用。

直接启动程序时，NDI 加载失败并返回 Windows 错误 126：当前机器未检测到 `Processing.NDI.Lib.x64.dll`。需要安装 NDI Runtime，或设置 `NDI_RUNTIME` 指向 DLL 所在目录。

## 真实环境测试流程

1. 安装 Windows x64 NDI Runtime。
2. 使用 Node.js LTS（建议 Node 20 x64），重新执行 `npm install`。
3. 执行 `npm run build`。
4. 启动 `npm run helper`，确认日志出现 NDI 源和本地 WebSocket 地址。
5. 用 `python -m http.server 8080 --directory test-page` 启动测试页。
6. 在 Chrome 中打开 `http://127.0.0.1:8080`。
7. 以开发者模式加载 `extension/` 插件。
8. 点击插件按钮，确认 Helper 连接成功。
9. 在 NDI 接收端检查是否出现 `H5-Studio-Stream`。
10. 在接收端放置绿色背景，检查透明、半透明和不透明图形。
11. 使用第二台局域网电脑重复检查 NDI 发现和视频接收。

## Alpha 验收标准

- 棋盘格背景能透出接收端绿色背景。
- 半透明蓝色方块显示为蓝色与绿色的混合色。
- 不透明红色方块完全遮挡绿色背景。
- 没有透明区域被错误填充为黑色。

## 尚未声称通过的项目

- NDI Runtime 实际 DLL 加载
- OBS/vMix 实际发现 NDI 源
- Alpha 端到端验收
- 1080p@50fps 长时间稳定性
- CPU 低于 5%
- 安装包和 Native Messaging Helper 的最终打包

这些项目必须在安装 NDI Runtime、解决 `ffi-napi` 原生依赖后进行实机验证。
