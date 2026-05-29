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

export async function webSearch(query: string, maxResults = 5, topic: 'news' | 'general' = 'general'): Promise<SearchResponse> {
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
        topic,
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

async function wikipediaSearch(query: string, lang = 'zh'): Promise<string> {
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=2&format=json&origin=*`
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) return ''

    const searchData = (await searchRes.json()) as any
    const searchResults = searchData?.query?.search || []
    if (searchResults.length === 0) return ''

    const summaries: string[] = []
    for (const item of searchResults) {
      const title = item.title as string
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      const summaryRes = await fetch(summaryUrl)
      if (!summaryRes.ok) continue
      const summaryData = (await summaryRes.json()) as any
      if (summaryData.extract) {
        summaries.push(`[${lang.toUpperCase()}] ${title}: ${summaryData.extract}`)
      }
    }

    return summaries.length > 0
      ? `【维基百科参考】\n${summaries.join('\n\n')}`
      : ''
  } catch (error: any) {
    console.warn(`[Wikipedia] Search failed: ${error.message}`)
    return ''
  }
}

export async function searchAndFormat(query: string, maxResults = 5, topic: 'news' | 'general' = 'general'): Promise<string> {
  const [tavilyResult, wikiZhResult, wikiEnResult] = await Promise.all([
    webSearch(query, maxResults, topic),
    wikipediaSearch(query, 'zh'),
    wikipediaSearch(query, 'en'),
  ])

  const parts: string[] = []

  if (tavilyResult.results.length > 0 || tavilyResult.answer) {
    let formatted = `【联网搜索结果 - 查询: "${query}"】\n`
    if (tavilyResult.answer) {
      formatted += `\nAI摘要: ${tavilyResult.answer}\n`
    }
    for (const r of tavilyResult.results) {
      formatted += `\n来源: ${r.title}\nURL: ${r.url}\n内容: ${r.content}\n`
    }
    parts.push(formatted)
  }

  if (wikiZhResult) parts.push(wikiZhResult)
  if (wikiEnResult) parts.push(wikiEnResult)

  if (parts.length === 0) return '【联网搜索未配置或无结果】'

  return parts.join('\n\n')
}
