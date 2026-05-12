import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ className, variant = 'dark' }) => {
  const [imgSrc, setImgSrc] = React.useState('/logo.png');
  const fallbackSrc = "https://lh3.googleusercontent.com/d/1vN7tAn7UoZ7rR7U7S-JtG0rY_iV7B56Q";

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
