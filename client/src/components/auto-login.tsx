import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function useAutoLogin() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const { data: currentUser, isError } = useQuery({
    queryKey: ['/api/user/current'],
    retry: false
  });

  useEffect(() => {
    const attemptLogin = async () => {
      if (isError && !currentUser && !isLoggingIn) {
        setIsLoggingIn(true);
        try {
          await apiRequest("POST", "/api/auth/login", {
            email: "alumno1@miltareas.com",
            password: "123456"
          });
          window.location.reload();
        } catch (error) {
          console.warn('[AUTO_LOGIN] Failed:', error);
          setIsLoggingIn(false);
        }
      }
    };

    // Delay to avoid immediate login on load
    const timer = setTimeout(attemptLogin, 1000);
    return () => clearTimeout(timer);
  }, [isError, currentUser, isLoggingIn]);

  return { currentUser, isLoggingIn };
}