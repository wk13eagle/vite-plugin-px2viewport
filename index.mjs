import { createFilter } from 'vite'
import { parse } from '@babel/parser'
import _traverseModule from '@babel/traverse'
import { MagicString } from 'magic-string-ast'

function resolveDefault(mod) {
  if (typeof mod === 'function') return mod
  if (mod && typeof mod.default !== 'undefined') return resolveDefault(mod.default)
  return mod
}

const traverse = resolveDefault(_traverseModule)

function pxToVw(str, viewportWidth, unitPrecision, unitToConvert, viewportUnit) {
  const precision = unitPrecision ?? 5
  const baseWidth = viewportWidth ?? 750
  const fromUnit = unitToConvert ?? 'px'
  const toUnit = viewportUnit ?? 'vw'
  const pxRE = new RegExp(`(-?\\d+(?:\\.\\d+)?)${fromUnit}`, 'g')
  return str.replace(pxRE, (_, pxValue) => {
    const vw = (Number(pxValue) / baseWidth * 100).toFixed(precision)
    return `${vw}${toUnit}`
  })
}

function resolveStyleObject(objNode, config, ms) {
  for (const prop of objNode.properties) {
    if (
      prop.type === 'ObjectProperty' &&
      prop.key.type === 'Identifier' &&
      prop.key.name === 'style' &&
      prop.value.type === 'ObjectExpression'
    ) {
      for (const styleProp of prop.value.properties) {
        if (
          styleProp.type === 'ObjectProperty' &&
          styleProp.value.type === 'StringLiteral' &&
          styleProp.value.value.includes(config.unitToConvert ?? 'px')
        ) {
          const newValue = pxToVw(
            styleProp.value.value,
            config.viewportWidth,
            config.unitPrecision,
            config.unitToConvert,
            config.viewportUnit
          )
          ms.overwrite(styleProp.value.start, styleProp.value.end, JSON.stringify(newValue))
        }
      }
    }
  }
}

function inlineTransform(code, config) {
  if (!code.includes('px') || (!code.includes('_hoisted_') && !code.includes('_createVNode') && !code.includes('_createElementVNode') && !code.includes('style'))) {
    return code
  }

  const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] })
  const ms = new MagicString(code)

  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path
      if (
        node.id?.type === 'Identifier' &&
        node.id.name.startsWith('_hoisted_') &&
        node.init?.type === 'ObjectExpression'
      ) {
        resolveStyleObject(node.init, config, ms)
      }
    }
  })

  traverse(ast, {
    CallExpression(path) {
      const { node } = path
      if (node.callee.type !== 'Identifier') return
      const fnName = node.callee.name
      const names = [
        '_createVNode', '_createElementVNode', '_createBlock', '_createElementBlock',
        'createVNode', 'createElementVNode', 'createBlock', 'createElementBlock'
      ]
      if (names.includes(fnName) && node.arguments[1]?.type === 'ObjectExpression') {
        resolveStyleObject(node.arguments[1], config, ms)
      }
    }
  })

  const result = ms.toString()
  return result
}

function createPostCSSPlugin(options) {
  const viewportWidth = options.viewportWidth ?? 750
  const unitPrecision = options.unitPrecision ?? 5
  const unitToConvert = options.unitToConvert ?? 'px'
  const viewportUnit = options.viewportUnit ?? 'vw'
  const minPixelValue = options.minPixelValue

  const pxRE = new RegExp(`(-?\\d+(?:\\.\\d+)?)${unitToConvert}`, 'g')

  const factory = function() {
    return {
      postcssPlugin: 'px-to-viewport',
      OnceExit(root, { result }) {
        const filePath = result?.opts?.from ?? ''
        let vw = 750
        if (typeof viewportWidth === 'function') {
          vw = viewportWidth(filePath) ?? 750
        } else if (typeof viewportWidth === 'number') {
          vw = viewportWidth
        }

        root.walkDecls(decl => {
          if (!decl.value || !decl.value.includes(unitToConvert)) return

          decl.value = decl.value.replace(pxRE, (_, pxValue) => {
            const num = Number(pxValue)
            if (minPixelValue != null && Math.abs(num) < minPixelValue) {
              return `${num}${unitToConvert}`
            }
            const vwValue = (num / vw * 100).toFixed(unitPrecision)
            return `${vwValue}${viewportUnit}`
          })
        })
      }
    }
  }

  factory.postcss = true
  factory.postcssPlugin = 'px-to-viewport'

  return factory
}

export function px2viewport(options = {}) {
  const commonConfig = {
    unitToConvert: options.unitToConvert ?? 'px',
    unitPrecision: options.unitPrecision ?? 5,
    viewportUnit: options.viewportUnit ?? 'vw',
    minPixelValue: options.minPixelValue,
    viewportWidth: options.viewportWidth ?? 750
  }

  const exclude = options.exclude
    ? Array.isArray(options.exclude) ? options.exclude : [options.exclude]
    : [/node_modules\/(?!(?:.*\/)?vant\/)/]

  const filter = createFilter(
    options.include ?? [/\.vue/, /\.[jt]sx?$/, /\.m[jt]sx?$/],
    [...exclude, /@lazy-koala\/vite-plugin-px2viewport/]
  )

  const postCSSPlugin = {
    name: 'px2viewport:postcss',
    enforce: 'pre',
    config(config) {
      const existing = config.css?.postcss?.plugins
      const plugin = createPostCSSPlugin(options)
      const userPlugins = Array.isArray(existing) ? existing : []
      return {
        css: {
          postcss: {
            plugins: [...userPlugins, plugin]
          }
        }
      }
    }
  }

  const mainPlugin = {
    name: 'px2viewport',
    enforce: 'post',

    transform(code, id) {
      if (!filter(id)) return
      if (id.endsWith('.css')) return

      let num = 750
      if (typeof options.viewportWidth === 'function') {
        num = options.viewportWidth(id) ?? 750
      } else if (typeof options.viewportWidth === 'number') {
        num = options.viewportWidth
      }
      const config = { ...commonConfig, viewportWidth: num }

      const transformed = inlineTransform(code, config)
      if (transformed !== code) {
        return { code: transformed, map: null }
      }
    },

    transformIndexHtml(_, ctx) {
      const filename = ctx?.filename ?? 'index.html'
      let vw = 750
      if (typeof options.viewportWidth === 'function') {
        vw = options.viewportWidth(filename) ?? 750
      } else if (typeof options.viewportWidth === 'number') {
        vw = options.viewportWidth
      }
      const runtimeConfig = {
        viewportWidth: vw,
        unitPrecision: commonConfig.unitPrecision
      }
      return [
        {
          tag: 'script',
          attrs: {},
          children: `window.__px2viewport=${JSON.stringify(runtimeConfig)};`,
          injectTo: 'head'
        }
      ]
    }
  }

  return [postCSSPlugin, mainPlugin]
}
