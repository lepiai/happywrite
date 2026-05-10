export interface ExportOptions {
  format: 'png' | 'jpeg' | 'pdf'
  quality?: number
  pageWidth?: number
  pageHeight?: number
}

export interface ExportResult {
  success: boolean
  data?: Blob
  error?: string
}

export function paginateHtml(html: string, maxHeight: number = 800): string[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body
  const pages: string[] = []
  let currentPage = doc.createElement('div')
  currentPage.setAttribute('style', `width: ${800}px; min-height: ${maxHeight}px; background: white; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`)

  const children = Array.from(body.children)
  let currentHeight = 0

  for (const child of children) {
    const clone = child.cloneNode(true) as HTMLElement
    currentPage.appendChild(clone)
    const tempDiv = doc.createElement('div')
    tempDiv.style.cssText = 'position: absolute; visibility: hidden; width: 800px;'
    tempDiv.appendChild(currentPage.cloneNode(true))
    doc.body.appendChild(tempDiv)
    const height = tempDiv.offsetHeight || 0
    doc.body.removeChild(tempDiv)

    if (height > maxHeight && currentPage.children.length > 1) {
      pages.push(doc.body.innerHTML.replace(body.innerHTML, currentPage.innerHTML))
      currentPage = doc.createElement('div')
      currentPage.setAttribute('style', `width: ${800}px; min-height: ${maxHeight}px; background: white; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`)
      currentPage.appendChild(clone)
    } else {
      if (currentPage.children.length === 0) {
        currentPage.appendChild(clone)
      }
      currentHeight = height
    }
  }

  if (currentPage.children.length > 0) {
    const bodyClone = doc.body.cloneNode(false) as HTMLElement
    bodyClone.innerHTML = ''
    bodyClone.appendChild(currentPage)
    pages.push(bodyClone.innerHTML)
  }

  return pages.length > 0 ? pages : [html]
}

export function htmlToDataUrl(html: string, width: number = 800, height: number = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
      }
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load HTML'))
    }

    img.src = url
  })
}

export function dataUrlToBlob(dataUrl: string, format: 'png' | 'jpeg' = 'png'): Blob {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime || `image/${format}` })
}

export async function exportToImage(html: string, format: 'png' | 'jpeg' = 'png', quality: number = 0.92): Promise<Blob[]> {
  const pages = paginateHtml(html)
  const blobs: Blob[] = []

  for (const page of pages) {
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          </style>
        </head>
        <body>${page}</body>
      </html>
    `

    const dataUrl = await htmlToDataUrl(styledHtml)
    const canvas = document.createElement('canvas')
    const img = new Image()
    img.src = dataUrl

    await new Promise<void>((resolve) => {
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
        }
        resolve()
      }
    })

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), mimeType, quality)
    })
    blobs.push(blob)
  }

  return blobs
}

export async function exportToPdf(html: string): Promise<Blob> {
  const pages = paginateHtml(html)
  const container = document.createElement('div')
  container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 800px;'

  for (let i = 0; i < pages.length; i++) {
    const pageDiv = document.createElement('div')
    pageDiv.innerHTML = pages[i]
    pageDiv.style.cssText = 'width: 800px; min-height: 1122px; background: white; padding: 40px; margin-bottom: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; page-break-after: always;'
    container.appendChild(pageDiv)
  }

  document.body.appendChild(container)

  try {
    const canvas = document.createElement('canvas')
    const scale = 2
    const pageWidth = 800 * scale
    const pageHeight = 1122 * scale

    canvas.width = pageWidth
    canvas.height = pageHeight * pages.length

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let i = 0; i < pages.length; i++) {
      const pageDiv = container.children[i] as HTMLElement
      const html2canvas = (await import('html2canvas')).default
      const pageCanvas = await html2canvas(pageDiv, {
        scale,
        backgroundColor: 'white',
        width: 800,
        height: 1122,
        windowWidth: 800,
        windowHeight: 1122,
      })
      ctx.drawImage(pageCanvas, 0, i * pageHeight)
    }

    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        document.body.removeChild(container)
        resolve(blob!)
      }, 'image/png')
    })
  } catch (error) {
    document.body.removeChild(container)
    throw error
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportArticle(html: string, title: string, format: 'png' | 'jpeg' | 'pdf' = 'png'): Promise<void> {
  const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 50)

  if (format === 'pdf') {
    const blob = await exportToPdf(html)
    downloadBlob(blob, `${safeTitle}.png`)
  } else {
    const blobs = await exportToImage(html, format)
    if (blobs.length === 1) {
      downloadBlob(blobs[0], `${safeTitle}.${format}`)
    } else {
      for (let i = 0; i < blobs.length; i++) {
        downloadBlob(blobs[i], `${safeTitle}_page${i + 1}.${format}`)
      }
    }
  }
}
