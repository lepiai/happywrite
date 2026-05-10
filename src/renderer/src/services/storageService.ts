export interface Article {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface ArticleVersion {
  id: string
  articleId: string
  title: string
  content: string
  savedAt: string
}

export interface Template {
  id: string
  name: string
  category: string
  html: string
  css: string
  preview: string
  createdAt: string
  updatedAt: string
}

const DB_NAME = 'ai-editor-db'
const DB_VERSION = 2
const ARTICLES_STORE = 'articles'
const VERSIONS_STORE = 'versions'
const TEMPLATES_STORE = 'templates'
const MAX_VERSIONS_PER_ARTICLE = 10
const VERSION_CLEANUP_DAYS = 30

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ARTICLES_STORE)) {
        const store = db.createObjectStore(ARTICLES_STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
        const vStore = db.createObjectStore(VERSIONS_STORE, { keyPath: 'id' })
        vStore.createIndex('articleId', 'articleId', { unique: false })
        vStore.createIndex('savedAt', 'savedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
        const tStore = db.createObjectStore(TEMPLATES_STORE, { keyPath: 'id' })
        tStore.createIndex('category', 'category', { unique: false })
        tStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = fn(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }))
}

export async function getAllArticles(): Promise<Article[]> {
  const articles = await tx<Article[]>(ARTICLES_STORE, 'readonly', s => s.getAll())
  return articles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getArticle(id: string): Promise<Article | undefined> {
  return tx<Article | undefined>(ARTICLES_STORE, 'readonly', s => s.get(id))
}

export async function saveArticle(article: Article): Promise<void> {
  await tx(ARTICLES_STORE, 'readwrite', s => s.put(article))
}

export async function deleteArticle(id: string): Promise<void> {
  await tx(ARTICLES_STORE, 'readwrite', s => s.delete(id))
  const versions = await getArticleVersions(id)
  const db = await openDB()
  const transaction = db.transaction(VERSIONS_STORE, 'readwrite')
  const store = transaction.objectStore(VERSIONS_STORE)
  for (const v of versions) {
    store.delete(v.id)
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function saveVersion(article: Article): Promise<ArticleVersion> {
  const version: ArticleVersion = {
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    articleId: article.id,
    title: article.title,
    content: article.content,
    savedAt: new Date().toISOString(),
  }
  await tx(VERSIONS_STORE, 'readwrite', s => s.put(version))
  await cleanupOldVersions(article.id)
  return version
}

export async function getArticleVersions(articleId: string): Promise<ArticleVersion[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VERSIONS_STORE, 'readonly')
    const store = transaction.objectStore(VERSIONS_STORE)
    const index = store.index('articleId')
    const request = index.getAll(articleId)
    request.onsuccess = () => {
      const versions: ArticleVersion[] = request.result
      resolve(versions.sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
    }
    request.onerror = () => reject(request.error)
  })
}

async function cleanupOldVersions(articleId: string): Promise<void> {
  const versions = await getArticleVersions(articleId)
  if (versions.length <= MAX_VERSIONS_PER_ARTICLE) return
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - VERSION_CLEANUP_DAYS)
  const toDelete = versions.filter((v, i) => {
    if (i < MAX_VERSIONS_PER_ARTICLE) return false
    return new Date(v.savedAt) < cutoff
  })
  if (toDelete.length === 0) return
  const db = await openDB()
  const transaction = db.transaction(VERSIONS_STORE, 'readwrite')
  const store = transaction.objectStore(VERSIONS_STORE)
  for (const v of toDelete) {
    store.delete(v.id)
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function restoreVersion(articleId: string, versionId: string): Promise<ArticleVersion | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VERSIONS_STORE, 'readonly')
    const store = transaction.objectStore(VERSIONS_STORE)
    const request = store.get(versionId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function exportArticlesJSON(): Promise<string> {
  const articles = await getAllArticles()
  const allVersions: Record<string, ArticleVersion[]> = {}
  for (const a of articles) {
    allVersions[a.id] = await getArticleVersions(a.id)
  }
  return JSON.stringify({ articles, versions: allVersions }, null, 2)
}

export async function importArticlesJSON(json: string): Promise<number> {
  const data = JSON.parse(json)
  let count = 0
  if (data.articles && Array.isArray(data.articles)) {
    for (const article of data.articles) {
      await saveArticle(article)
      count++
    }
  }
  if (data.versions && typeof data.versions === 'object') {
    for (const versions of Object.values(data.versions) as ArticleVersion[][]) {
      for (const v of versions) {
        await tx(VERSIONS_STORE, 'readwrite', s => s.put(v))
      }
    }
  }
  return count
}

export async function getAllTemplates(): Promise<Template[]> {
  const templates = await tx<Template[]>(TEMPLATES_STORE, 'readonly', s => s.getAll())
  return templates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  return tx<Template | undefined>(TEMPLATES_STORE, 'readonly', s => s.get(id))
}

export async function getTemplatesByCategory(category: string): Promise<Template[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TEMPLATES_STORE, 'readonly')
    const store = transaction.objectStore(TEMPLATES_STORE)
    const index = store.index('category')
    const request = index.getAll(category)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveTemplate(template: Template): Promise<void> {
  const now = new Date().toISOString()
  const templateToSave: Template = {
    ...template,
    updatedAt: now,
    createdAt: template.createdAt || now,
  }
  await tx(TEMPLATES_STORE, 'readwrite', s => s.put(templateToSave))
}

export async function deleteTemplate(id: string): Promise<void> {
  await tx(TEMPLATES_STORE, 'readwrite', s => s.delete(id))
}

export async function getTemplateCategories(): Promise<string[]> {
  const templates = await getAllTemplates()
  const categories = new Set(templates.map(t => t.category))
  return Array.from(categories).sort()
}

export async function exportTemplatesJSON(): Promise<string> {
  const templates = await getAllTemplates()
  return JSON.stringify({ templates }, null, 2)
}

export async function importTemplatesJSON(json: string): Promise<number> {
  const data = JSON.parse(json)
  let count = 0
  if (data.templates && Array.isArray(data.templates)) {
    for (const template of data.templates) {
      await saveTemplate(template)
      count++
    }
  }
  return count
}
