import React, { useState, useEffect } from 'react';
import { signInWithGoogle, logOut, auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="card max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Ventryx</h1>
          <p className="text-gray-600">Your real-time budget consultant</p>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <img 
                src={user.photoURL || ''} 
                alt="User Avatar" 
                className="w-16 h-16 rounded-full"
              />
              <div className="text-left">
                <h2 className="text-xl font-semibold text-gray-900">{user.displayName}</h2>
                <p className="text-gray-600">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={logOut}
              className="btn btn-secondary w-full"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button 
              onClick={signInWithGoogle}
              className="w-full"
            >
              <img 
                src="https://developers.google.com/identity/images/btn_google_signin_dark_normal_web.png" 
                alt="Sign in with Google"
                className="w-full"
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App; 