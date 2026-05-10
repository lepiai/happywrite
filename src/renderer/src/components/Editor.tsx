import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { createEditor, createToolbar, IDomEditor, IEditorConfig, IToolbarConfig, SlateTransforms } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'

interface EditorProps {
  defaultHtml: string
  title: string
  onTitleChange: (title: string) => void
  onChange: (value: string) => void
  onSelect: (text: string) => void
  disabled?: boolean
}

export interface EditorHandle {
  setHtml: (html: string) => void
  setHtmlRaw: (html: string) => void
  getEditor: () => IDomEditor | null
  insertHtmlBeforeSelection: (html: string) => void
  insertHtmlAtStart: (html: string) => void
}

const LEAF_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'img'])
const WRAPPER_TAGS = new Set(['section', 'div', 'article', 'main', 'header', 'footer', 'aside'])

interface StyleEntry {
  index: number
  style: string
}

function mergeCss(a: string, b: string): string {
  if (!a) return b
  if (!b) return a
  const map = new Map<string, string>()
  for (const part of a.split(';')) {
    const i = part.indexOf(':')
    if (i > 0) {
      const k = part.substring(0, i).trim().toLowerCase()
      const v = part.substring(i + 1).trim()
      if (k && v) map.set(k, v)
    }
  }
  for (const part of b.split(';')) {
    const i = part.indexOf(':')
    if (i > 0) {
      const k = part.substring(0, i).trim().toLowerCase()
      const v = part.substring(i + 1).trim()
      if (k && v) map.set(k, v)
    }
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}: ${v}`).join('; ')
}

function collectLeafStyles(html: string): StyleEntry[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const styles: StyleEntry[] = []
    let index = 0

    function walk(element: Element, inherited: string) {
      const tag = element.tagName.toLowerCase()
      const ownStyle = element.getAttribute('style') || ''
      const merged = mergeCss(inherited, ownStyle)

      if (LEAF_TAGS.has(tag)) {
        styles.push({ index: index++, style: merged })
        return
      }

      if (WRAPPER_TAGS.has(tag) || element.parentElement === doc.body) {
        for (const child of Array.from(element.children)) {
          walk(child, merged)
        }
        return
      }

      for (const child of Array.from(element.children)) {
        walk(child, inherited)
      }
    }

    for (const child of Array.from(doc.body.children)) {
      walk(child, '')
    }

    return styles
  } catch {
    return []
  }
}

function applyStylesToDom(container: HTMLElement, styles: StyleEntry[]) {
  const slateEl = container.querySelector('[data-slate-editor]')
  if (!slateEl) return

  const domElements = Array.from(slateEl.children).filter(
    el => el.getAttribute('data-slate-node') === 'element'
  )
  domElements.forEach((el, idx) => {
    const htmlEl = el as HTMLElement
    if (idx < styles.length && styles[idx].style) {
      htmlEl.setAttribute('style', styles[idx].style)
    }
  })
}

function injectStylesToHtml(html: string, styles: StyleEntry[]): string {
  if (!styles.length) return html

  let styleIdx = 0
  let result = ''
  let i = 0

  while (i < html.length) {
    if (html[i] === '<') {
      const tagEnd = html.indexOf('>', i)
      if (tagEnd === -1) { result += html.slice(i); break }

      const tagContent = html.slice(i, tagEnd + 1)
      const tagMatch = tagContent.match(/^<(\w+)/)

      if (tagMatch) {
        const tag = tagMatch[1].toLowerCase()
        if (LEAF_TAGS.has(tag)) {
          if (styleIdx < styles.length && styles[styleIdx].style) {
            const style = styles[styleIdx].style
            if (tagContent.includes('style=')) {
              result += tagContent.replace(/style\s*=\s*"([^"]*)"/, (_m, oldStyle: string) => {
                return 'style="' + mergeCss(oldStyle, style) + '"'
              })
            } else {
              result += tagContent.slice(0, -1) + ' style="' + style + '">'
            }
          } else {
            result += tagContent
          }
          styleIdx++
        } else {
          result += tagContent
        }
      } else {
        result += tagContent
      }

      i = tagEnd + 1
    } else {
      result += html[i]
      i++
    }
  }

  return result
}

export const EditorComponent = forwardRef<EditorHandle, EditorProps>(function EditorComponent({ defaultHtml, title, onTitleChange, onChange, onSelect, disabled }, ref) {
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const toolbarContainerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<IDomEditor | null>(null)
  const suppressOnChangeRef = useRef(false)
  const styleCacheRef = useRef<StyleEntry[]>([])
  const hasStylesRef = useRef(false)
  const isApplyingRef = useRef(false)
  const applyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const toolbarConfig: Partial<IToolbarConfig> = {
    toolbarKeys: [
      'bold', 'italic', 'underline', 'through',
      '|',
      'headerSelect',
      '|',
      'bulletedList', 'numberedList', 'todo',
      '|',
      'blockquote', 'codeBlock',
      '|',
      'insertLink', 'insertImage',
      '|',
      'undo', 'redo',
      '|',
      'fullScreen',
    ],
  }

  function stopInjection() {
    if (applyTimerRef.current) {
      clearInterval(applyTimerRef.current)
      applyTimerRef.current = null
    }
    isApplyingRef.current = false
  }

  function startInjection(containerEl: HTMLElement, styles: StyleEntry[], onDone?: () => void) {
    stopInjection()

    isApplyingRef.current = true
    let attempt = 0
    const maxAttempts = 30

    applyTimerRef.current = setInterval(() => {
      attempt++
      applyStylesToDom(containerEl, styles)

      if (attempt >= maxAttempts) {
        stopInjection()
        if (onDone) onDone()
      }
    }, 100)
  }

  function initEditor(html: string) {
    const editorEl = editorContainerRef.current
    const toolbarEl = toolbarContainerRef.current
    if (!editorEl || !toolbarEl) return

    if (editorRef.current && !editorRef.current.isDestroyed) {
      editorRef.current.destroy()
      editorRef.current = null
    }

    editorEl.innerHTML = ''
    toolbarEl.innerHTML = ''

    const hasStyles = html && /style\s*=/i.test(html)
    const styles = hasStyles ? collectLeafStyles(html) : []

    if (hasStyles) {
      styleCacheRef.current = styles
      hasStylesRef.current = styles.length > 0 && styles.some(s => s.style)
      suppressOnChangeRef.current = true
    } else {
      styleCacheRef.current = []
      hasStylesRef.current = false
    }

    const editorConfig: Partial<IEditorConfig> = {
      placeholder: '开始写作...',
      autoFocus: true,
      MENU_CONF: {
        uploadImage: {
          customUpload(file: File, insertFn: (url: string, alt?: string, href?: string) => void) {
            const reader = new FileReader()
            reader.onload = (e) => {
              const base64 = e.target?.result as string
              insertFn(base64, file.name, '')
            }
            reader.readAsDataURL(file)
          },
          allowedFileTypes: ['image/*'],
          maxFileSize: 10 * 1024 * 1024,
        },
      },
      onChange(ed) {
        if (ed.isDestroyed) return
        if (suppressOnChangeRef.current) return
        if (isApplyingRef.current) return

        let outHtml = ed.getHtml()

        if (hasStylesRef.current && styleCacheRef.current.length > 0) {
          outHtml = injectStylesToHtml(outHtml, styleCacheRef.current)
        }

        onChangeRef.current(outHtml)
      },
    }

    const editor = createEditor({
      selector: editorEl,
      config: editorConfig,
      html: html || '<p><br></p>',
      mode: 'default',
    })

    createToolbar({
      editor,
      selector: toolbarEl,
      config: toolbarConfig,
      mode: 'default',
    })

    editorRef.current = editor

    editor.on('selectionChange', () => {
      if (editor.isDestroyed) return
      const text = editor.getSelectionText?.() || window.getSelection()?.toString() || ''
      onSelectRef.current(text)
    })

    if (hasStyles && styles.length > 0) {
      startInjection(editorEl, styles, () => {
        suppressOnChangeRef.current = false
      })
    } else {
      suppressOnChangeRef.current = false
    }
  }

  useImperativeHandle(ref, () => ({
    setHtml(html: string) {
      stopInjection()
      suppressOnChangeRef.current = false
      styleCacheRef.current = []
      hasStylesRef.current = false
      initEditor(html)
    },
    setHtmlRaw(html: string) {
      stopInjection()
      initEditor(html)
    },
    getEditor() {
      return editorRef.current
    },
    insertHtmlBeforeSelection(html: string) {
      const ed = editorRef.current
      if (!ed || ed.isDestroyed) return
      const selection = ed.selection
      if (!selection) return
      SlateTransforms.collapse(ed, { edge: 'start' })
      ed.dangerouslyInsertHtml(html)
    },
    insertHtmlAtStart(html: string) {
      const ed = editorRef.current
      if (!ed || ed.isDestroyed) return
      const start = { path: [0], offset: 0 }
      ed.select(start)
      ed.dangerouslyInsertHtml(html)
    },
  }), [])

  useEffect(() => {
    initEditor(defaultHtml)

    return () => {
      stopInjection()
      if (editorRef.current && !editorRef.current.isDestroyed) {
        editorRef.current.destroy()
      }
      editorRef.current = null
      styleCacheRef.current = []
      hasStylesRef.current = false
    }
  }, [])

  useEffect(() => {
    const containerEl = editorContainerRef.current
    if (!containerEl) return

    const observer = new MutationObserver(() => {
      if (isApplyingRef.current) return
      if (suppressOnChangeRef.current) return
      if (styleCacheRef.current.length === 0) return

      isApplyingRef.current = true
      requestAnimationFrame(() => {
        applyStylesToDom(containerEl, styleCacheRef.current)
        isApplyingRef.current = false
      })
    })

    observer.observe(containerEl, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={toolbarContainerRef}
        style={{
          borderBottom: '1px solid #e8e8e8',
          backgroundColor: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 900,
            backgroundColor: '#fff',
            padding: '40px 60px',
            minHeight: 'calc(100vh - 120px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            borderRadius: '2px',
          }}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="输入文章标题..."
            style={{
              width: '100%',
              fontSize: 28,
              fontWeight: 700,
              border: 'none',
              outline: 'none',
              color: '#1a1a1a',
              marginBottom: 20,
              padding: 0,
              lineHeight: 1.4,
            }}
          />
          <div
            ref={editorContainerRef}
            style={{ minHeight: 400 }}
          />
        </div>
      </div>
    </div>
  )
})
