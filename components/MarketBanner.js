import { useEffect, useState } from 'react';

// This build talks to the Duncan database only, so the market is fixed here.
// (Cedar's build reads the same banner out of its markets table.)
const MARKET = {
  name: 'Duncan Farmers Market',
  primary: '#dc2626',
  secondary: '#7f1d1d',
  logo: '/logo-duncan.png',
};

export default function MarketBanner() {
  const [logoOk, setLogoOk] = useState(false);

  // Retheme the app in the market's colour.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--accent', MARKET.primary);
    root.style.setProperty('--accent-dim', MARKET.secondary);
  }, []);

  // Only show the logo once we know the file is really there, so a missing
  // file falls back to the initial instead of a broken-image icon.
  useEffect(() => {
    if (typeof window === 'undefined' || !MARKET.logo) return;
    let live = true;
    const probe = new window.Image();
    probe.onload = () => { if (live) setLogoOk(true); };
    probe.onerror = () => { if (live) setLogoOk(false); };
    probe.src = MARKET.logo;
    return () => { live = false; };
  }, []);

  return (
    <div className="market-banner" style={{ background: MARKET.primary, borderBottom: '3px solid ' + MARKET.secondary }}>
      <div className="market-banner-inner">
        {logoOk ? (
          <img className="market-banner-logo" src={MARKET.logo} alt={MARKET.name} />
        ) : (
          <span className="market-banner-logo market-banner-fallback">D</span>
        )}
        <span className="market-banner-name">{MARKET.name}</span>
      </div>
    </div>
  );
}
