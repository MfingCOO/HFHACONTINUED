
'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: { [key: string]: unknown }[];
  }
}

// The component now accepts a slotId to specify which ad to show.
export function GoogleAd({ slotId }: { slotId: string }) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // This effect hook is now more robust.
    // It checks if the ad slot has already been filled by Google's script.
    // The `data-ad-status="filled"` attribute is added by the adsbygoogle script itself.
    if (adRef.current && adRef.current.getAttribute("data-ad-status") !== "filled") {
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.error(err);
        }
    }
  }, [slotId]); // The effect re-runs if the slotId changes.

  return (
    <div className="text-center my-4 h-16 flex items-center justify-center">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}
