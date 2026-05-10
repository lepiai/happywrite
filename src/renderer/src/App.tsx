import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from './store/useStore'
import { generateTitle, polishText, summarizeText, extractKeywords, formatText, FORMAT_STYLES, AIResponse } from './services/aiService'
import { SettingsModal } from './components/SettingsModal'
import { EditorComponent, EditorHandle } from './components/Editor'
import {
  Article,
  ArticleVersion,
  getAllArticles,
  saveArticle,
  deleteArticle as deleteArticleFromDB,
  saveVersion,
  getArticleVersions,
  restoreVersion,
} from './services/storageService'
import '@wangeditor/editor/dist/css/style.css'

interface Command {
  id: string
  name: string
  description: string
  icon: string
  shortcut?: string
}

const commands: Command[] = [
  { id: 'polish', name: '润色', description: '对选中文字进行润色优化', icon: '✨', shortcut: '/polish' },
  { id: 'summarize', name: '提炼要点', description: '提取段落核心要点', icon: '📝', shortcut: '/summarize' },
  { id: 'keywords', name: '提取关键词', description: '提取全文关键词', icon: '🔑', shortcut: '/keywords' },
  { id: 'format', name: '排版美化', description: '美化文章格式', icon: '🎨', shortcut: '/format' },
  { id: 'title', name: '生成标题', description: '生成3-5个备选标题', icon: '📌', shortcut: '/title' },
  { id: 'export', name: '导出图片', description: '将文章导出为图片', icon: '🖼️', shortcut: '/export' }
]

function App() {
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [commandFilter, setCommandFilter] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalContent, setModalContent] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [versions, setVersions] = useState<ArticleVersion[]>([])
  const [showFormatModal, setShowFormatModal] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const [lastSaveTime, setLastSaveTime] = useState('')
  const { count } = useStore()
  const editorRef = useRef<EditorHandle>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedTextRef = useRef(selectedText)
  useEffect(() => {
    selectedTextRef.current = selectedText
  }, [selectedText])

  useEffect(() => {
    getAllArticles().then(stored => {
      if (stored.length > 0) {
        setArticles(stored)
      } else {
        const defaultArticle: Article = {
          id: '1',
          title: '欢迎使用自媒体AI编辑器',
          content: '<h2>欢迎使用自媒体AI编辑器</h2><p>这是一款专为自媒体创作者设计的AI辅助编辑工具。</p><p>主要功能包括：</p><ul><li>AI标题生成</li><li>文字润色优化</li><li>关键词提取</li><li>图文转图片</li></ul>',
          category: '教程',
          tags: ['入门', '指南'],
          createdAt: '2026-05-06',
          updatedAt: '2026-05-06',
        }
        saveArticle(defaultArticle)
        setArticles([defaultArticle])
      }
    })
  }, [])

  const doSave = useCallback(async (article: Article) => {
    setSaveStatus('saving')
    const now = new Date()
    const updated = { ...article, updatedAt: now.toISOString().split('T')[0] }
    await saveArticle(updated)
    await saveVersion(updated)
    setSaveStatus('saved')
    setLastSaveTime(now.toLocaleTimeString('zh-CN'))
    setArticles(prev => prev.map(a => a.id === updated.id ? updated : a))
  }, [])

  const scheduleAutoSave = useCallback((article: Article) => {
    setSaveStatus('unsaved')
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      doSave(article)
    }, 3000)
  }, [doSave])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(commandFilter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(commandFilter.toLowerCase()) ||
    cmd.shortcut?.toLowerCase().includes(commandFilter.toLowerCase())
  )

  const handleAIResponse = (response: AIResponse, successMessage: string) => {
    if (response.success) {
      setModalContent(response.content)
      setModalTitle(successMessage)
      setShowResultModal(true)
    } else {
      alert(`操作失败: ${response.error || '未知错误'}`)
    }
    setIsLoading(false)
  }

  const handleCommandSelect = useCallback(async (command: Command) => {
    setShowCommandPalette(false)
    setCommandFilter('')

    if (!selectedArticle) return

    const editor = editorRef.current?.getEditor()
    const currentSelectedText = editor?.getSelectionText?.()?.trim() || ''
    setSelectedText(currentSelectedText)
    selectedTextRef.current = currentSelectedText

    const fullPlainText = editor?.getText?.()?.trim() || ''
    const textToProcess = currentSelectedText || fullPlainText

    if (command.id === 'title') {
      setIsLoading(true)
      const response = await generateTitle(fullPlainText)
      handleAIResponse(response, '生成的标题')
    } else if (command.id === 'polish') {
      setIsLoading(true)
      const response = await polishText(textToProcess)
      handleAIResponse(response, '润色结果')
    } else if (command.id === 'summarize') {
      setIsLoading(true)
      const response = await summarizeText(textToProcess)
      handleAIResponse(response, '核心要点')
    } else if (command.id === 'keywords') {
      setIsLoading(true)
      const response = await extractKeywords(fullPlainText)
      handleAIResponse(response, '提取的关键词')
    } else if (command.id === 'format') {
      setShowFormatModal(true)
    } else if (command.id === 'export') {
      alert('导出图片功能即将推出！')
    }
  }, [selectedArticle])

  const handleContentChange = useCallback((content: string) => {
    if (!selectedArticle) return
    const updated = { ...selectedArticle, content, updatedAt: new Date().toISOString().split('T')[0] }
    setSelectedArticle(updated)
    scheduleAutoSave(updated)
  }, [selectedArticle, scheduleAutoSave])

  const handleTitleChange = useCallback((title: string) => {
    if (!selectedArticle) return
    const updated = { ...selectedArticle, title }
    setSelectedArticle(updated)
    scheduleAutoSave(updated)
  }, [selectedArticle, scheduleAutoSave])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (selectedArticle) doSave(selectedArticle)
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false)
        setShowResultModal(false)
        setShowVersionModal(false)
        setShowFormatModal(false)
      }
      if (e.key === '/') {
        e.preventDefault()
        e.stopPropagation()
        setShowCommandPalette(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedArticle, doSave])

  const createNewArticle = () => {
    const newArticle: Article = {
      id: Date.now().toString(),
      title: '新建文章',
      content: '',
      category: '未分类',
      tags: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    }
    saveArticle(newArticle)
    setArticles(prev => [newArticle, ...prev])
    setSelectedArticle(newArticle)
    setShowWelcome(false)
  }

  const handleDeleteArticle = async (id: string) => {
    if (confirm('确定删除这篇文章吗？')) {
      await deleteArticleFromDB(id)
      const newArticles = articles.filter(a => a.id !== id)
      setArticles(newArticles)
      if (selectedArticle?.id === id) {
        setSelectedArticle(newArticles[0] || null)
      }
    }
  }

  const handleShowVersions = async () => {
    if (!selectedArticle) return
    const v = await getArticleVersions(selectedArticle.id)
    setVersions(v)
    setShowVersionModal(true)
  }

  const handleRestoreVersion = async (version: ArticleVersion) => {
    if (!selectedArticle) return
    const restored = { ...selectedArticle, title: version.title, content: version.content }
    setSelectedArticle(restored)
    if (/style\s*=/i.test(version.content)) {
      editorRef.current?.setHtmlRaw(version.content)
    } else {
      editorRef.current?.setHtml(version.content)
    }
    await doSave(restored)
    setShowVersionModal(false)
  }

  const handleFormat = async (styleId: string) => {
    if (!selectedArticle) return
    setShowFormatModal(false)
    setIsLoading(true)
    const editor = editorRef.current?.getEditor()
    const html = editor?.getHtml?.() || ''
    const response = await formatText(html, styleId)
    if (response.success) {
      setModalContent(response.content)
      setModalTitle('排版美化结果')
      setShowResultModal(true)
    } else {
      alert(`排版失败: ${response.error || '未知错误'}`)
    }
    setIsLoading(false)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">AI编辑器</h1>
        </div>
        <div className="flex items-center gap-3">
          {selectedArticle && !showWelcome && (
            <div className="flex items-center gap-2 text-sm">
              <span className={`${saveStatus === 'saved' ? 'text-green-500' : saveStatus === 'saving' ? 'text-yellow-500' : 'text-orange-500'}`}>
                {saveStatus === 'saved' ? '✓ 已保存' : saveStatus === 'saving' ? '⏳ 保存中...' : '● 未保存'}
              </span>
              {lastSaveTime && <span className="text-gray-400">{lastSaveTime}</span>}
              <button
                onClick={() => selectedArticle && doSave(selectedArticle)}
                className="px-3 py-1 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 transition-colors"
              >
                保存 Ctrl+S
              </button>
              <button
                onClick={handleShowVersions}
                className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors"
              >
                历史版本
              </button>
            </div>
          )}
          <button
            onClick={() => setShowCommandPalette(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors"
          >
            <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">Ctrl+P</span>
            <span>命令面板</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="设置"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <input
                type="text"
                placeholder="搜索文章..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={createNewArticle}
            className="m-3 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            新建文章
          </button>

          <div className="flex-1 overflow-y-auto">
            {filteredArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => { setSelectedArticle(article); setShowWelcome(false); }}
                className={`group p-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedArticle?.id === article.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-gray-800 line-clamp-2">{article.title}</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteArticle(article.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{article.category}</span>
                  {article.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">{tag}</span>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">{article.updatedAt}</p>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          {showWelcome ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">欢迎使用AI编辑器</h2>
              <p className="text-gray-500 mb-8 text-center max-w-md">
                一款专为自媒体创作者设计的AI辅助编辑工具。按 <kbd className="px-2 py-1 bg-gray-100 rounded text-sm">Ctrl+P</kbd> 或输入 <kbd className="px-2 py-1 bg-gray-100 rounded text-sm">/</kbd> 唤起命令面板。
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                {commands.map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => handleCommandSelect(cmd)}
                    className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
                  >
                    <span className="text-2xl">{cmd.icon}</span>
                    <div>
                      <p className="font-medium text-gray-800">{cmd.name}</p>
                      <p className="text-xs text-gray-400">{cmd.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : selectedArticle ? (
            <div className="flex-1 overflow-hidden">
              <EditorComponent
                ref={editorRef}
                key={selectedArticle.id}
                defaultHtml={selectedArticle.content}
                title={selectedArticle.title}
                onTitleChange={handleTitleChange}
                onChange={handleContentChange}
                onSelect={setSelectedText}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>暂无文章</p>
                <p className="text-sm mt-1">点击左侧"新建文章"开始创作</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600">AI处理中...</span>
          </div>
        </div>
      )}

      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/20 flex items-start justify-center pt-[15vh] z-50" onClick={() => setShowCommandPalette(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <input
                type="text"
                value={commandFilter}
                onChange={(e) => setCommandFilter(e.target.value)}
                placeholder="输入命令或搜索..."
                className="flex-1 bg-transparent border-none outline-none text-gray-800"
                autoFocus
              />
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => handleCommandSelect(cmd)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-xl">{cmd.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{cmd.name}</p>
                    <p className="text-sm text-gray-500">{cmd.description}</p>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">{cmd.shortcut}</kbd>
                  )}
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↑↓</kbd> 导航
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↵</kbd> 执行
                </span>
              </div>
              <span>{filteredCommands.length} 个命令</span>
            </div>
          </div>
        </div>
      )}

      {showResultModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowResultModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">{modalTitle}</h3>
              <button
                onClick={() => setShowResultModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {modalTitle === '排版美化结果' ? (
                <div
                  className="prose prose-sm max-w-none"
                  style={{ lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: modalContent }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-gray-700 font-sans leading-relaxed">{modalContent}</pre>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              {(modalTitle === '润色结果' || modalTitle === '核心要点' || modalTitle === '排版美化结果') && (
                <button
                  onClick={() => {
                    if (selectedArticle) {
                      const currentSelectedText = selectedTextRef.current
                      if (modalTitle === '排版美化结果') {
                        const updated = { ...selectedArticle, content: modalContent }
                        setSelectedArticle(updated)
                        editorRef.current?.setHtmlRaw(modalContent)
                        doSave(updated)
                      } else if (modalTitle === '核心要点') {
                        const summaryHtml = `<p><strong>核心要点：</strong></p>${modalContent}<hr/>`
                        if (currentSelectedText) {
                          editorRef.current?.insertHtmlBeforeSelection(summaryHtml)
                        } else {
                          editorRef.current?.insertHtmlAtStart(summaryHtml)
                        }
                      } else {
                        let newContent: string
                        if (currentSelectedText) {
                          newContent = selectedArticle.content.replace(currentSelectedText, modalContent)
                        } else {
                          newContent = modalContent
                        }
                        setSelectedArticle({ ...selectedArticle, content: newContent })
                        editorRef.current?.setHtml(newContent)
                      }
                    }
                    setShowResultModal(false)
                    setSelectedText('')
                    selectedTextRef.current = ''
                  }}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors"
                >
                  应用到文章
                </button>
              )}
              <button
                onClick={() => setShowResultModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showVersionModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowVersionModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">历史版本</h3>
              <button
                onClick={() => setShowVersionModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[55vh]">
              {versions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">暂无历史版本</div>
              ) : (
                versions.map((v) => (
                  <div
                    key={v.id}
                    className="px-6 py-3 border-b border-gray-50 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{v.title}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(v.savedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestoreVersion(v)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium hover:bg-indigo-100 transition-colors"
                    >
                      恢复此版本
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
              最多保留最近 {10} 个版本，超过30天的旧版本自动清理
            </div>
          </div>
        </div>
      )}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {showFormatModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowFormatModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">选择排版风格</h3>
              <button
                onClick={() => setShowFormatModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {FORMAT_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleFormat(style.id)}
                  className="w-full p-4 text-left rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                  <p className="font-medium text-gray-800">{style.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{style.description}</p>
                </button>
              ))}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
              排版仅处理文本内容，图片将保留原位
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg flex items-center gap-3 px-4 py-2">
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => handleCommandSelect(commands[0])}
          disabled={isLoading}
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span>✨</span>
          <span>润色</span>
        </button>
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => handleCommandSelect(commands[1])}
          disabled={isLoading}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span>📝</span>
          <span>提炼要点</span>
        </button>
      </div>
    </div>
  )
}

export default App
