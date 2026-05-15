interface Px2viewportOptions {
  viewportWidth?: number | ((file: string) => number | undefined)
  unitToConvert?: string
  unitPrecision?: number
  viewportUnit?: string
  minPixelValue?: number
  include?: (string | RegExp)[]
  exclude?: (string | RegExp)[]
}

export function px2viewport(options?: Px2viewportOptions): any[]
