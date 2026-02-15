import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { initializeApi, authApi } from './services/api'
import Login from './components/Login'
import MeetingList from './components/MeetingList'
import MeetingAnalysisList from './components/MeetingAnalysisList'
import './App.css'

function App() {
  const auth = useAuth()
  const [currentView, setCurrentView] = useState('meetings') // 'meetings' or 'analyses'

  // Initialize API service with auth context
  useEffect(() => {
    initializeApi(auth)
  }, [auth])

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      auth.logout()
    }
  }

  // Show loading while checking authentication
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!auth.isAuthenticated) {
    return <Login />
  }

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
            <div className="flex items-center gap-4">
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
              <div className="flex items-center gap-3 border-l pl-4">
                {auth.user && (
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{auth.user.username}</span>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
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
