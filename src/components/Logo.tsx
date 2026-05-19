import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ className, variant = 'dark' }) => {
  const [imgSrc, setImgSrc] = useState<string>('/logo.png');
  const fallbackSrc = "https://lh3.googleusercontent.com/d/1vN7tAn7UoZ7rR7U7S-JtG0rY_iV7B56Q";

  useEffect(() => {
    // Only fetch settings if authenticated to avoid permission errors on login screen
    if (!auth.currentUser) return;

    const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.logoUrl) {
          setImgSrc(data.logoUrl);
        }
      }
    }, (error) => {
      // Silently fail if no permissions (e.g. during auth transition)
      console.log("Logo settings fetch failed (likely unauthenticated):", error.message);
    });

    return () => unsub();
  }, [auth.currentUser]);

  return (
    <div className={cn("flex flex-col items-center justify-center overflow-hidden", className)}>
      <img 
        src={imgSrc} 
        alt="Solar Trường Sơn Logo" 
        className={cn(
          "w-full h-full object-contain transition-all",
          variant === 'light' && "brightness-0 invert"
        )}
        onError={() => {
          if (imgSrc !== fallbackSrc) {
            setImgSrc(fallbackSrc);
          }
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
