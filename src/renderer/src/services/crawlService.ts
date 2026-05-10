export interface CrawlResult {
  success: boolean
  html?: string
  css?: string
  title?: string
  error?: string
}

export interface CrawlOptions {
  includeImages?: boolean
  includeFonts?: boolean
}

export function extractStyles(html: string): string {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
  const inlineStyles: string[] = []
  let match

  while ((match = styleRegex.exec(html)) !== null) {
    inlineStyles.push(match[1])
  }

  return inlineStyles.join('\n')
}

export function extractInlineStyles(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const elements = doc.querySelectorAll('[style]')
  const styles: string[] = []

  elements.forEach((el) => {
    const style = el.getAttribute('style')
    if (style) {
      styles.push(style)
    }
  })

  return styles.join('\n')
}

export function cleanHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const scripts = doc.querySelectorAll('script, noscript, iframe, object, embed')
  scripts.forEach(el => el.remove())

  const tagsToRemove = ['nav', 'header', 'footer', 'aside']
  tagsToRemove.forEach(tag => {
    const elements = doc.querySelectorAll(tag)
    elements.forEach(el => el.remove())
  })

  return doc.body.innerHTML
}

export function resolveRelativeUrls(html: string, baseUrl: string): string {
  try {
    const url = new URL(baseUrl)
    const base = `${url.protocol}//${url.host}`

    return html
      .replace(/src="\//g, `src="${base}/`)
      .replace(/href="\//g, `href="${base}/`)
      .replace(/url\(\//g, `url(${base}/`)
  } catch {
    return html
  }
}

export async function crawlPage(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error: ${response.status} ${response.statusText}`,
      }
    }

    let html = await response.text()

    html = resolveRelativeUrls(html, url)

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    const css = extractStyles(html)

    html = cleanHtml(html)

    return {
      success: true,
      html,
      css,
      title,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function generatePreview(html: string, maxLength: number = 200): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const text = doc.body.textContent || ''
  const cleanText = text.replace(/\s+/g, ' ').trim()

  if (cleanText.length <= maxLength) {
    return cleanText
  }

  return cleanText.slice(0, maxLength) + '...'
}
