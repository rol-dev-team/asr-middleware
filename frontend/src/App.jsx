import { useState } from 'react'
import MeetingList from './components/MeetingList'
import MeetingAnalysisList from './components/MeetingAnalysisList'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('meetings') // 'meetings' or 'analyses'

  return (
    <div className="w-full">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎙️</span>
              <span className="text-xl font-bold text-gray-900">ASR Middleware</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView('meetings')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'meetings'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                📅 Meetings
              </button>
              <button
                onClick={() => setCurrentView('analyses')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'analyses'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                📊 Analyses
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      {currentView === 'meetings' ? <MeetingList /> : <MeetingAnalysisList />}
    </div>
  )
}

export default App
