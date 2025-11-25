import { useEffect, useState } from "react";

export default function AdBanner() {
  const [collapsed, setCollapsed] = useState(false);

  // Tell AdSense to render the ad once the component mounts
  useEffect(() => {
    try {
      if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
        window.adsbygoogle.push({});
      }
    } catch (e) {
      // fail silently – ad blocker, etc.
    }
  }, []);

  return (
    <div className={`ad-banner-container ${collapsed ? "collapsed" : ""}`}>
      {/* Collapse / expand button */}
      <button
        className="ad-toggle-btn"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? "▲ Show ad" : "▼ Hide ad"}
      </button>

      {collapsed ? (
        <div
          className="collapsed-bar"
          onClick={() => setCollapsed(false)}
        >
          Ad hidden • tap to show
        </div>
      ) : (
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", height: "60px" }}
          data-ad-client="ca-pub-9854258094112554"
          data-ad-slot="YOUR_SLOT_ID_HERE"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}