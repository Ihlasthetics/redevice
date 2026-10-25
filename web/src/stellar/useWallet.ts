import { useCallback, useEffect, useRef, useState } from "react";
import { connectWallet, getConnectedWallet } from "./client";

export function useWallet() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      const observedGeneration = generation.current;
      try {
        const account = await getConnectedWallet();
        if (active && observedGeneration === generation.current)
          setWallet(account);
      } catch {
        if (active && observedGeneration === generation.current)
          setWallet(null);
      } finally {
        pending = false;
        if (active) setChecking(false);
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 3000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const connect = useCallback(async () => {
    const account = await connectWallet();
    generation.current += 1;
    setWallet(account);
    setChecking(false);
    return account;
  }, []);

  return { wallet, checking, connect };
}
