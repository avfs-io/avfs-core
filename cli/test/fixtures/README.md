# AVFS Test Fixtures

标准化测试数据框架，按领域分目录组织 JSON fixtures，统一 `{ meta, testCases[] }` 结构。

## 目录结构

```
cli/test/fixtures/
├── README.md                    # 本文件 — fixture 使用规范与 JSON schema 说明
├── addressing/
│   ├── valid-uris.json          # 5 协议合法 AVFS URI 测试用例
│   └── invalid-uris.json        # 非法 AVFS URI（含期望错误类型）
├── git-conversion.json          # Git 原生 URL ↔ AVFS 双向转换对
└── platform-detection.json      # Git 平台检测用例（GitHub / unknown）
```

## JSON Schema

所有 fixture JSON 文件遵循统一结构：

```typescript
{
  "meta": {
    "description": string;        // 数据集用途描述
    "version": string;            // 数据格式版本
    "protocols"?: string[];       // 涉及协议（可选）
    "source"?: string;            // 数据来源（可选）
  };
  "testCases": TestCase[];        // 测试用例数组
}

// 通用 TestCase 基类
interface TestCase {
  "id": string;                   // 唯一标识符
  "description": string;          // 用例描述
  "input": string;                // 输入值
  "expected": object;             // 期望结果（结构取决于数据集）
  "tags"?: string[];              // 分类标签（可选）
}
```

## 各数据集 expected 结构

### addressing/valid-uris.json

```typescript
expected: {
  "protocol": string;             // 协议类型
  "resourceBase": string;         // 资源基址
  "version"?: string | null;      // 版本（git 协议）
  "filePath": string;             // 文件路径
  "anchor"?: string | null;       // 锚点片段
  "isValid": true
}
```

### addressing/invalid-uris.json

```typescript
expected: {
  "isValid": false;
  "hasError": string;             // 应包含的错误关键词
}
```

### git-conversion.json

```typescript
expected: {
  "native": string;               // 原生 Git URL（HTTPS clone 或 SSH）
  "avfs": string;                 // 对应 AVFS URI
  "resourceBase": string;         // 资源基址
}
```

### platform-detection.json

```typescript
expected: {
  "platform": "github" | "unknown";
  "resourceBase"?: string;        // 仅在 platform !== "unknown" 时
}
```

## 使用方式

### TypeScript 测试中加载

```typescript
import validUris from '../fixtures/addressing/valid-uris.json' assert { type: 'json' };

for (const tc of validUris.testCases) {
  test(`[${tc.id}] ${tc.description}`, () => {
    const result = parseAvfsUri(tc.input);
    expect(result.isValid).toBe(tc.expected.isValid);
  });
}
```

## 维护约定

- **增量追加**：后续特性新增用例时追加到现有 JSON 文件，保持向后兼容
- **语义化 ID**：使用 `{protocol}-{序号}` 格式（如 `git-01`、`file-02`）
- **禁止修改已有用例的 expected**：除非协议规范变更，确保回归测试稳定
