import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

function MeetingAnalysisDetail({ analysis, onBack }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Extract markdown content from code fence if present
  const extractMarkdown = (markdownText) => {
    if (!markdownText) return '';
    
    // Remove code fence markers (```markdown and ```)
    const match = markdownText.match(/```(?:markdown)?\n([\s\S]*?)```/);
    if (match) {
      return match[1].trim();
    }
    
    return markdownText.trim();
  };

  const cleanMarkdown = extractMarkdown(analysis.notes_markdown);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'business', label: 'Business Insights', icon: '💼' },
    { id: 'technical', label: 'Technical Insights', icon: '⚙️' },
    { id: 'markdown', label: 'Full Notes', icon: '📝' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          ← Back to Analyses
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Meeting Analysis</h1>
                <p className="text-blue-100">
                  Generated on {new Date(analysis.created_at).toLocaleString()}
                </p>
              </div>
              <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium">
                {analysis.model_used}
              </span>
            </div>
            <div className="text-sm text-blue-100">
              ID: {analysis.id}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap
                    border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">Summary</h2>
                  <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">Content</h2>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 italic">&ldquo;{analysis.content_text}&rdquo;</p>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Key Topics</h3>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-gray-700">{analysis.key_topics}</p>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Action Items</h3>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-gray-700">{analysis.action_items}</p>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'business' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Business Insights</h2>
                <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {analysis.business_insights}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'technical' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Technical Insights</h2>
                <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {analysis.technical_insights}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'markdown' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Full Meeting Notes</h2>
                {analysis.notes_markdown ? (
                  <div className="prose prose-lg max-w-none bg-white border border-gray-300 rounded-lg p-8 shadow-sm">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-3xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-300">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-gray-800 leading-relaxed mb-4 text-base">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-outside space-y-2 mb-6 text-gray-800 ml-6">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-outside space-y-2 mb-6 text-gray-800 ml-6">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-relaxed">{children}</li>
                        ),
                        hr: () => (
                          <hr className="my-8 border-t-2 border-gray-300" />
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-6 py-3 italic text-gray-800 my-6 rounded-r">
                            {children}
                          </blockquote>
                        ),
                        code: ({ inline, children }) =>
                          inline ? (
                            <code className="bg-gray-200 text-gray-900 px-2 py-0.5 rounded text-sm font-mono">
                              {children}
                            </code>
                          ) : (
                            <code className="block bg-gray-100 text-gray-900 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4 border border-gray-300">
                              {children}
                            </code>
                          ),
                        pre: ({ children }) => (
                          <pre className="bg-gray-100 text-gray-900 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4 border border-gray-300">
                            {children}
                          </pre>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-gray-900">
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-gray-800">
                            {children}
                          </em>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            className="text-blue-600 hover:text-blue-800 underline font-medium"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {cleanMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-12 text-center border border-gray-200">
                    <p className="text-gray-500 text-lg">No detailed markdown notes available</p>
                    <p className="text-gray-400 mt-2">
                      This analysis may not include formatted notes
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MeetingAnalysisDetail;
