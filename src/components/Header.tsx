import React from 'react';
import { logout } from '../services/api';

interface Props {
  authenticated: boolean;
  orgName?: string | null;
  isSandbox?: boolean;
}

export const Header: React.FC<Props> = ({ authenticated, orgName, isSandbox }) => {
  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <header style={{
      backgroundColor: '#1a2f4e',
      color: 'white',
      padding: '14px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      <div>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.01em' }}>
          SF Notes &amp; Attachments — Phase 1 Inventory &amp; Assessment
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {orgName && (
          <span style={{ fontSize: '0.85rem', color: '#a8c4e0' }}>
            {orgName}
            {isSandbox && (
              <span style={{
                marginLeft: '8px',
                backgroundColor: '#f39c12',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>Sandbox</span>
            )}
          </span>
        )}
        {authenticated && (
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            Disconnect
          </button>
        )}
      </div>
    </header>
  );
};
