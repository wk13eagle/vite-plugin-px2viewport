# @lazy-koala/vite-plugin-px2viewport

Vite 插件，将 px 单位转换为 vw，实现移动端视口适配。

- CSS PostCSS 转换（`<style>`、`.css` 文件）
- Vue SFC 内联样式编译时转换（`style="..."`、`:style="{...}"`）
- 响应式样式运行时转换（`usePxToVw`）

## 安装

```bash
npm i -D @lazy-koala/vite-plugin-px2viewport
```

## 使用

```ts
import { px2viewport } from '@lazy-koala/vite-plugin-px2viewport'

export default defineConfig({
  plugins: [px2viewport()]
})
```

### 选项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `viewportWidth` | `number \| ((file: string) => number \| undefined)` | `750` | 设计稿宽度 |
| `unitToConvert` | `string` | `'px'` | 待转换单位 |
| `viewportUnit` | `string` | `'vw'` | 目标单位 |
| `unitPrecision` | `number` | `5` | vw 值小数位数 |
| `minPixelValue` | `number` | `1` | 小于该值的 px 不转换 |
| `include` | `FilterPattern` | `/\.vue/, /\.[jt]sx?$/, /\.m[jt]sx?$/` | 匹配转换的文件 |
| `exclude` | `FilterPattern` | `-` | 排除的文件，例：`/node_modules\/(?!(?:.*\/)?vant\/)/` 表示排除 node_modules 保留 Vant |

### 排除所有 node_modules，保留 Vant

```ts
px2viewport({
  exclude: /node_modules\/(?!(?:.*\/)?vant\/)/,
  viewportWidth: (file) => {
    if (file.includes('node_modules/vant')) return 375
    return 750
  }
})
```

## 运行时转换

对于 `ref({ width: '200px' })` 这种响应式绑定，编译时无法转换，需要运行时 composable：

```vue
<script setup lang="ts">
import { usePxToVw } from '@lazy-koala/vite-plugin-px2viewport/runtime'

const boxStyle = usePxToVw({ width: '200px', height: '200px', background: '#f0f' })
</script>

<template>
  <div :style="boxStyle">200x200px 自动转 vw</div>
</template>
```

会自动读取 `window.__px2viewport`（由插件在 `transformIndexHtml` 注入），无需额外配置。


