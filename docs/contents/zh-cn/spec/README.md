# 规范

AVFS 协议规范官方中文文档。

## 内容

本目录包含 AVFS 协议标准的权威定义：

| 文档 | 说明 | 状态 |
|------|------|------|
| [**avfs-v1-standard.md**](./avfs-v1-standard.md) | AVFS v1.0 协议完整规范（架构、语法、语义、CLI、示例） | 草案 |
| [**address-syntax.md**](./address-syntax.md) | 详细地址格式语法、ABNF、字段定义、解析与规范化 | 草案 |
| [**driver-interface.md**](./driver-interface.md) | 官方驱动插件接口契约、类型定义、错误类型、注册 API | 草案 |
| [**plugin-lifecycle.md**](./plugin-lifecycle.md) | 插件状态机、注册/路由/处理/管理阶段、事件系统、安全 | 草案 |
| [**conversion-rules.md**](./conversion-rules.md) | file/HTTP/SMB/Git/自定义协议的双向地址转换规则与完整示例 | 草案 |

## 快速开始

1. **阅读主规范**：[`avfs-v1-standard.md`](./avfs-v1-standard.md) 获取完整的 v1.0 协议定义
2. **深入语法**：[`address-syntax.md`](./address-syntax.md) 了解语法细节和边界情况
3. **实现驱动**：[`driver-interface.md`](./driver-interface.md) 查看你必须实现的接口契约
4. **了解生命周期**：[`plugin-lifecycle.md`](./plugin-lifecycle.md) 了解插件在运行时如何被管理
5. **处理转换**：[`conversion-rules.md`](./conversion-rules.md) 学习原生↔AVFS 映射算法

## 用途

规范作为以下内容的唯一权威来源：

- 协议语法和语义规则
- 驱动插件接口契约
- 地址转换算法
- 扩展开发指南

所有驱动实现和 SDK 绑定均须符合此处定义的规范。

## 相关链接

- [Core](../../../../core/README.md) — 本规范的参考实现
- [Plugin SDK](../../../../plugin-sdk/README.md) — 按本规范实现自定义驱动的 SDK
- **AVFS 官方网站**: https://avfs.io
- **GitHub**: https://github.com/avfs-io
- **许可证**: Apache License 2.0 ([`LICENSE`](../../../../LICENSE))

## 其他语言

- [English (en-us)](../en-us/spec/README.md)
