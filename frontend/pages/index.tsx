import { useState } from 'react';
import axios from 'axios';

interface Message {
  question: string;
  answer: string;
  source?: string;
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRepoLoaded, setIsRepoLoaded] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');

  const loadRepo = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await axios.post('/api/load', { repo_url: repoUrl });
      setSummary(response.data.summary);
      setIsRepoLoaded(true);
    } catch (err) {
      setError('Failed to load repository. Please check the URL and try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    
    try {
      setIsLoading(true);
      setError('');
      const response = await axios.post('/api/chat', {
        repo_url: repoUrl,
        question: question
      });
      
      setMessages([...messages, {
        question,
        answer: response.data.answer,
        source: response.data.source
      }]);
      setQuestion('');
    } catch (err) {
      setError('Failed to get answer. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-white">
          GitHub Talker
        </h1>
        
        {!isRepoLoaded ? (
          <div className="bg-gray-900 rounded-lg shadow-md p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4 text-white">Load a GitHub Repository</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="Enter GitHub repository URL"
                className="flex-1 p-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={loadRepo}
                disabled={isLoading || !repoUrl}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-700"
              >
                {isLoading ? 'Loading...' : 'Load'}
              </button>
            </div>
            {error && <p className="text-red-400 mt-2">{error}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <div className="lg:col-span-2 bg-gray-900 rounded-lg shadow-md p-6">
              <div className="h-[500px] overflow-y-auto mb-4 space-y-4">
                {messages.map((msg, index) => (
                  <div key={index} className="space-y-2">
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <p className="font-semibold text-blue-400">You:</p>
                      <p className="text-white">{msg.question}</p>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <p className="font-semibold text-green-400">Assistant:</p>
                      <p className="text-white">{msg.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about the code..."
                  className="flex-1 p-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
                />
                <button
                  onClick={askQuestion}
                  disabled={isLoading || !question}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-700"
                >
                  {isLoading ? 'Thinking...' : 'Ask'}
                </button>
              </div>
            </div>

            {/* Context Panel */}
            <div className="bg-gray-900 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Repository Summary</h2>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-gray-300">{summary}</p>
              </div>
              
              {messages.length > 0 && messages[messages.length - 1].source && (
                <>
                  <h2 className="text-xl font-semibold mt-6 mb-4 text-white">Current Context</h2>
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap text-gray-300">
                      {messages[messages.length - 1].source}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 