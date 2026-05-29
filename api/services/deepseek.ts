import OpenAI from 'openai'
import { getDatabase, save } from '../db.js'

type MessageParam = OpenAI.ChatCompletionMessageParam

function getApiKey(): string {
  const envKey = process.env.DEEPSEEK_API_KEY
  if (envKey) return envKey

  const db = getDatabase()
  const result = db.exec("SELECT value FROM config WHERE key = 'deepseek_api_key'")
  if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0]) {
    return result[0].values[0][0] as string
  }

  return ''
}

function getModel(): string {
  const db = getDatabase()
  const result = db.exec("SELECT value FROM config WHERE key = 'deepseek_model'")
  if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0]) {
    return result[0].values[0][0] as string
  }
  return 'deepseek-chat'
}

function createClient(): OpenAI {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('DeepSeek API Key 未配置。请在环境变量 DEEPSEEK_API_KEY 或系统配置中设置 API Key。')
  }

  console.log(`[DeepSeek] Using model: ${getModel()}, API Key: ${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`)

  return new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  })
}

export async function chatCompletion(
  messages: MessageParam[],
  jsonMode?: boolean,
): Promise<string> {
  const client = createClient()
  const model = getModel()

  console.log(`[DeepSeek] Calling chat completion, model=${model}, messages=${messages.length}, jsonMode=${!!jsonMode}`)

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    })

    const content = response.choices[0]?.message?.content || ''
    console.log(`[DeepSeek] Response received, length=${content.length}`)
    return content
  } catch (error: any) {
    console.error(`[DeepSeek] API Error: ${error.message}`)
    if (error.status) console.error(`[DeepSeek] Status: ${error.status}`)
    if (error.error) console.error(`[DeepSeek] Error detail:`, JSON.stringify(error.error))
    throw error
  }
}

export async function* chatCompletionStream(
  messages: MessageParam[],
  jsonMode?: boolean,
): AsyncGenerator<string> {
  const client = createClient()
  const model = getModel()

  console.log(`[DeepSeek] Starting stream, model=${model}, messages=${messages.length}, jsonMode=${!!jsonMode}`)

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        yield content
      }
    }
  } catch (error: any) {
    console.error(`[DeepSeek] Stream Error: ${error.message}`)
    if (error.status) console.error(`[DeepSeek] Stream Status: ${error.status}`)
    if (error.error) console.error(`[DeepSeek] Stream Error detail:`, JSON.stringify(error.error))
    throw error
  }
}
