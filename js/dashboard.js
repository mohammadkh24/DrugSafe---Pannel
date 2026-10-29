const elements = {
  drugsCount: document.getElementById('drugsCount'),
  interactionsCount: document.getElementById('interactionsCount'),
  apiStatus: document.getElementById('apiStatus'),
  apiDescription: document.getElementById('apiDescription'),
  serverStatus: document.getElementById('serverStatus'),
  refreshBtn: document.getElementById('refreshBtn'),
  toast: document.getElementById('toast'),
};

function extractCount(response) {
  const body = response?.data ?? response;

  if (Array.isArray(body)) {
    return body.length;
  }

  if (Array.isArray(body?.items)) {
    return body.meta?.total ?? body.items.length;
  }

  if (typeof body?.total === 'number') {
    return body.total;
  }

  return null;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');

  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

function setServerStatus(online) {
  elements.serverStatus.textContent = online
    ? 'متصل'
    : 'عدم اتصال';

  elements.serverStatus.style.color = online
    ? '#16a34a'
    : '#fca5a5';

  elements.apiStatus.textContent = online
    ? 'متصل'
    : 'نامشخص';

  elements.apiDescription.textContent = online
    ? 'سرور پاسخ‌گو است'
    : 'اتصال به API برقرار نشد';

  elements.apiStatus.style.color = online
    ? '#16a34a'
    : '#fca5a5';
}

async function fetchCount(endpoint) {
  const response = await (window.apiFetch ? window.apiFetch(endpoint) : fetch(`${API_BASE_URL}${endpoint}`));

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  return extractCount(result);
}

async function loadDashboard() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = 'در حال دریافت...';

  elements.drugsCount.textContent = '—';
  elements.interactionsCount.textContent = '—';

  try {
    const [drugsCount, interactionsCount] = await Promise.all([
      fetchCount('/drugs?page=1&limit=1'),
      fetchCount('/interactions?page=1&limit=1'),
    ]);

    elements.drugsCount.textContent =
      drugsCount === null ? '—' : drugsCount.toLocaleString('fa-IR');

    elements.interactionsCount.textContent =
      interactionsCount === null
        ? '—'
        : interactionsCount.toLocaleString('fa-IR');

    setServerStatus(true);
  } catch (error) {
    console.error('Dashboard API error:', error);

    setServerStatus(false);

    showToast(
      'دریافت اطلاعات ناموفق بود. وضعیت سرور و تنظیمات CORS را بررسی کن.',
    );
  } finally {
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.textContent = '↻ به‌روزرسانی';
  }
}

elements.refreshBtn.addEventListener('click', loadDashboard);

loadDashboard();
