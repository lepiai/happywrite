import { useState, useEffect } from 'react'
import { setModelConfig, getModelConfig, testConnection, ModelConfig, getApiKey } from '../services/aiService'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const modelTypes = [
  { value: 'ollama', label: 'Ollama (本地模型)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'aliyun', label: '阿里云通义千问' }
]

const openaiModels = [
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4o'
]

const deepseekModels = [
  'deepseek-chat',
  'deepseek-r1'
]

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<ModelConfig>(getModelConfig())
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaConnected, setOllamaConnected] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const current = getModelConfig()
      setConfig(current)
      if (current.type === 'ollama') {
        fetchOllamaModels()
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (config.type === 'ollama') {
      fetchOllamaModels()
    } else {
      setOllamaModels([])
      setOllamaConnected(false)
    }
  }, [config.type])

  const fetchOllamaModels = async () => {
    setIsLoadingModels(true)
    try {
      const response = await fetch('http://localhost:11434/api/tags')
      if (response.ok) {
        const data = await response.json()
        const models = data.models?.map((m: { name: string }) => m.name) || []
        setOllamaModels(models)
        setOllamaConnected(models.length > 0)
        
        if (models.length > 0 && !models.includes(config.model)) {
          setConfig({ ...config, model: models[0] })
        }
      } else {
        setOllamaConnected(false)
        setOllamaModels([])
      }
    } catch {
      setOllamaConnected(false)
      setOllamaModels([])
    }
    setIsLoadingModels(false)
  }

  const getModelOptions = () => {
    switch (config.type) {
      case 'ollama': return ollamaModels.length > 0 ? ollamaModels : ['请先连接Ollama服务...']
      case 'openai': return openaiModels
      case 'deepseek': return deepseekModels
      case 'aliyun': return []
      default: return []
    }
  }

  const handleTypeChange = (type: ModelConfig['type']) => {
    let defaultModel = ''
    switch (type) {
      case 'ollama':
        defaultModel = ollamaModels.length > 0 ? ollamaModels[0] : ''
        break
      case 'openai':
        defaultModel = openaiModels[0]
        break
      case 'deepseek':
        defaultModel = deepseekModels[0]
        break
      case 'aliyun':
        defaultModel = ''
        break
    }
    setConfig({ ...config, type, model: defaultModel })
    setTestResult(null)
    setTestMessage('')
  }

  const handleSave = () => {
    setModelConfig(config)
    onClose()
  }

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    setTestMessage('')
    
    if (config.type === 'ollama') {
      await fetchOllamaModels()
      if (!ollamaConnected) {
        setTestResult('error')
        setTestMessage('Ollama服务未连接或没有可用模型')
        setIsTesting(false)
        return
      }
    }
    
    const result = await testConnection()
    
    if (result.success) {
      setTestResult('success')
      setTestMessage('连接测试成功！')
    } else {
      setTestResult('error')
      setTestMessage(result.error || '连接测试失败')
    }
    
    setIsTesting(false)
  }

  const getApiKeyHint = () => {
    switch (config.type) {
      case 'aliyun':
        return 'VITE_ALIYUN_API_KEY'
      case 'openai':
        return 'VITE_OPENAI_API_KEY'
      case 'deepseek':
        return 'VITE_DEEPSEEK_API_KEY'
      default:
        return ''
    }
  }

  const hasApiKey = () => {
    return !!getApiKey(config.type)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">模型配置</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">AI服务类型</label>
            <div className="grid grid-cols-2 gap-2">
              {modelTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleTypeChange(type.value as ModelConfig['type'])}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    config.type === type.value
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.label}
                  {type.value === 'ollama' && ollamaConnected && (
                    <span className="w-2 h-2 bg-green-400 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {config.type === 'aliyun' ? '模型名称' : '选择模型'}
            </label>
            {config.type === 'aliyun' ? (
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                placeholder="请输入已开通的模型名称，如 qwen-turbo, qwen-plus 等"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  disabled={config.type === 'ollama' && !ollamaConnected}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getModelOptions().map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                {config.type === 'ollama' && (
                  <button
                    onClick={fetchOllamaModels}
                    disabled={isLoadingModels}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-50"
                    title="刷新模型列表"
                  >
                    {isLoadingModels ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {config.type !== 'ollama' && (
            <div className={`p-4 rounded-lg ${hasApiKey() ? 'bg-green-50' : 'bg-orange-50'}`}>
              <p className={`text-sm ${hasApiKey() ? 'text-green-700' : 'text-orange-700'}`}>
                {hasApiKey() ? (
                  <>
                    <strong>✓ API Key 已配置</strong>
                  </>
                ) : (
                  <>
                    <strong>请在 .env 文件中配置 API Key</strong><br />
                    添加 <code className="px-1 py-0.5 bg-white rounded text-xs font-mono">{getApiKeyHint()}=your-api-key</code>
                  </>
                )}
              </p>
            </div>
          )}

          {config.type === 'ollama' && (
            <div className={`p-4 rounded-lg ${ollamaConnected ? 'bg-green-50' : 'bg-blue-50'}`}>
              <p className={`text-sm ${ollamaConnected ? 'text-green-700' : 'text-blue-700'}`}>
                {ollamaConnected ? (
                  <>
                    <strong>✓ Ollama已连接</strong> - 已获取到 {ollamaModels.length} 个可用模型
                  </>
                ) : isLoadingModels ? (
                  <>正在连接Ollama服务...</>
                ) : (
                  <>
                    <strong>提示：</strong>请确保Ollama服务已启动。在终端运行 <code className="px-1 py-0.5 bg-white rounded text-xs">ollama serve</code> 启动服务。
                  </>
                )}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={
                isTesting ||
                (config.type === 'ollama' && !ollamaConnected) ||
                (config.type !== 'ollama' && !hasApiKey()) ||
                !config.model
              }
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? '测试中...' : '测试连接'}
            </button>
            {testResult && (
              <div className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${
                testResult === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {testResult === 'success' ? '✓' : '✗'} {testMessage}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={
              !config.model ||
              (config.type === 'ollama' && !ollamaConnected) ||
              (config.type !== 'ollama' && !hasApiKey())
            }
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  )
}