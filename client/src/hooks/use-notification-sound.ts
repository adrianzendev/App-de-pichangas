import { useCallback, useRef } from 'react';
import paymentApprovedSound from '@/assets/sounds/payment-approved.mp3';

type SoundType = 'payment-approved';

const sounds: Record<SoundType, string> = {
  'payment-approved': paymentApprovedSound,
};

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback((type: SoundType, enabled: boolean = true) => {
    if (!enabled) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const audio = new Audio(sounds[type]);
      audioRef.current = audio;
      audio.volume = 0.7;
      audio.play().catch((err) => {
      });
    } catch (error) {
    }
  }, []);

  const stopSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return { playSound, stopSound };
}
