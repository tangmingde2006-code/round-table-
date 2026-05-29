import { getDatabase } from '../db.js'

interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

interface SearchResponse {
  results: SearchResult[]
  answer: string | null
}

function getTavilyApiKey(): string {
  const envKey = process.env.TAVILY_API_KEY
  if (envKey) return envKey
  try {
    const db = getDatabase()
    const result = db.exec("SELECT value FROM config WHERE key = 'tavily_api_key'")
    if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0]) {
      return result[0].values[0][0] as string
    }
  } catch {}
  return ''
}

export async function webSearch(query: string, maxResults = 5): Promise<SearchResponse> {
  const apiKey = getTavilyApiKey()
  if (!apiKey) {
    console.warn('[Search] Tavily API Key not configured, skipping search')
    return { results: [], answer: null }
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'advanced',
        include_answer: true,
        topic: 'news',
      }),
    })

    if (!response.ok) {
      console.error(`[Search] Tavily API error: ${response.status}`)
      return { results: [], answer: null }
    }

    const data = (await response.json()) as any
    const results = (data.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      score: r.score || 0,
    }))
    return { results, answer: data.answer || null }
  } catch (error: any) {
    console.error(`[Search] Error: ${error.message}`)
    return { results: [], answer: null }
  }
}

export async function searchAndFormat(query: string, maxResults = 5): Promise<string> {
  const { results, answer } = await webSearch(query, maxResults)
  if (results.length === 0 && !answer) return '【联网搜索未配置或无结果】'

  let formatted = `【联网搜索结果 - 查询: "${query}"】\n`
  if (answer) {
    formatted += `\nAI摘要: ${answer}\n`
  }
  for (const r of results) {
    formatted += `\n来源: ${r.title}\nURL: ${r.url}\n内容: ${r.content}\n`
  }
  return formatted
}
