// src/App.js
import React, { useState, useEffect } from 'react';
import { signInWithGoogle, logOut, auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null);

  // Track authentication state
  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  return (
    <div className="App">
      <h1>Welcome to Ventryx</h1>
      {user ? (
        <div>
          <h2>Hello, {user.displayName}</h2>
          <img src={user.photoURL} alt="User Avatar" width="100" />
          <button onClick={logOut}>Sign Out</button>
        </div>
      ) : (
        <button onClick={signInWithGoogle}>Sign In with Google</button>
      )}
    </div>
  );
}

export default App;
