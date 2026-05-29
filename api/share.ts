import { createServer } from 'http'
import localtunnel from 'localtunnel'
import { execSync } from 'child_process'

const PORT = process.env.PORT || 3001

function killPort(port: number) {
  try {
    const pid = execSync(`lsof -ti:${port} 2>/dev/null`).toString().trim()
    if (pid) {
      console.log(`🔄 Killing existing process on port ${port} (PID: ${pid})`)
      execSync(`kill -9 ${pid} 2>/dev/null`)
    }
  } catch {}
}

async function start() {
  killPort(Number(PORT))

  console.log('🔨 Building frontend...')
  try {
    execSync('npx vite build', { stdio: 'inherit' })
  } catch {
    console.error('❌ Build failed')
    process.exit(1)
  }

  console.log('🚀 Starting production server...')

  const { default: app, initDatabase } = await import('./app.js')
  await initDatabase()

  const server = createServer(app)

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is still in use. Try: kill -9 $(lsof -ti:${PORT})`)
      process.exit(1)
    }
  })

  server.listen(Number(PORT), async () => {
    console.log(`✅ Server running on http://localhost:${PORT}`)

    try {
      const tunnel = await localtunnel({ port: Number(PORT) })
      console.log('\n' + '='.repeat(60))
      console.log('🔗 分享链接（可发给任何人使用）:')
      console.log(`   ${tunnel.url}`)
      console.log('='.repeat(60))
      console.log('\n⚠️  此链接在终端关闭后失效')
      console.log('💡 如需固定子域名，运行: npm run share -- --subdomain your-name')
      console.log('   例如: npm run share -- --subdomain roundtable')
      console.log('   链接将变为: https://roundtable.loca.lt\n')

      tunnel.on('close', () => {
        console.log('Tunnel closed')
      })

      process.on('SIGINT', () => {
        tunnel.close()
        server.close()
        process.exit(0)
      })

      process.on('SIGTERM', () => {
        tunnel.close()
        server.close()
        process.exit(0)
      })
    } catch (err: any) {
      console.error('❌ Tunnel failed:', err.message)
      console.log(`\n服务仍在 http://localhost:${PORT} 运行`)
      console.log('你也可以手动安装 ngrok 获取更稳定的链接:')
      console.log('  brew install ngrok')
      console.log(`  ngrok http ${PORT}`)
    }
  })
}

start().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
