import React, { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="card">
      <h1>Vibecode React App</h1>
      <p>Start editing to see changes.</p>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

export default App;