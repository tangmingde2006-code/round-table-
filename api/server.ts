import app, { initDatabase } from './app.js'

const IS_VERCEL = !!process.env.VERCEL

if (IS_VERCEL) {
  await initDatabase()
}

export default app

if (!IS_VERCEL) {
  const PORT = process.env.PORT || 3001

  async function start() {
    await initDatabase()
    console.log('Database initialized')

    const server = app.listen(PORT, () => {
      console.log(`Server ready on port ${PORT}`)
    })

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received')
      server.close(() => {
        console.log('Server closed')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('SIGINT signal received')
      server.close(() => {
        console.log('Server closed')
        process.exit(0)
      })
    })
  }

  start().catch((err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}
