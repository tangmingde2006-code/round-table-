import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Submit from '@/pages/Submit'
import RoundTable from '@/pages/RoundTable'
import Report from '@/pages/Report'
import History from '@/pages/History'
import PromptStudio from '@/pages/PromptStudio'
import KnowledgeBase from '@/pages/KnowledgeBase'

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Submit />} />
          <Route path="/roundtable/:id" element={<RoundTable />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/history" element={<History />} />
          <Route path="/prompt-studio" element={<PromptStudio />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
        </Routes>
      </Layout>
    </Router>
  )
}
