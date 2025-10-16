
'use client';

import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768

/**
 * A client-side hook to determine if the user is on a mobile-sized screen.
 * Returns `false` on the server and during initial client render to prevent
 * hydration mismatches, then updates to the correct value on the client.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const checkDevice = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Run the check once on mount
    checkDevice();

    // Add event listener for window resize
    window.addEventListener("resize", checkDevice);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", checkDevice);
    };
  }, []);

  return isMounted ? isMobile : false;
}
