import { useState, useEffect } from 'react';
import { audioApi } from '../services/api';
import MeetingAnalysisDetail from './MeetingAnalysisDetail';

function MeetingAnalysisList() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const data = await audioApi.getAnalyses(0, 100);
      setAnalyses(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching analyses:', err);
      setError(err.message || 'Failed to load meeting analyses. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalysisClick = (analysis) => {
    setSelectedAnalysis(analysis);
  };

  const handleBackToList = () => {
    setSelectedAnalysis(null);
  };

  if (selectedAnalysis) {
    return (
      <MeetingAnalysisDetail 
        analysis={selectedAnalysis} 
        onBack={handleBackToList} 
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading analyses...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={fetchAnalyses}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Meeting Analyses</h1>
          <p className="text-gray-600">
            View AI-generated insights and summaries from your meetings
          </p>
        </div>

        {analyses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg">No analyses found</p>
            <p className="text-gray-400 mt-2">Record and analyze meetings to see insights here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                onClick={() => handleAnalysisClick(analysis)}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border border-gray-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      Meeting Analysis
                    </h2>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(analysis.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      {analysis.model_used}
                    </span>
                    {analysis.notes_markdown && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        📝 Full Notes
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary</h3>
                  <p className="text-gray-600 line-clamp-2">{analysis.summary}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Key Topics</h3>
                    <p className="text-gray-600 text-sm line-clamp-2">{analysis.key_topics}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Action Items</h3>
                    <p className="text-gray-600 text-sm line-clamp-2">{analysis.action_items}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-500">
                    ID: {analysis.id.substring(0, 8)}...
                  </span>
                  <span className="text-blue-600 font-medium text-sm">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MeetingAnalysisList;
