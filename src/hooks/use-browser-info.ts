import { useState, useEffect } from "react";

interface BrowserInfo {
  browser: string;
  ip: string;
}

export const useBrowserInfo = () => {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>({
    browser: "Завантаження...",
    ip: "Завантаження...",
  });

  useEffect(() => {
    // Get browser info
    const userAgent = navigator.userAgent;
    let browserName = "Невідомий браузер";

    if (userAgent.includes("Firefox")) {
      browserName = "Firefox";
    } else if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
      browserName = "Chrome";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      browserName = "Safari";
    } else if (userAgent.includes("Edg")) {
      browserName = "Edge";
    } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
      browserName = "Opera";
    }

    // Get IP address
    fetch("https://api.ipify.org?format=json")
      .then((response) => response.json())
      .then((data) => {
        setBrowserInfo({
          browser: browserName,
          ip: data.ip,
        });
      })
      .catch(() => {
        setBrowserInfo({
          browser: browserName,
          ip: "Недоступно",
        });
      });
  }, []);

  return browserInfo;
};
