const MinimalTest = () => {
  return (
    <div className="bg-red-500 p-8">
      <h1 className="text-white text-4xl font-bold">THIS SHOULD BE RED</h1>
      <div className="bg-blue-500 p-4 mt-4">
        <p className="text-white">This should be blue</p>
      </div>
      <div className="bg-green-500 p-4 mt-4">
        <p className="text-white">This should be green</p>
      </div>
      <button className="bg-purple-500 text-white px-6 py-3 mt-4">
        Purple Button
      </button>
    </div>
  )
}

export default MinimalTest
