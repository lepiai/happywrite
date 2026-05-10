export interface AIResponse {
  success: boolean;
  content: string;
  error?: string;
}

export interface ModelConfig {
  type: 'ollama' | 'openai' | 'deepseek' | 'aliyun';
  model: string;
}

const STORAGE_KEY = 'ai-editor-model-config';

const defaultConfig: ModelConfig = {
  type: 'ollama',
  model: 'qwen2:7b'
};

function loadConfig(): ModelConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultConfig, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load model config from localStorage:', e);
  }
  return defaultConfig;
}

function saveConfig(config: ModelConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save model config to localStorage:', e);
  }
}

let currentConfig = loadConfig();

export const setModelConfig = (config: ModelConfig) => {
  currentConfig = config;
  saveConfig(config);
};

export const getModelConfig = () => currentConfig;

export function getApiKey(type?: ModelConfig['type']): string | undefined {
  const configType = type || currentConfig.type;
  switch (configType) {
    case 'aliyun':
      return import.meta.env.VITE_ALIYUN_API_KEY;
    case 'openai':
      return import.meta.env.VITE_OPENAI_API_KEY;
    case 'deepseek':
      return import.meta.env.VITE_DEEPSEEK_API_KEY;
    default:
      return undefined;
  }
}

export const generateTitle = async (content: string, style: string = 'professional'): Promise<AIResponse> => {
  const styleMap: Record<string, string> = {
    professional: '专业正式',
    humorous: '幽默风趣',
    attractive: '吸引力',
    concise: '简洁有力',
    suspense: '悬疑好奇'
  };

  const prompt = `
请根据以下文章内容，生成5个${styleMap[style] || '专业'}风格的标题。

文章内容：
${content.slice(0, 500)}

要求：
1. 标题长度在10-20字之间
2. 符合${styleMap[style] || '专业'}风格
3. 能够吸引读者点击
4. 返回格式：每行一个标题，共5个
  `.trim();

  return await callAI(prompt);
};

export const polishText = async (text: string, style: string = 'professional'): Promise<AIResponse> => {
  const styleMap: Record<string, string> = {
    professional: '专业正式',
    casual: '口语化',
    concise: '简洁精炼',
    detailed: '详细丰富'
  };

  const prompt = `
请对以下文字进行${styleMap[style] || '专业'}风格的润色优化：

原文：
${text}

要求：
1. 保持原意不变
2. 使用${styleMap[style] || '专业'}风格
3. 语言流畅自然
4. 适当增加文采
  `.trim();

  return await callAI(prompt);
};

export const summarizeText = async (text: string): Promise<AIResponse> => {
  const prompt = `
请提取以下段落的核心要点：

原文：
${text}

要求：
1. 提取3-5个核心要点
2. 每个要点简洁明了
3. 使用列表形式输出
  `.trim();

  return await callAI(prompt);
};

export const extractKeywords = async (text: string): Promise<AIResponse> => {
  const prompt = `
请提取以下文章的关键词，并给出权重分值（0-1）：

文章内容：
${text.slice(0, 1000)}

要求：
1. 提取5-10个关键词
2. 每个关键词后面标注权重
3. 权重越高表示越重要
4. 返回格式：关键词1: 权重1\n关键词2: 权重2
  `.trim();

  return await callAI(prompt);
};

export interface FormatStyle {
  id: string
  name: string
  description: string
}

export const FORMAT_STYLES: FormatStyle[] = [
  { id: 'wechat', name: '微信公众号', description: '适合微信公众号推文，段落分明，重点突出' },
  { id: 'xiaohongshu', name: '小红书', description: '活泼轻松，emoji点缀，短句分段' },
  { id: 'zhihu', name: '知乎', description: '专业深度，逻辑清晰，引用规范' },
  { id: 'tech', name: '科技博客', description: '简洁技术风，代码块清晰，结构化强' },
]

interface ImagePlaceholder {
  placeholder: string
  imgTag: string
}

function extractImagePlaceholders(html: string): { text: string; images: ImagePlaceholder[] } {
  const images: ImagePlaceholder[] = []
  const imgRegex = /<img\s[^>]*>/gi
  let result = html.replace(imgRegex, (match) => {
    const index = images.length + 1
    const placeholder = `[IMG_${index}]`
    images.push({ placeholder, imgTag: match })
    return placeholder
  })
  result = result.replace(/<[^>]*>/g, '')
  result = result.replace(/&nbsp;/g, ' ')
  result = result.replace(/&amp;/g, '&')
  result = result.replace(/&lt;/g, '<')
  result = result.replace(/&gt;/g, '>')
  result = result.replace(/&quot;/g, '"')
  result = result.replace(/\n{3,}/g, '\n\n')
  result = result.trim()
  return { text: result, images }
}

function restoreImagePlaceholders(html: string, images: ImagePlaceholder[]): string {
  let result = html
  for (const { placeholder, imgTag } of images) {
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escapedPlaceholder, 'g'), imgTag)
  }
  return result
}

function parseCssDeclarations(css: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!css) return result
  for (const decl of css.split(';')) {
    const idx = decl.indexOf(':')
    if (idx > 0) {
      const prop = decl.substring(0, idx).trim()
      const val = decl.substring(idx + 1).trim()
      if (prop && val) result[prop] = val
    }
  }
  return result
}

function resolveStylesInHtml(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const styleElements = doc.querySelectorAll('style')
    const classRules: Record<string, Record<string, string>> = {}
    const tagRules: Array<{ tag: string; props: Record<string, string> }> = []

    for (const styleEl of styleElements) {
      const cssText = styleEl.textContent || ''
      const classRegex = /\.([\w-]+)\s*\{([^}]*)\}/g
      let m: RegExpExecArray | null
      while ((m = classRegex.exec(cssText)) !== null) {
        classRules[m[1]] = parseCssDeclarations(m[2])
      }
      const tagRegex = /([a-z][\w-]*)\s*\{([^}]*)\}/g
      while ((m = tagRegex.exec(cssText)) !== null) {
        if (!m[1].startsWith('.') && m[1] !== 'style') {
          tagRules.push({ tag: m[1], props: parseCssDeclarations(m[2]) })
        }
      }
      styleEl.remove()
    }

    for (const className of Object.keys(classRules)) {
      const props = classRules[className]
      const elements = doc.querySelectorAll(`.${className}`)
      for (const el of elements) {
        const existing = parseCssDeclarations(el.getAttribute('style') || '')
        el.setAttribute('style', Object.entries({ ...props, ...existing }).map(([k, v]) => `${k}: ${v}`).join('; '))
        el.classList.remove(className)
      }
    }

    for (const rule of tagRules) {
      const elements = doc.querySelectorAll(rule.tag)
      for (const el of elements) {
        const existing = parseCssDeclarations(el.getAttribute('style') || '')
        el.setAttribute('style', Object.entries({ ...rule.props, ...existing }).map(([k, v]) => `${k}: ${v}`).join('; '))
      }
    }

    return doc.body.innerHTML
  } catch {
    return html
  }
}

function cleanAIHtmlResponse(content: string): string {
  let result = content.trim()
  const codeBlockMatch = result.match(/```(?:html)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    result = codeBlockMatch[1].trim()
  }
  const firstTag = result.search(/<[a-zA-Z]/)
  if (firstTag > 0) {
    result = result.substring(firstTag)
  }
  const lastTag = result.lastIndexOf('>')
  if (lastTag >= 0 && lastTag < result.length - 1) {
    result = result.substring(0, lastTag + 1)
  }
  return result
}

export const formatText = async (html: string, styleId: string = 'wechat'): Promise<AIResponse> => {
  const style = FORMAT_STYLES.find(s => s.id === styleId) || FORMAT_STYLES[0]
  const { text, images } = extractImagePlaceholders(html)

  const imageInstruction = images.length > 0
    ? `\n13. 文本中的 ${images.map(i => i.placeholder).join('、')} 是图片占位符，代表图片位置。你必须在输出中保留这些占位符，不要删除、移动或修改它们，保持它们在原文中的相对位置不变。每个占位符单独占一行。`
    : ''

  const prompt = `
你是一个专业的排版编辑。请对以下纯文本内容进行排版美化，输出为HTML格式。

排版风格：${style.name}（${style.description}）

原始文本：
${text}

排版要求：
1. 输出必须是完整的HTML片段（不需要html/head/body标签）
2. 必须在每个HTML标签上使用内联style属性来控制样式，不要使用<style>标签或class类名
3. 每个段落<p>、标题<h1>-<h6>、引用<blockquote>都必须有自己的style属性
4. 字体：微信/小红书用系统默认字体，知乎/科技博客用衬线或等宽字体
5. 字号：正文16px，小标题20px，大标题24px
6. 行距：每个段落设置line-height: 1.8
7. 段落间距：每个段落设置margin-bottom: 16px
8. 重点内容用<strong>加粗或用color属性彩色标注
9. 适当使用<blockquote>引用块突出金句，设置border-left和padding样式
10. 如果有列表内容，使用<ul>或<ol>标签
11. 不要添加原文中没有的内容，只做排版美化
12. 不要输出任何解释说明，只输出HTML${imageInstruction}
  `.trim()

  const response = await callAI(prompt)

  if (response.success) {
    response.content = cleanAIHtmlResponse(response.content)
    response.content = resolveStylesInHtml(response.content)
    if (images.length > 0) {
      response.content = restoreImagePlaceholders(response.content, images)
    }
  }

  return response
};

const callAI = async (prompt: string): Promise<AIResponse> => {
  try {
    if (currentConfig.type === 'ollama') {
      return await callOllama(prompt);
    } else {
      return await callRemoteAPI(prompt);
    }
  } catch (error) {
    console.error('AI调用失败:', error);
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
};

const callOllama = async (prompt: string): Promise<AIResponse> => {
  try {
    const versionResponse = await fetch('http://localhost:11434/api/version');
    if (!versionResponse.ok) {
      throw new Error('Ollama服务未运行');
    }

    const modelInfo = await fetch(`http://localhost:11434/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: currentConfig.model })
    });

    if (!modelInfo.ok) {
      const modelList = await (await fetch('http://localhost:11434/api/tags')).json();
      const availableModels = modelList.models?.map((m: { name: string }) => m.name) || [];
      if (availableModels.length === 0) {
        return {
          success: false,
          content: '',
          error: `Ollama服务已启动，但未找到任何模型。请先运行: ollama run ${currentConfig.model}`
        };
      } else if (!availableModels.includes(currentConfig.model)) {
        return {
          success: false,
          content: '',
          error: `模型 ${currentConfig.model} 未找到。可用模型: ${availableModels.join(', ')}`
        };
      } else {
        return {
          success: false,
          content: '',
          error: `模型 ${currentConfig.model} 需要先加载。请运行: ollama run ${currentConfig.model}`
        };
      }
    }

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: currentConfig.model,
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Ollama请求失败: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.response || ''
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ollama调用失败';
    return {
      success: false,
      content: '',
      error: errorMessage
    };
  }
};

const callRemoteAPI = async (prompt: string): Promise<AIResponse> => {
  try {
    const apiKey = getApiKey();
    
    if (!apiKey) {
      return {
        success: false,
        content: '',
        error: '请在 .env 文件中配置 API Key'
      };
    }

    let url = '';
    let body: Record<string, unknown> = {};

    switch (currentConfig.type) {
      case 'openai':
        url = 'https://api.openai.com/v1/chat/completions';
        body = {
          model: currentConfig.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        };
        break;
      case 'deepseek':
        url = 'https://api.deepseek.com/v1/chat/completions';
        body = {
          model: currentConfig.model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        };
        break;
      case 'aliyun':
        url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
        body = {
          model: currentConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        };
        break;
      default:
        throw new Error('不支持的API类型');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentConfig.type === 'aliyun' ? `Bearer ${apiKey}` : `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      success: true,
      content
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : '远程API调用失败'
    };
  }
};

export const testConnection = async (): Promise<AIResponse> => {
  const prompt = '请回复"OK"表示测试成功';
  return await callAI(prompt);
};

let isOnline = navigator.onLine;
let networkStatusListeners: Array<(online: boolean) => void> = [];

export function addNetworkStatusListener(callback: (online: boolean) => void): () => void {
  networkStatusListeners.push(callback);
  return () => {
    networkStatusListeners = networkStatusListeners.filter(cb => cb !== callback);
  };
}

export function getNetworkStatus(): boolean {
  return isOnline;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    networkStatusListeners.forEach(cb => cb(true));
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    networkStatusListeners.forEach(cb => cb(false));
  });
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryableStatuses?: number[];
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      if (!navigator.onLine) {
        throw new Error('网络连接已断开');
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxRetries) {
        break;
      }

      if (!navigator.onLine) {
        throw new Error('网络连接已断开，请检查网络后重试');
      }

      const isRetryable = lastError.message.includes('网络')
        || (error && typeof error === 'object' && 'status' in error && opts.retryableStatuses.includes((error as { status: number }).status));

      if (!isRetryable) {
        throw lastError;
      }

      await new Promise(resolve => setTimeout(resolve, opts.retryDelay * Math.pow(2, attempt)));
    }
  }

  throw lastError || new Error('重试失败');
}
