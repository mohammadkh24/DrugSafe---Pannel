
(() => {
  "use strict";

  const tokenKey = "drugSafeAccessToken";
  const userKey = "drugSafeUser";

  const getCurrentPage = () =>
    location.pathname.split("/").pop() || "index.html";

  const isLoginPage = () => getCurrentPage() === "login.html";

  // صفحه ورود و لندینگ عمومی هستند.
  const isPublicPage = () =>
    ["login.html", "landing.html"].includes(getCurrentPage());

  const getToken = () => localStorage.getItem(tokenKey);

  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem(userKey) || "{}");
    } catch {
      return {};
    }
  };

  const logout = () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);

    if (!isLoginPage()) {
      location.replace("login.html");
    }
  };

  // جلوگیری از دسترسی به صفحات محافظت‌شده بدون توکن
  if (!isPublicPage() && !getToken()) {
    location.replace("login.html");
    return;
  }

  // جلوگیری از نمایش صفحه ورود برای کاربر واردشده
  if (isLoginPage() && getToken()) {
    location.replace("index.html");
    return;
  }

  window.getDrugSafeToken = getToken;
  window.getDrugSafeUser = getUser;
  window.logoutDrugSafe = logout;

  window.apiFetch = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    const token = getToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const baseUrl = (
      window.API_BASE_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const normalizedPath = path.startsWith("/")
      ? path
      : `/${path}`;

    const response = await fetch(
      `${baseUrl}${normalizedPath}`,
      {
        ...options,
        headers,
      }
    );

    // نشست نامعتبر یا منقضی‌شده
    if (response.status === 401 && !isLoginPage()) {
      logout();
    }

    return response;
  };

  document.addEventListener("DOMContentLoaded", () => {
    // دکمه خروج
    const logoutButton = document.getElementById("logoutBtn");

    if (logoutButton) {
      logoutButton.addEventListener("click", logout);
    }

    // نمایش نام کاربر واردشده
    const nameElement = document.getElementById("currentUserName");

    if (nameElement) {
      const user = getUser();

      nameElement.textContent =
        user.fullName ||
        user.email ||
        "کاربر واردشده";
    }
  });
})();
