# FT-002 Git 地址解析 实施计划

> **🔗 前置依赖**：本文档基于 [FT-002-git-address-parsing-PRD.md](./FT-002-git-address-parsing-PRD.md)（产品需求文档）拆解生成。

> 最后更新：2026-05-25

> **📋 开发进度**：[develop-log.json](./develop-log.json) — 任务执行状态与历史记录（由 `/qahc-harness-develop` 驱动更新）

---

## 项目概述

本计划基于 FT-002 PRD 将设计方案拆解为 3 个 Phase、9 个可独立验证的纵向切片任务。目标是将 CLI 的 validate/stat/convert/fetch 四个命令从 Mock 替换为真实实现，构建全协议 AVFS URI 解析器（5 协议）和 GitHub REST API Driver。

### 前置依赖

- **FT-001 CLI 基础框架**（✅ 已实现）：提供 Commander CLI 骨架、6 组命令注册入口、5 类 Driver stub、tsup 构建配置

### 后续依赖

- 后续特性（如 FT-003+）将基于本特性提供的 parser 模块实现更多协议 driver（file/http/https/smb）

---

## 进度概要

| Phase | 任务 | 状态 | 交付物 |
| :----: | ------ | :----: | ------ |
| 1 | 1.1 测试数据框架 + 类型定义 | ✅ | `cli/test/fixtures/` (4 组 JSON) + `cli/src/parser/types.ts` |
| 1 | 1.2 URI 解析器 + validate 命令激活 | ✅ | `cli/src/parser/uri-parser.ts`, `validator.ts`, `index.ts` + 修改 `validate.command.ts` |
| 1 | 1.3 协议转换器 (file/http/https/smb) + stat 命令激活 | ✅ | 4 个 converter + `converter.interface.ts` + 修改 `stat.command.ts` |
| 2 | 2.1 Git 平台检测模块 | ✅ | `git-platform.interface.ts`, `github-platform.ts`, `platform-registry.ts` |
| 2 | 2.2 Git 转换器 + convert --to-avfs | ⏳ | `git-converter.ts` + 修改 `convert.command.ts`（--to-avfs 方向）|
| 2 | 2.3 convert --to-native 全协议实现 | ⏳ | 所有 converter 的 `toNative()` 方法 + convert 命令补全 |
| 3 | 3.1 GitHub API Driver 实现 | ⏳ | 修改 `git.driver.ts`（connect/read/stat/close）|
| 3 | 3.2 fetch 命令激活 | ⏳ | 修改 `fetch.command.ts`（stdout / -o 文件写入）|
| 3 | 3.3 单元测试 + 覆盖率配置 + CI 验证 | ⏳ | vitest 测试文件 + `@vitest/coverage-v8` 配置 + CI 通过 |

---

## Phase 1: Parser 核心与地址校验/解析

### 目标

建立全协议 AVFS URI 解析基础设施，激活 `avfs validate` 和 `avfs stat` 两个命令，Phase 1 结束后即可独立校验和解析任意协议的 avfs:// 地址。

---

### 任务 1.1: 测试数据框架 + 核心类型定义

#### 工程属性

| 属性 | 值 |
|------|-----|
| 新建目录 | `cli/test/fixtures/` |
| 新建目录 | `cli/src/parser/` |
| 新建文件 | `cli/src/parser/types.ts` |
| 新增文件 | `cli/test/fixtures/README.md` |
| 依赖 | 无（本任务为基础设施，无上游依赖） |

#### 核心逻辑

1. 创建 `cli/test/fixtures/` 目录结构，按 PRD 决策点 16 规范组织 4 组 JSON fixtures：
   - `addressing/valid-uris.json`：5 协议合法 URI（各 2+ 条），包含正常路径、可选 version、可选 anchor
   - `addressing/invalid-uris.json`：非法 URI（无前缀、空协议、缺 resourceBase、缺 filePath 等），含期望错误类型
   - `git-conversion.json`：Git 原生 URL ↔ AVFS 双向转换对（HTTPS clone/SSH，含/不含 .git、含/不含子路径）
   - `platform-detection.json`：Git 平台检测用例（GitHub HTTPS/SSH、非 git HTTPS URL、裸引用）
2. 定义核心类型（`cli/src/parser/types.ts`）：
   - `SUPPORTED_PROTOCOLS`、`ProtocolType`
   - `SUPPORTED_GIT_PLATFORMS`、`GitPlatformType`
   - `ParsedAddress`、`NativeUrl`、`ConvertOptions`、`ConvertResult`、`ValidationResult`
3. 配置 TypeScript `resolveJsonModule` 确保 JSON fixtures 可直接 import

#### 交付物

- `cli/src/parser/types.ts` — 所有核心类型定义
- `cli/test/fixtures/README.md` — fixture 使用规范与 JSON schema 说明
- `cli/test/fixtures/addressing/valid-uris.json`
- `cli/test/fixtures/addressing/invalid-uris.json`
- `cli/test/fixtures/git-conversion.json`
- `cli/test/fixtures/platform-detection.json`

#### 验证步骤

- [x] **V1.1.1** 类型文件编译通过，无 TypeScript 错误 ✅
  `cd cli && npx tsc --noEmit`
- [x] **V1.1.2** valid-uris.json 包含 5 协议各至少 2 条合法 URI ✅
  `cat cli/test/fixtures/addressing/valid-uris.json | jq '.testCases | length'` → `12 >= 10`
- [x] **V1.1.3** invalid-uris.json 包含至少 5 种非法 URI 类型 ✅
  `cat cli/test/fixtures/addressing/invalid-uris.json | jq '.testCases | length'` → `10 >= 5`
- [x] **V1.1.4** git-conversion.json 包含 HTTPS + SSH 转换对 ✅
  `cat cli/test/fixtures/git-conversion.json | jq '.testCases[] | select(.expected.native | startswith("https://") or startswith("git@"))'` → 8 条结果
- [x] **V1.1.5** platform-detection.json 包含 GitHub 平台与非 GitHub 平台用例 ✅
  `cat cli/test/fixtures/platform-detection.json | jq '[.testCases[].expected.platform] | unique'` → `["github","unknown"]`
- [x] **V1.1.6** 所有 JSON 文件符合 `{ meta: {...}, testCases: [...] }` 统一结构 ✅
  `for f in cli/test/fixtures/**/*.json; do jq 'keys | contains(["meta","testCases"])' "$f"; done` → 全部 `true`

---

### 任务 1.2: URI 解析器 + validate 命令激活

#### 核心逻辑

1. 实现 `cli/src/parser/uri-parser.ts`：
   - `parseAvfsUri(raw: string): ParsedAddress` — 按 PRD §3.3.1 算法实现：前缀检查 → 锚点拆分 → 协议提取 → resourceBase/version/filePath 拆分（git 协议支持 @version 语法，非 git 协议无 version）→ 校验 → 返回 ParsedAddress（不抛异常）
2. 实现 `cli/src/parser/validator.ts`：
   - `validateAvfsUri(raw: string): ValidationResult` — 调用 parseAvfsUri，包装为简化结果 `{ valid, address?, errors? }`
3. 实现 `cli/src/parser/index.ts` 公共导出
4. 修改 `cli/src/commands/validate.command.ts`：
   - 调用 `validateAvfsUri(address)` 替换 Mock
   - 输出 JSON.stringify(result)，`valid=false` 时 exitCode=1
5. 新增单元测试文件 `cli/test/parser/uri-parser.test.ts`：
   - 从 `valid-uris.json` 加载 testCases，验证 `parseAvfsUri()` 返回 `isValid: true`
   - 从 `invalid-uris.json` 加载 testCases，验证 `parseAvfsUri()` 返回 `isValid: false` + 对应 errors
   - 覆盖边界条件：空字符串、仅前缀、缺 filePath、git 有 version 无 filePath

#### 交付物

- `cli/src/parser/uri-parser.ts` — 核心 URI 解析器
- `cli/src/parser/validator.ts` — 语法校验器
- `cli/src/parser/index.ts` — Public API 导出
- `cli/src/commands/validate.command.ts` — 修改（Mock → 真实实现）
- `cli/test/parser/uri-parser.test.ts` — 单元测试

#### 验证步骤

- [x] **V1.2.1** 编译通过，零 TypeScript 错误 ✅
  `cd cli && npx tsc --noEmit`
- [x] **V1.2.2** 合法 git URI 解析正确 → `isValid: true`，字段完整 ✅
  `cd cli && npx vitest run test/parser/uri-parser.test.ts --reporter=verbose`
- [x] **V1.2.3** 非法 URI 解析返回 `isValid: false` + 对应 errors ✅
  `cd cli && npx vitest run test/parser/uri-parser.test.ts` → 全部通过
- [x] **V1.2.4** `avfs validate avfs://git/github.com/avfs-io/core@main/readme.md` → `{"valid":true,...}` ✅
  `cd cli && pnpm build && node dist/index.mjs validate 'avfs://git/github.com/avfs-io/core@main/readme.md'`
- [x] **V1.2.5** `avfs validate "not-an-avfs-address"` → `{"valid":false,"errors":[...]}` + exit 1 ✅
  `cd cli && pnpm build && node dist/index.mjs validate 'not-an-avfs-address' || echo "exit=$?"` → 含 errors 数组
- [x] **V1.2.6** 5 协议各 1 个合法地址校验通过 ✅
  `for proto in file http https smb git; do cd cli && node dist/index.mjs validate "avfs://$proto/test/path.txt"; done` → 全部 valid:true
- [x] **V1.2.7** 边界条件：空输入、仅 `avfs://`、缺少 filePath 的 git URI 均有明确错误 ✅
  `cd cli && npx vitest run test/parser/uri-parser.test.ts` → 边界用例通过

---

### 任务 1.3: 协议转换器 (file/http/https/smb) + stat 命令激活

#### 核心逻辑

1. 定义 `cli/src/parser/protocol-converters/converter.interface.ts`：
   - `ProtocolConverter` 接口：`protocol`、`detect(nativeInput)`、`toAvfs(nativeInput)`、`toNative(parsed)`
   - 工厂函数：`getConverter(protocol)`、`detectProtocol(nativeInput)`
2. 实现 4 个非 git 协议转换器：
   - `file-converter.ts`：`/home/user/file.txt` ↔ `avfs://file/home/user/file.txt`
   - `http-converter.ts`：`http://host:port/path` ↔ `avfs://http/host:port/path`
   - `https-converter.ts`：`https://host/path` ↔ `avfs://https/host/path`
   - `smb-converter.ts`：`\\server\share\path` ↔ `avfs://smb/server/share/path`
   - **注意**：本任务仅实现 `toAvfs()` 和 `detect()` 方法，`toNative()` 在任务 2.3 实现
3. 修改 `cli/src/commands/stat.command.ts`：
   - 调用 `parseAvfsUri(address)` 替换 Mock
   - 输出 `JSON.stringify(parsed)`（含 protocol、resourceBase、version、filePath、anchor、rawInput）
4. 新增单元测试 `cli/test/parser/protocol-converters.test.ts`：
   - 加载 `git-conversion.json` 中非 git 部分（如有）
   - 测试各 converter 的 `detect()` 正确识别协议
   - 测试各 converter 的 `toAvfs()` 正确输出

#### 交付物

- `cli/src/parser/protocol-converters/converter.interface.ts` — 转换器接口
- `cli/src/parser/protocol-converters/file-converter.ts`
- `cli/src/parser/protocol-converters/http-converter.ts`
- `cli/src/parser/protocol-converters/https-converter.ts`
- `cli/src/parser/protocol-converters/smb-converter.ts`
- `cli/src/commands/stat.command.ts` — 修改（Mock → 真实实现）
- `cli/test/parser/protocol-converters.test.ts` — 转换器单元测试

#### 验证步骤

- [x] **V1.3.1** 编译通过 ✅
  `cd cli && npx tsc --noEmit`
- [x] **V1.3.2** file converter 正确转换 Unix 绝对路径 → `avfs://file/...` ✅
  `cd cli && npx vitest run test/parser/protocol-converters.test.ts --reporter=verbose`
- [x] **V1.3.3** http converter 正确保留端口号 → `avfs://http/host:port/path` ✅
  `cd cli && npx vitest run test/parser/protocol-converters.test.ts` → http 用例通过
- [x] **V1.3.4** https converter 正确转换 URL（含子路径、不含端口） ✅
  `cd cli && npx vitest run test/parser/protocol-converters.test.ts` → https 用例通过
- [x] **V1.3.5** smb converter 正确处理 UNC 路径 `\\server\share\...` → `avfs://smb/server/share/...` ✅
  `cd cli && npx vitest run test/parser/protocol-converters.test.ts` → smb 用例通过
- [x] **V1.3.6** `avfs stat avfs://git/github.com/avfs-io/core@main/readme.md` → 输出完整 JSON（含 protocol、resourceBase、version、filePath） ✅
  `cd cli && pnpm build && node dist/index.mjs stat 'avfs://git/github.com/avfs-io/core@main/readme.md' | jq '{protocol, resourceBase, version, filePath}'`
- [x] **V1.3.7** `avfs stat avfs://file/home/user/config.json#L120` → 正确提取 anchor ✅
  `cd cli && pnpm build && node dist/index.mjs stat 'avfs://file/home/user/config.json#L120' | jq '.anchor'` → `"L120"`
- [x] **V1.3.8** 5 协议各 1 条 stat 全部正确输出 ✅
  `for addr in 'avfs://file/home/test.txt' 'avfs://http/example.com/data.csv' 'avfs://https/cdn.example.com/pkg.zip' 'avfs://smb/10.0.0.1/share/doc.pdf' 'avfs://git/github.com/avfs-io/core@main/README.md'; do cd cli && node dist/index.mjs stat "$addr" | jq '{protocol, isValid}'; done` → 全部 `isValid: true`

---

## Phase 2: Git 平台识别与地址双向转换

### 目标

实现 Git 原生 URL（HTTPS Clone / SSH）→ AVFS 转换，包括 GitHub 平台检测策略，激活 `avfs convert` 命令的双向转换能力。

---

### 任务 2.1: Git 平台检测模块

#### 核心逻辑

1. 定义 `cli/src/parser/git/git-platform.interface.ts`：
   - `GitPlatform` 接口：`name`、`detect(nativeUrl)`、`extractResourceBase(nativeUrl)`、`buildCloneUrl(resourceBase)`
2. 实现 `cli/src/parser/git/github-platform.ts`：
   - `detect()` — 检测 hostname 为 `github.com` 的 HTTPS URL 或 `git@github.com:` 的 SSH URL
   - `extractResourceBase()` — 从 URL 提取 `github.com/{owner}/{repo}`，去除 `.git` 后缀和子路径
   - `buildCloneUrl()` — 从 resourceBase 重建 `https://github.com/{owner}/{repo}.git`
3. 实现 `cli/src/parser/git/platform-registry.ts`：
   - 注册表管理：`register(platform)`、`detectPlatform(nativeUrl)`、`getPlatform(name)`
   - 默认注册 `GitHubPlatform`
4. 新增单元测试 `cli/test/parser/git-platform.test.ts`：
   - 从 `platform-detection.json` 加载 testCases
   - 验证 GitHub HTTPS URL / SSH URL 正确检测
   - 验证非 GitHub URL 返回 `unknown`
   - 验证 resourceBase 提取（去除 .git、去除子路径）

#### 交付物

- `cli/src/parser/git/git-platform.interface.ts` — GitPlatform 接口
- `cli/src/parser/git/github-platform.ts` — GitHub 平台实现
- `cli/src/parser/git/platform-registry.ts` — 平台注册表
- `cli/test/parser/git-platform.test.ts` — 平台检测单元测试

#### 验证步骤

- [x] **V2.1.1** 编译通过 ✅
  `cd cli && npx tsc --noEmit`
- [x] **V2.1.2** GitHub HTTPS clone URL 检测正确 → platform=github, resourceBase 不含 .git ✅
  `cd cli && npx vitest run test/parser/git-platform.test.ts --reporter=verbose`
- [x] **V2.1.3** GitHub SSH URL 检测正确 → platform=github, resourceBase 格式正确 ✅
  `cd cli && npx vitest run test/parser/git-platform.test.ts` → SSH 用例通过
- [x] **V2.1.4** 非 GitHub HTTPS URL 返回 platform=unknown ✅
  `cd cli && npx vitest run test/parser/git-platform.test.ts` → unknown 用例通过
- [x] **V2.1.5** `buildCloneUrl("github.com/avfs-io/core")` → `"https://github.com/avfs-io/core.git"` ✅
  `cd cli && npx vitest run test/parser/git-platform.test.ts` → cloneUrl 断言通过
- [x] **V2.1.6** platform-registry 支持动态注册新平台 ✅
  `cd cli && npx vitest run test/parser/git-platform.test.ts` → 注册表用例通过

---

### 任务 2.2: Git 转换器 + convert --to-avfs

#### 核心逻辑

1. 实现 `cli/src/parser/protocol-converters/git-converter.ts`：
   - `detect()` — 委托 `PlatformRegistry.detectPlatform()` 判断是否为 git 地址
   - `toAvfs()` — 识别原生 Git URL → 调用对应 Platform 提取 resourceBase → 格式化 `avfs://git/{resourceBase}`
   - **注意**：本任务仅实现 `toAvfs()` 和 `detect()`，`toNative()` 在任务 2.3 实现
2. 更新 `cli/src/parser/protocol-converters/` 的 `getConverter()` 和 `detectProtocol()`：
   - 将 `git-converter` 注册到转换器工厂
   - 协议检测优先级：git SSH → git HTTPS → SMB → file → HTTPS → HTTP
3. 修改 `cli/src/commands/convert.command.ts`：
   - 新增 `--to-avfs` 选项
   - 调用 `detectProtocol()` → `getConverter()` → `converter.toAvfs()` → 输出 AVFS URI
4. 新增单元测试 `cli/test/parser/git-converter.test.ts`：
   - 从 `git-conversion.json` 加载 testCases
   - 验证 HTTPS clone URL（含/不含 .git）→ `avfs://git/github.com/...`
   - 验证 SSH URL → `avfs://git/github.com/...`
   - 验证非 git 地址 detect 返回 false

#### 交付物

- `cli/src/parser/protocol-converters/git-converter.ts` — Git 协议转换器
- `cli/src/parser/protocol-converters/` 索引文件更新（注册 git-converter）
- `cli/src/commands/convert.command.ts` — 修改（新增 --to-avfs / --to-native 选项，实现 --to-avfs）
- `cli/test/parser/git-converter.test.ts` — Git 转换器单元测试

#### 验证步骤

- [ ] **V2.2.1** 编译通过
  `cd cli && npx tsc --noEmit`
- [ ] **V2.2.2** `avfs convert https://github.com/avfs-io/core.git --to-avfs` → `avfs://git/github.com/avfs-io/core`
  `cd cli && pnpm build && node dist/index.mjs convert 'https://github.com/avfs-io/core.git' --to-avfs`
- [ ] **V2.2.3** `avfs convert git@github.com:avfs-io/core.git --to-avfs` → `avfs://git/github.com/avfs-io/core`
  `cd cli && pnpm build && node dist/index.mjs convert 'git@github.com:avfs-io/core.git' --to-avfs`
- [ ] **V2.2.4** `avfs convert /home/user/config.json --to-avfs` → `avfs://file/home/user/config.json`
  `cd cli && pnpm build && node dist/index.mjs convert '/home/user/config.json' --to-avfs`
- [ ] **V2.2.5** `avfs convert https://cdn.example.com/pkg.zip --to-avfs` → `avfs://https/cdn.example.com/pkg.zip`
  `cd cli && pnpm build && node dist/index.mjs convert 'https://cdn.example.com/pkg.zip' --to-avfs`
- [ ] **V2.2.6** `avfs convert \\\\192.168.1.60\\share\\docs\\report.xlsx --to-avfs` → `avfs://smb/...`
  `cd cli && pnpm build && node dist/index.mjs convert '\\\\192.168.1.60\\share\\docs\\report.xlsx' --to-avfs`
- [ ] **V2.2.7** Git converter 单元测试全部通过（HTTPS + SSH + 去 .git 后缀）
  `cd cli && npx vitest run test/parser/git-converter.test.ts --reporter=verbose`

---

### 任务 2.3: convert --to-native 全协议实现

#### 核心逻辑

1. 实现所有 5 个 converter 的 `toNative()` 方法：
   - `file-converter.toNative()` → 返回文件路径字符串
   - `http-converter.toNative()` → 返回 HTTP URL 字符串
   - `https-converter.toNative()` → 返回 HTTPS URL 字符串
   - `smb-converter.toNative()` → 返回 UNC 路径字符串
   - `git-converter.toNative()` → 调用 Platform.buildCloneUrl() → 返回 JSON `{ cloneUrl, version, filePath }`
2. 补全 `convert.command.ts`：
   - 实现 `--to-native` 方向：
     - 调用 `parseAvfsUri()` → `getConverter()` → `converter.toNative()`
     - git 协议输出 JSON.stringify(result)
     - 其他协议直接输出文本
   - `--to-avfs` 和 `--to-native` 同时指定时 → 输出错误并 exit(1)
3. 扩展 `cli/test/parser/protocol-converters.test.ts`：
   - 新增 toNative 往返测试：`native → toAvfs → toNative` 验证一致性
   - git 协议验证 JSON 输出格式 `{ cloneUrl, version, filePath }`

#### 交付物

- 更新 5 个 converter 文件（补充 `toNative()` 实现）
- `cli/src/commands/convert.command.ts` — 修改（补全 --to-native + 互斥检查）
- `cli/test/parser/protocol-converters.test.ts` — 更新（新增 toNative 测试）

#### 验证步骤

- [ ] **V2.3.1** 编译通过
  `cd cli && npx tsc --noEmit`
- [ ] **V2.3.2** `avfs convert avfs://git/github.com/avfs-io/core@v1.0.0/path/file.ts --to-native` → JSON `{cloneUrl, version, filePath}`
  `cd cli && pnpm build && node dist/index.mjs convert 'avfs://git/github.com/avfs-io/core@v1.0.0/path/file.ts' --to-native | jq '{cloneUrl, version, filePath}'`
- [ ] **V2.3.3** `avfs convert avfs://file/home/user/config.json --to-native` → `/home/user/config.json`
  `cd cli && pnpm build && node dist/index.mjs convert 'avfs://file/home/user/config.json' --to-native`
- [ ] **V2.3.4** `avfs convert avfs://http/192.168.1.100:8080/api/data.csv --to-native` → `http://192.168.1.100:8080/api/data.csv`
  `cd cli && pnpm build && node dist/index.mjs convert 'avfs://http/192.168.1.100:8080/api/data.csv' --to-native`
- [ ] **V2.3.5** `avfs convert avfs://smb/192.168.1.60/share/report.xlsx --to-native` → UNC 路径
  `cd cli && pnpm build && node dist/index.mjs convert 'avfs://smb/192.168.1.60/share/report.xlsx' --to-native`
- [ ] **V2.3.6** `--to-avfs` 和 `--to-native` 同时指定 → 报错并 exit(1)
  `cd cli && pnpm build && node dist/index.mjs convert '/tmp/test' --to-avfs --to-native 2>&1; echo "exit=$?"`
- [ ] **V2.3.7** 往返测试通过：原生 → AVFS → 原生结果与输入一致
  `cd cli && npx vitest run test/parser/protocol-converters.test.ts --reporter=verbose`

---

## Phase 3: Git 驱动与文件获取

### 目标

实现 GitHub REST API Driver 并通过 `avfs fetch` 命令打通从 AVFS URI 到文件内容输出的完整链路。

---

### 任务 3.1: GitHub API Driver 实现

#### 核心逻辑

1. 修改 `cli/src/drivers/git.driver.ts`：
   - `connect(resourceBase, options?)` — 提取 `github.com/{owner}/{repo}` 格式的 resourceBase，记录 version（从 options.credentials['version'] 提取）
   - `stat(filePath)` — 发送 `GET /repos/{owner}/{repo}/contents/{path}?ref={version}`（Header: `Accept: application/vnd.github.v3+json`），返回 `FileMetadata { size, mimeType, modifiedAt, protocol: 'git' }`
   - `read(filePath)` — 发送 `GET /repos/{owner}/{repo}/contents/{path}?ref={version}`（Header: `Accept: application/vnd.github.v3.raw`），返回 `ReadableStream<Uint8Array>`
   - `close()` — 重置内部状态（resourceBase、version）
   - 错误处理：
     - HTTP 404 → `"File not found: {path} in {owner}/{repo}"`
     - HTTP 403 → `"GitHub API rate limit exceeded. Try again later."`
     - 网络超时（30s）→ `"Network error: unable to reach api.github.com"`
     - 非 git resourceBase → 参数校验失败错误
2. 使用 Node.js 内置 `fetch()`（≥18，项目要求 ≥20），零新增运行时依赖
3. 新增 `cli/test/drivers/git.driver.test.ts`：
   - Mock `fetch()` 响应（使用 vitest mock）
   - 验证 connect → stat → read → close 流程
   - 验证 404/403/网络错误场景

#### 交付物

- `cli/src/drivers/git.driver.ts` — 修改（stub → GitHub API Driver）
- `cli/test/drivers/git.driver.test.ts` — Git Driver 单元测试

#### 验证步骤

- [ ] **V3.1.1** 编译通过
  `cd cli && npx tsc --noEmit`
- [ ] **V3.1.2** `connect("github.com/avfs-io/core")` → 正确解析 owner/repo，无异常
  `cd cli && npx vitest run test/drivers/git.driver.test.ts --reporter=verbose`
- [ ] **V3.1.3** `stat("README.md")` → 返回 FileMetadata（含 size、mimeType、protocol）
  `cd cli && npx vitest run test/drivers/git.driver.test.ts` → stat 用例通过
- [ ] **V3.1.4** `read("README.md")` → 返回 ReadableStream，内容与 mock 一致
  `cd cli && npx vitest run test/drivers/git.driver.test.ts` → read 用例通过
- [ ] **V3.1.5** API 返回 404 → 错误信息含 "File not found" + 路径
  `cd cli && npx vitest run test/drivers/git.driver.test.ts` → 404 错误用例通过
- [ ] **V3.1.6** API 返回 403 → 错误信息含 "rate limit exceeded"
  `cd cli && npx vitest run test/drivers/git.driver.test.ts` → 403 错误用例通过

---

### 任务 3.2: fetch 命令激活

#### 核心逻辑

1. 修改 `cli/src/commands/fetch.command.ts`：
   - 新增 `-o, --output <file>` 选项
   - 流程：`parseAvfsUri(address)` → 检查 `protocol === 'git'`（非 git 报错 exit 1）→ `gitDriver.connect(resourceBase)` → `gitDriver.read(filePath)` → stream 输出到 stdout（默认）或写入文件（-o 指定）
   - 使用 `pipeline()` 或手动 stream 管道 → `process.stdout` 或 `fs.createWriteStream()`
2. 新增 `cli/test/commands/fetch.test.ts`：
   - Mock `fetch()` 返回示例文件内容
   - 验证 `avfs fetch <git-uri>` → stdout 输出正确内容
   - 验证 `avfs fetch <git-uri> -o /tmp/out` → 文件写入成功
   - 验证 `avfs fetch <non-git-uri>` → 报错 exit 1

#### 交付物

- `cli/src/commands/fetch.command.ts` — 修改（Mock → 真实实现）
- `cli/test/commands/fetch.test.ts` — fetch 命令测试

#### 验证步骤

- [ ] **V3.2.1** 编译通过
  `cd cli && npx tsc --noEmit`
- [ ] **V3.2.2** `avfs fetch avfs://git/github.com/{public-repo}@main/{file}` → stdout 输出文件内容
  `cd cli && pnpm build && node dist/index.mjs fetch 'avfs://git/github.com/avfs-io/core@main/README.md'`
- [ ] **V3.2.3** `avfs fetch avfs://git/... -o /tmp/test-out` → 文件写入成功，内容一致
  `cd cli && pnpm build && node dist/index.mjs fetch 'avfs://git/github.com/avfs-io/core@main/README.md' -o /tmp/test-out && diff /tmp/test-out <expected>`
- [ ] **V3.2.4** `avfs fetch avfs://file/home/user/config.json` → 报错 "not yet implemented" + exit 1
  `cd cli && pnpm build && node dist/index.mjs fetch 'avfs://file/home/user/config.json' 2>&1; echo "exit=$?"`
- [ ] **V3.2.5** 不存在的文件 → 友好错误提示（404 → "File not found"）
  `cd cli && pnpm build && node dist/index.mjs fetch 'avfs://git/github.com/avfs-io/core@main/nonexistent.xyz' 2>&1`
- [ ] **V3.2.6** fetch 命令单元测试全部通过（正常路径、-o 输出、非 git 报错）
  `cd cli && npx vitest run test/commands/fetch.test.ts --reporter=verbose`

---

### 任务 3.3: 单元测试 + 覆盖率配置 + CI 验证

#### 部署要求

| 属性 | 值 |
|------|-----|
| 新增 dev 依赖 | `@vitest/coverage-v8` |
| 安装命令 | `pnpm add -D @vitest/coverage-v8` |
| 新增 NPM Script | `"test:coverage": "vitest run --coverage"` |

#### 核心逻辑

1. 创建 `cli/vitest.config.ts`：
   - `provider: 'v8'`
   - `include: ['src/parser/**', 'src/drivers/git.driver.ts']`
   - `thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 }`
2. 安装 `@vitest/coverage-v8`
3. 添加 `"test:coverage": "vitest run --coverage"` 到 `cli/package.json` 的 scripts
4. 运行全量测试并确认覆盖率达标
5. 验证 `pnpm test:coverage` 在 CI 中通过

#### 交付物

- `cli/vitest.config.ts` — Vitest + coverage 配置
- `cli/package.json` — 更新（新增 test:coverage script + @vitest/coverage-v8 依赖）
- 覆盖率报告 ≥ 阈值（Lines ≥90%, Branches ≥85%, Functions ≥90%, Statements ≥90%）

#### 验证步骤

- [ ] **V3.3.1** `@vitest/coverage-v8` 安装成功
  `cd cli && pnpm ls @vitest/coverage-v8` → 输出版本号
- [ ] **V3.3.2** `pnpm test` 全量测试通过（包括 FT-001 已有测试）
  `cd cli && pnpm test`
- [ ] **V3.3.3** `pnpm test:coverage` 覆盖率 Lines ≥ 90%
  `cd cli && pnpm test:coverage 2>&1 | grep -A5 "Lines"`
- [ ] **V3.3.4** `pnpm test:coverage` 覆盖率 Branches ≥ 85%
  `cd cli && pnpm test:coverage 2>&1 | grep -A5 "Branches"`
- [ ] **V3.3.5** `pnpm test:coverage` 覆盖率 Functions ≥ 90%
  `cd cli && pnpm test:coverage 2>&1 | grep -A5 "Functions"`
- [ ] **V3.3.6** `pnpm test:coverage` 覆盖率 Statements ≥ 90%
  `cd cli && pnpm test:coverage 2>&1 | grep -A5 "Statements"`
- [ ] **V3.3.7** TypeScript strict 编译零错误
  `cd cli && npx tsc --noEmit`
- [ ] **V3.3.8** 零新增运行时依赖（仅新增 devDependencies）
  `cd cli && pnpm ls --prod | grep -c .` → 与 FT-001 一致

---

## 实施顺序建议

### 推荐实施路径

1. **Phase 1 → Phase 2 → Phase 3**（严格顺序，不可并行）
2. 每个 Phase 内按任务编号顺序执行

### 关键依赖链

```
1.1 (types + fixtures)
 └─ 1.2 (uri-parser + validate 命令)
      └─ 1.3 (converters + stat 命令)
           └─ 2.1 (git platform detection)
                └─ 2.2 (git converter + convert --to-avfs)
                     └─ 2.3 (toNative + convert --to-native)
                          ├─ 3.1 (GitHub API Driver)
                          │    └─ 3.2 (fetch 命令)
                          └─ 3.3 (coverage + CI)
```

```
1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3
                                              ↘ (3.3 可与 3.2 部分并行)
```

---

## 风险与挑战

| 风险 | 影响 | 应对措施 |
| ------ | ------ | ---------- |
| GitHub API 匿名访问 rate limit（60 次/小时），频繁测试 fetch 可能触发 403 | 中 | 单元测试全部 mock fetch()，集成测试用缓存；文档明确告知限制 |
| SMB UNC 路径转义问题：`\\\\` 在 Shell 中易被转义 | 低 | 文档建议单引号包裹；convert 命令同时接受 Unix 风格 `//host/share/...` |
| 裸引用 `github.com/org/repo` 无法判别 git vs http | 低 | convert 命令中 github.com 裸引用归为 git 协议；后续 `--protocol` 参数解决 |
| 覆盖率达标需要足够的边界用例，测试文件数量多 | 中 | 优先级从 JSON fixtures 加载，减少手写测试用例工作量 |
| 已有 FT-001 测试依赖预构建 `dist/index.mjs`，新命令实现后需更新 | 低 | 任务 3.3 统一更新 FT-001 已有测试断言 |

---

## 变更模块总览

| 变更模块 | 涉及 Phase | 核心变更 |
| ---------- | :--------: | ---------- |
| `cli/src/parser/` | 1, 2 | **新增**：types.ts, uri-parser.ts, validator.ts, index.ts, protocol-converters/ (6 文件), git/ (3 文件) |
| `cli/src/drivers/git.driver.ts` | 3 | **修改**：stub → GitHub REST API Driver（connect/read/stat/close） |
| `cli/src/commands/validate.command.ts` | 1 | **修改**：Mock → 调用 parseAvfsUri/validateAvfsUri + JSON 输出 |
| `cli/src/commands/stat.command.ts` | 1 | **修改**：Mock → 调用 parseAvfsUri + JSON 输出 |
| `cli/src/commands/convert.command.ts` | 2 | **修改**：Mock → 新增 --to-avfs / --to-native 选项 + 双向转换 |
| `cli/src/commands/fetch.command.ts` | 3 | **修改**：Mock → 新增 -o 选项 + GitHub API fetch |
| `cli/test/` | 1, 2, 3 | **新增**：fixtures/ (5 文件) + parser/*.test.ts + drivers/git.driver.test.ts + commands/fetch.test.ts |
| `cli/vitest.config.ts` | 3 | **新增**：coverage v8 provider + 覆盖率阈值配置 |
| `cli/package.json` | 3 | **修改**：新增 `test:coverage` script + `@vitest/coverage-v8` devDependency |
