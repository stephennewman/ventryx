import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

interface PostSSOWelcomeProps {
  user: User;
  onComplete: () => void;
}

const PostSSOWelcome: React.FC<PostSSOWelcomeProps> = ({ user, onComplete }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Format phone number to E.164 format (remove any non-digit characters)
      const formattedPhone = phoneNumber.replace(/\D/g, '');
      
      // Basic validation
      if (formattedPhone && formattedPhone.length !== 10) {
        throw new Error('Please enter a valid 10-digit phone number');
      }

      // Save to Firestore
      const db = getFirestore();
      await setDoc(doc(db, 'users', user.uid), {
        phoneNumber: formattedPhone || null,
        smsConsent,
        email: user.email,
        displayName: user.displayName,
        updatedAt: new Date(),
      }, { merge: true });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
      <div>
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Welcome to Ventryx!
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Add your phone number to improve your experience.
        </p>
      </div>
      
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <input
            id="phone-number"
            name="phone-number"
            type="tel"
            placeholder="(Recommended)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="sms-consent"
              name="sms-consent"
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="sms-consent" className="font-medium text-gray-700">
              I agree to receive recurring SMS messages from Ventryx at the number provided. These messages may include transaction alerts, financial insights, and account updates. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out.{' '}
              <a href="/privacy-policy" className="text-blue-600 hover:text-blue-500">
                View our Privacy Policy
              </a>
            </label>
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm">
            {error}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="w-full text-sm text-gray-500 hover:text-gray-700 mt-4"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostSSOWelcome; 