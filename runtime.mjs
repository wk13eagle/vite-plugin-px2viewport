import { ref } from 'vue'

function getConfig() {
  return window.__px2viewport ?? { viewportWidth: 750, unitPrecision: 5 }
}

const pxRE = /(-?\d+(?:\.\d+)?)px/g

function pxToVw(val, config) {
  const baseWidth = config.viewportWidth
  const precision = config.unitPrecision
  return val.replace(pxRE, (_, px) => (Number(px) / baseWidth * 100).toFixed(precision) + 'vw')
}

function convertStyle(style) {
  const config = getConfig()
  const result = {}
  for (const key of Object.keys(style)) {
    const val = style[key]
    result[key] = typeof val === 'string' && val.includes('px') ? pxToVw(val, config) : val
  }
  return result
}

export function usePxToVw(initial) {
  return ref(convertStyle(initial))
}
