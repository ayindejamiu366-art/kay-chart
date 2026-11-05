import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';

export default function PremiumUpgrade() {
  const navigate = useNavigate();
  const { setUserPlan, userPlan } = useApp();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const plans = {
    monthly: { price: '$9.99', period: '/mo', features: ['Ad-free listening', 'High-quality downloads', 'Offline mode', 'AI DJ unlimited'] },
    annual: { price: '$14.99', period: '/mo', save: 'Save 20%', features: ['Everything in Individual', 'Family sharing (up to 6)', 'Exclusive early releases'] },
  };

  const handleUpgrade = () => {
    setUpgrading(true);
    setTimeout(() => {
      setUserPlan('premium');
      setUpgrading(false);
      navigate('/profile', { replace: true });
    }, 2000);
  };

  const handleCancel = () => {
    setCancelling(true);
    setTimeout(() => {
      setUserPlan('free');
      setCancelling(false);
      setShowCancelConfirm(false);
      navigate('/profile', { replace: true });
    }, 1000);
  };

  if (userPlan === 'premium') {
    return (
      <div className="min-h-screen flex flex-col bg-background relative overflow-hidden px-6 page-enter">
        <div className="ambient-glow ambient-glow-animated" />
        <div className="absolute top-[-20%] left-[-20%] w-80 h-80 bg-primary rounded-full blur-[120px] opacity-5 pointer-events-none" />
        <button onClick={() => navigate(-1)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface z-10">
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="flex-1 flex flex-col items-center pt-16 relative z-10">
          <div className="bg-gradient-to-r from-[#D6FF3D] to-[#9FE81F] w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(214,255,61,0.4)]">
            <span className="material-symbols-outlined text-background text-[32px] icon-fill">auto_awesome</span>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 text-on-surface">You're on Kay Chart Pro</h1>
          <p className="text-base text-on-surface-variant text-center mb-8 max-w-xs">
            Ad-free listening, high-quality downloads, offline mode, and unlimited AI DJ are all active on your account.
          </p>

          {showCancelConfirm ? (
            <div className="w-full max-w-md bg-surface-dim border border-border-subtle rounded-2xl p-5">
              <p className="text-on-surface font-semibold mb-1">Cancel Kay Chart Pro?</p>
              <p className="text-sm text-on-surface-variant mb-4">You'll lose ad-free listening, offline mode and unlimited AI DJ immediately.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowCancelConfirm(false)} className="flex-1 h-11 rounded-full border border-border-subtle text-on-surface hover:bg-surface-card-hover transition-colors">
                  Keep Pro
                </button>
                <button onClick={handleCancel} disabled={cancelling} className="flex-1 h-11 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors">
                  {cancelling ? 'Cancelling…' : 'Cancel plan'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCancelConfirm(true)} className="text-on-surface-variant hover:text-on-surface text-sm underline underline-offset-2">
              Cancel subscription
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden px-6 page-enter">
      <div className="ambient-glow ambient-glow-animated" />
      <div className="absolute top-[-20%] left-[-20%] w-80 h-80 bg-primary rounded-full blur-[120px] opacity-5 pointer-events-none" />
      <button onClick={() => navigate(-1)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface z-10">
        <span className="material-symbols-outlined">close</span>
      </button>

      <div className="flex-1 flex flex-col items-center pt-16 relative z-10">
        <div className="bg-gradient-to-r from-[#D6FF3D] to-[#9FE81F] w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(214,255,61,0.4)]">
          <span className="material-symbols-outlined text-background text-[32px] icon-fill">auto_awesome</span>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2" style={{ background: 'linear-gradient(135deg, #D6FF3D, #9FE81F)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Upgrade to<br />Kay Chart Pro
        </h1>

        <p className="text-base text-on-surface-variant text-center mb-8 max-w-xs">
          Unlock the full music experience with AI-powered features
        </p>

        <div className="flex flex-col gap-4 w-full max-w-md fade-up-1">
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`p-5 rounded-2xl border-2 text-left transition-all ${
              selectedPlan === 'monthly'
                ? 'border-primary bg-surface-card shadow-[0_0_20px_rgba(214,255,61,0.15)]'
                : 'border-medium bg-surface-dim hover:bg-surface-card-hover'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">Individual Pro</h3>
                <p className="text-sm text-on-surface-variant">Single user</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-on-surface">{plans.monthly.price}</p>
                <p className="text-sm text-on-surface-variant">{plans.monthly.period}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {plans.monthly.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[16px] icon-fill">check_circle</span>
                  <span className="text-sm text-on-surface-variant">{f}</span>
                </div>
              ))}
            </div>
          </button>

          <button
            onClick={() => setSelectedPlan('annual')}
            className={`p-5 rounded-2xl border-2 text-left transition-all relative ${
              selectedPlan === 'annual'
                ? 'border-primary bg-surface-card shadow-[0_0_20px_rgba(214,255,61,0.15)]'
                : 'border-medium bg-surface-dim hover:bg-surface-card-hover'
            }`}
          >
            <div className="absolute -top-3 left-4 bg-gradient-to-r from-[#D6FF3D] to-[#9FE81F] px-3 py-1 rounded-full">
              <span className="text-xs uppercase tracking-wider font-bold text-background">Recommended</span>
            </div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">Family Plan</h3>
                <p className="text-sm text-on-surface-variant">Up to 6 users</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-on-surface">{plans.annual.price}</p>
                <p className="text-sm text-on-surface-variant">{plans.annual.period} · <span className="text-primary">{plans.annual.save}</span></p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {plans.annual.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[16px] icon-fill">check_circle</span>
                  <span className="text-sm text-on-surface-variant">{f}</span>
                </div>
              ))}
            </div>
          </button>
        </div>
      </div>

      <div className="pb-8 pt-4 relative z-10 fade-up-2">
        <button onClick={handleUpgrade} disabled={upgrading} className="bg-primary hover:bg-primary-hover rounded-full h-14 w-full flex items-center justify-center font-semibold text-background press-feedback transition-all shadow-[0_0_20px_rgba(214,255,61,0.3)] glow-pulse">
          {upgrading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Processing...
            </div>
          ) : (
            'Start 30-Day Free Trial'
          )}
        </button>
        <p className="text-sm text-on-surface-variant text-center mt-3">Cancel anytime. Terms and conditions apply.</p>
      </div>
    </div>
  );
}
