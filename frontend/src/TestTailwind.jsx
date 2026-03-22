const TestTailwind = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Tailwind Test</h1>
        <p className="text-gray-600 mb-6">If you see this styled properly, Tailwind is working!</p>
        <div className="space-y-4">
          <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
            Primary Button
          </button>
          <button className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors">
            Secondary Button
          </button>
        </div>
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">✅ Tailwind CSS is working!</p>
        </div>
      </div>
    </div>
  )
}

export default TestTailwind
