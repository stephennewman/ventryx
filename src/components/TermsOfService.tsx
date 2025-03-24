import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex justify-center">
          <img
            src="https://s3.ca-central-1.amazonaws.com/logojoy/logos/215772753/noBgColor.png?19117.199999999255"
            alt="Ventryx Logo"
            className="h-12 w-auto"
          />
        </div>
        
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
          
          <div className="space-y-6 text-left">
            <section>
              <h2 className="text-xl font-semibold mb-4">1. Agreement to Terms</h2>
              <p className="text-gray-700">
                By accessing or using Ventryx's services, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you do not have permission to access our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. Description of Services</h2>
              <p className="text-gray-700">
                Ventryx provides financial insights and transaction monitoring services that:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Connect to your financial accounts through secure third-party integrations</li>
                <li>Analyze your transaction history and financial patterns</li>
                <li>Provide insights and recommendations</li>
                <li>Send notifications and alerts via SMS or email (if opted in)</li>
                <li>Generate reports and visualizations of your financial data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. User Accounts</h2>
              <p className="text-gray-700">
                To use our services, you must:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Be at least 18 years old</li>
                <li>Register using valid credentials through our SSO providers</li>
                <li>Maintain the security of your account</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Provide accurate and complete information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. Financial Data Access</h2>
              <p className="text-gray-700">
                By using our services, you:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Authorize us to access your financial data through our banking partners</li>
                <li>Acknowledge that we use Plaid to connect to your financial institutions</li>
                <li>Understand that we maintain read-only access to your transaction data</li>
                <li>Agree to keep your banking credentials secure and up-to-date</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Communications</h2>
              <p className="text-gray-700">
                By providing your phone number and opting into SMS communications, you agree to receive:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Transaction alerts and notifications</li>
                <li>Financial insights and recommendations</li>
                <li>Service updates and important announcements</li>
                <li>Account security notifications</li>
              </ul>
              <p className="mt-2 text-gray-700">
                You can opt out of SMS communications at any time by replying STOP to any message.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Intellectual Property</h2>
              <p className="text-gray-700">
                The Ventryx service, including its original content, features, and functionality, is owned by Ventryx and is protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Limitation of Liability</h2>
              <p className="text-gray-700">
                Ventryx and its suppliers shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or use of our services. This includes any errors or omissions in any content, or any loss or damage incurred as a result of the use of any content posted, transmitted, or otherwise made available via the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. Changes to Terms</h2>
              <p className="text-gray-700">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">9. Contact Information</h2>
              <p className="text-gray-700">
                If you have any questions about these Terms, please contact us at:
                <br />
                Email: terms@ventryx.com
              </p>
            </section>
          </div>
          <div className="mt-8 text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            <Link to="/privacy-policy" className="text-blue-600 hover:text-blue-800">
              View Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService; 