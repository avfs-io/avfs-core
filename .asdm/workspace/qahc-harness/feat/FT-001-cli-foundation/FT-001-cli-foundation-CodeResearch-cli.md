# FT-001 CodeResearch: cli + .github/workflows

> 调研日期：2026-05-24

## 代码库概述

FT-001 是 AVFS 项目的首个开发特性，变更范围为 `cli/` 和 `.github/workflows/`。

## 现有实现分析

### cli/

- **仅含 `README.md`**（5.63 KB）：详细规划了 CLI 工具的技术栈、命令结构、配置文件和目录布局
- **零代码**：不存在任何 `.ts`、`.js`、`.json`、`.yaml`、`.yml` 文件
- README 中规划的子目录（`src/`、`test/`、`scripts/`）和文件（`package.json`、`tsconfig.json`）均未创建

### .github/workflows/

- **目录不存在**：无任何 GitHub Actions 工作流文件
- 需从零创建 `avfs-cli-ci.yml` 和 `avfs-cli-publish.yml`

## 关键发现和缺失项

| 维度 | 发现 |
|------|------|
| 包配置 | 无 `package.json`，需从零创建 |
| TypeScript 配置 | 无 `tsconfig.json`，需从零创建 |
| 构建配置 | 无 `tsup.config.ts`，需从零创建 |
| 测试框架 | 无测试配置，需添加 vitest |
| CI/CD | `.github/` 不存在，需从零创建 |
| Lint 配置 | 无 ESLint/Prettier 配置（FT-001 暂不包含） |

## 待确认问题

无。纯绿地项目，所有配置和代码从零开始。

## 结论

全部变更模块均为新建，无存量代码兼容性问题。可直接进入详细设计阶段。
