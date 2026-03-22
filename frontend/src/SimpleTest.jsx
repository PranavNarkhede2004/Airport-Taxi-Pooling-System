const SimpleTest = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">✅ Tailwind CSS Test</h1>
          <p className="text-xl text-gray-600 mb-6">If you can see this styled properly, Tailwind is working!</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Blue Card</h3>
              <p className="text-blue-700">This card uses blue colors</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-2">Green Card</h3>
              <p className="text-green-700">This card uses green colors</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">Purple Card</h3>
              <p className="text-purple-700">This card uses purple colors</p>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              Primary Button
            </button>
            <button className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors">
              Secondary Button
            </button>
            <button className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors">
              Outline Button
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Form Elements Test</h2>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Test input field" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <textarea 
              placeholder="Test textarea" 
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleTest
