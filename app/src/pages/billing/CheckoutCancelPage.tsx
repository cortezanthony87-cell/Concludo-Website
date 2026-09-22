import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, XCircle, ArrowLeft, ArrowRight } from 'lucide-react';

export const CheckoutCancelPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#16263F',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#21395C',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #16263F 0%, #21395C 100%)',
            padding: '24px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Building2 size={24} color="#E2B53C" />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#E2B53C' }}>
              CONCLUDO PTY LTD
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              Checkout Cancelled
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 28px', textAlign: 'center' }}>
          <XCircle size={52} style={{ color: '#94a3b8', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '8px' }}>
            No Charges Were Made
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.92rem', marginBottom: '28px', lineHeight: '1.5' }}>
            Your checkout session was cancelled. If you have questions about our workbook packages or workspace tiers, our team is ready to assist.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link
              to="/checkout"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#E2B53C',
                color: '#16263F',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={16} /> Return to Pricing & Packages
            </Link>

            <Link
              to="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#16263F',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Enter Workspace Dashboard <ArrowRight size={16} />
            </Link>
          </div>

          <div
            style={{
              marginTop: '28px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.72rem',
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            All prices are indicative and in Australian dollars. Concludo Pty Ltd is not registered for GST, so no GST is charged. Melbourne, Australia.
          </div>
        </div>
      </div>
    </div>
  );
};
