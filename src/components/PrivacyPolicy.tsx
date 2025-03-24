import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
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
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="space-y-6 text-left">
            <section>
              <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
              <p className="text-gray-700">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Name and email address through SSO authentication</li>
                <li>Phone number (if provided)</li>
                <li>Financial transaction data through our banking integration partners</li>
                <li>Communication preferences</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-700">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Provide, maintain, and improve our services</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Send transaction alerts and financial insights via SMS (if opted in)</li>
                <li>Respond to your comments and questions</li>
                <li>Analyze usage patterns and improve user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. SMS Communications</h2>
              <p className="text-gray-700">
                If you opt in to SMS communications:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Message frequency varies based on account activity and preferences</li>
                <li>Message and data rates may apply</li>
                <li>You can opt out at any time by replying STOP to any message</li>
                <li>Reply HELP for assistance</li>
                <li>Carriers are not liable for delayed or undelivered messages</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. Data Security</h2>
              <p className="text-gray-700">
                We implement appropriate technical and organizational security measures to protect your personal information. However, no security system is impenetrable and we cannot guarantee the security of our systems 100%.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
              <p className="text-gray-700">
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Service providers who assist in our operations</li>
                <li>Professional advisers and financial institutions</li>
                <li>Law enforcement when required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Your Rights</h2>
              <p className="text-gray-700">
                You have the right to:
              </p>
              <ul className="list-disc pl-5 mt-2 text-gray-700">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your information</li>
                <li>Opt out of communications</li>
                <li>Data portability</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Contact Us</h2>
              <p className="text-gray-700">
                If you have any questions about this Privacy Policy, please contact us at:
                <br />
                Email: privacy@ventryx.com
              </p>
            </section>

            <section className="text-sm text-gray-500">
              <p>Last updated: {new Date().toLocaleDateString()}</p>
            </section>
          </div>
          <div className="mt-8 text-sm text-gray-500">
            <Link to="/terms-of-service" className="text-blue-600 hover:text-blue-800">
              View Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 