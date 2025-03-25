import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { usePlaidLink } from 'react-plaid-link';
import App from '../__mocks__/App';

// Mock react-plaid-link
jest.mock('react-plaid-link', () => ({
  usePlaidLink: jest.fn()
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

describe('Plaid Integration', () => {
  const mockOnSuccess = jest.fn();
  const mockOnExit = jest.fn();
  const mockOpen = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the usePlaidLink hook implementation
    usePlaidLink.mockImplementation(() => ({
      open: mockOpen,
      ready: true,
      error: null
    }));

    // Mock fetch for link token
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ link_token: 'test-link-token' })
      })
    );
  });

  it('initializes Plaid Link when mounted', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5176/api/create-link-token',
        expect.any(Object)
      );
    });
  });

  it('opens Plaid Link when connect button is clicked', async () => {
    render(<App />);

    const connectButton = await screen.findByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);

    expect(mockOpen).toHaveBeenCalled();
  });

  it('handles Plaid Link success', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ link_token: 'test-link-token' })
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-access-token' })
        })
      );

    render(<App />);

    // Simulate successful link
    const metadata = {
      public_token: 'test-public-token',
      institution: { name: 'Test Bank' }
    };

    await waitFor(() => {
      usePlaidLink.mock.calls[0][0].onSuccess('test-public-token', metadata);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5176/api/exchange-token',
      expect.any(Object)
    );
  });
}); 