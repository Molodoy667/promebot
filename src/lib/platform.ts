/**
 * Визначає чи додаток запущений як APK
 */
export function isAndroidAPK(): boolean {
  // Capacitor Android
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return (window as any).Capacitor.getPlatform() === 'android';
  }
  
  // User agent detection
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent || '';
    // Якщо це Android WebView (не браузер)
    return /Android/i.test(userAgent) && !/Chrome/i.test(userAgent);
  }
  
  return false;
}

/**
 * Визначає чи це веб версія
 */
export function isWeb(): boolean {
  return !isAndroidAPK();
}
