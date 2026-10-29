
const API_BASE_URL = 'http://localhost:3000';

const elements = {
  drugSearch: document.getElementById('drugSearch'),
  drugSearchResults: document.getElementById('drugSearchResults'),
  selectedDrugs: document.getElementById('selectedDrugs'),
  checkButton: document.getElementById('checkInteractionsBtn'),
  resetButton: document.getElementById('resetCheckBtn'),
  loading: document.getElementById('resultsLoading'),
  summary: document.getElementById('resultsSummary'),
  results: document.getElementById('interactionResults'),
  retryButton: document.getElementById('retryCheckBtn'),
  serverDot: document.getElementById('serverDot'),
  serverStatus: document.getElementById('serverStatus'),
};

let drugs = [];
let interactions = [];
let selectedDrugs = [];
let isChecking = false;

const severityInfo = {
  HIGH: {
    label: 'شدید',
    className: 'high',
  },
  MODERATE: {
    label: 'متوسط',
    className: 'moderate',
  },
  LOW: {
    label: 'خفیف',
    className: 'low',
  },
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return entities[char];
  });
}

function getItems(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  return [];
}

async function apiRequest(endpoint) {
  const response = await (window.apiFetch ? window.apiFetch(endpoint) : fetch(`${API_BASE_URL}${endpoint}`));

  if (!response.ok) {
    throw new Error(`خطای سرور: ${response.status}`);
  }

  return response.json();
}

function setServerStatus(isOnline, message) {
  if (elements.serverStatus) {
    elements.serverStatus.textContent = message;
  }

  if (elements.serverDot) {
    elements.serverDot.classList.toggle('online', isOnline);
    elements.serverDot.classList.toggle('offline', !isOnline);
  }
}

async function initializePage() {
  setServerStatus(false, 'در حال بررسی');

  try {
    const [drugsResponse, interactionsResponse] = await Promise.all([
      apiRequest('/drugs?page=1&limit=100'),
      apiRequest('/interactions?page=1&limit=100'),
    ]);

    drugs = getItems(drugsResponse);

    interactions = getItems(interactionsResponse).filter(
      (interaction) => interaction.isActive !== false,
    );

    setServerStatus(true, 'متصل');

    renderSelectedDrugs();
    renderDrugSearchResults();

    if (elements.summary) {
      elements.summary.innerHTML = `
        <p>تعداد داروهای موجود: ${drugs.length}</p>
        <p>تعداد تداخلات ثبت‌شده: ${interactions.length}</p>
      `;
    }
  } catch (error) {
    console.error('خطا در دریافت اطلاعات:', error);

    setServerStatus(false, 'عدم اتصال');

    showMessage(
      'دریافت اطلاعات با خطا مواجه شد. اتصال سرور و آدرس API را بررسی کن.',
      'error',
    );
  }
}

function getDrugId(drug) {
  return String(drug.id);
}

function getDrugName(drug) {
  return drug.genericName || drug.name || drug.brandName || 'داروی بدون نام';
}

function getDrugDetails(drug) {
  const parts = [
    drug.brandName && drug.brandName !== getDrugName(drug)
      ? drug.brandName
      : null,
    drug.strength,
    drug.dosageForm,
  ];

  return parts.filter(Boolean).join(' · ');
}

function renderDrugSearchResults() {
  if (!elements.drugSearchResults || !elements.drugSearch) {
    return;
  }

  const query = elements.drugSearch.value.trim().toLowerCase();

  if (!query) {
    elements.drugSearchResults.innerHTML = '';
    elements.drugSearchResults.hidden = true;
    return;
  }

  const matchedDrugs = drugs
    .filter((drug) => {
      const searchableText = [
        getDrugName(drug),
        drug.brandName,
        drug.strength,
        drug.dosageForm,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    })
    .filter(
      (drug) =>
        !selectedDrugs.some(
          (selected) => getDrugId(selected) === getDrugId(drug),
        ),
    )
    .slice(0, 10);

  if (!matchedDrugs.length) {
    elements.drugSearchResults.innerHTML = `
      <div class="search-empty">دارویی پیدا نشد.</div>
    `;
    elements.drugSearchResults.hidden = false;
    return;
  }

  elements.drugSearchResults.innerHTML = matchedDrugs
    .map(
      (drug) => `
        <button
          type="button"
          class="drug-search-item"
          data-drug-id="${escapeHtml(getDrugId(drug))}"
        >
          <span class="drug-search-name">
            ${escapeHtml(getDrugName(drug))}
          </span>
          <small>${escapeHtml(getDrugDetails(drug) || 'بدون اطلاعات تکمیلی')}</small>
        </button>
      `,
    )
    .join('');

  elements.drugSearchResults.hidden = false;
}

function renderSelectedDrugs() {
  if (!elements.selectedDrugs) {
    return;
  }

  if (!selectedDrugs.length) {
    elements.selectedDrugs.innerHTML = `
      <div class="selected-drugs-empty">
        هنوز دارویی انتخاب نکرده‌ای.
      </div>
    `;
  } else {
    elements.selectedDrugs.innerHTML = selectedDrugs
      .map(
        (drug) => `
          <div class="selected-drug-item">
            <div class="selected-drug-info">
              <strong>${escapeHtml(getDrugName(drug))}</strong>
              <small>${escapeHtml(getDrugDetails(drug))}</small>
            </div>

            <button
              type="button"
              class="remove-drug-btn"
              data-remove-drug="${escapeHtml(getDrugId(drug))}"
              aria-label="حذف ${escapeHtml(getDrugName(drug))}"
              title="حذف دارو"
            >
              ×
            </button>
          </div>
        `,
      )
      .join('');
  }

  if (elements.checkButton) {
    elements.checkButton.disabled =
      selectedDrugs.length < 2 || isChecking;
  }

  if (elements.drugSearch) {
    elements.drugSearch.disabled = isChecking;
  }

  renderDrugSearchResults();
}

function addDrug(drugId) {
  const drug = drugs.find(
    (item) => getDrugId(item) === String(drugId),
  );

  if (!drug) {
    return;
  }

  const alreadySelected = selectedDrugs.some(
    (item) => getDrugId(item) === getDrugId(drug),
  );

  if (alreadySelected) {
    return;
  }

  selectedDrugs.push(drug);

  if (elements.drugSearch) {
    elements.drugSearch.value = '';
  }

  clearResults();
  renderSelectedDrugs();
}

function removeDrug(drugId) {
  selectedDrugs = selectedDrugs.filter(
    (drug) => getDrugId(drug) !== String(drugId),
  );

  clearResults();
  renderSelectedDrugs();
}

function getInteractionDrugId(interaction, side) {
  const relation = interaction[side];

  if (relation && typeof relation === 'object') {
    return relation.id == null ? null : String(relation.id);
  }

  const idField = `${side}Id`;

  return interaction[idField] == null
    ? null
    : String(interaction[idField]);
}

function findInteractions() {
  const selectedIds = new Set(
    selectedDrugs.map((drug) => getDrugId(drug)),
  );

  return interactions.filter((interaction) => {
    const drugAId = getInteractionDrugId(interaction, 'drugA');
    const drugBId = getInteractionDrugId(interaction, 'drugB');

    return (
      drugAId !== null &&
      drugBId !== null &&
      selectedIds.has(drugAId) &&
      selectedIds.has(drugBId)
    );
  });
}

function renderInteractionResults(foundInteractions) {
  if (!elements.results) {
    return;
  }

  if (!foundInteractions.length) {
    elements.results.innerHTML = `
      <div class="check-result-empty">
        <h3>تداخل ثبت‌شده‌ای پیدا نشد</h3>
        <p>
          در اطلاعات فعلی سامانه، تداخلی بین داروهای انتخاب‌شده
          ثبت نشده است. این نتیجه به معنی بی‌خطر بودن قطعی ترکیب داروها نیست.
        </p>
      </div>
    `;

    return;
  }

  elements.results.innerHTML = foundInteractions
    .map((interaction) => {
      const severity =
        severityInfo[String(interaction.severity || '').toUpperCase()] || {
          label: interaction.severity || 'نامشخص',
          className: 'unknown',
        };

      const drugA =
        interaction.drugA && typeof interaction.drugA === 'object'
          ? interaction.drugA
          : drugs.find(
              (drug) =>
                getDrugId(drug) ===
                getInteractionDrugId(interaction, 'drugA'),
            );

      const drugB =
        interaction.drugB && typeof interaction.drugB === 'object'
          ? interaction.drugB
          : drugs.find(
              (drug) =>
                getDrugId(drug) ===
                getInteractionDrugId(interaction, 'drugB'),
            );

      return `
        <article class="interaction-result-card severity-${escapeHtml(severity.className)}">
          <div class="interaction-result-header">
            <div class="interaction-drug-pair">
              <strong>${escapeHtml(getDrugName(drugA || {}))}</strong>
              <span>↔</span>
              <strong>${escapeHtml(getDrugName(drugB || {}))}</strong>
            </div>

            <span class="severity-badge severity-${escapeHtml(severity.className)}">
              ${escapeHtml(severity.label)}
            </span>
          </div>

          <div class="interaction-result-body">
            <p>${escapeHtml(interaction.description || 'توضیحی ثبت نشده است.')}</p>

            ${
              interaction.recommendation
                ? `
                  <div class="interaction-recommendation">
                    <strong>توصیه:</strong>
                    <p>${escapeHtml(interaction.recommendation)}</p>
                  </div>
                `
                : ''
            }
          </div>
        </article>
      `;
    })
    .join('');
}

function updateSummary(foundInteractions) {
  if (!elements.summary) {
    return;
  }

  const counts = {
    HIGH: 0,
    MODERATE: 0,
    LOW: 0,
  };

  foundInteractions.forEach((interaction) => {
    const severity = String(interaction.severity || '').toUpperCase();

    if (Object.prototype.hasOwnProperty.call(counts, severity)) {
      counts[severity]++;
    }
  });

  elements.summary.innerHTML = `
    <div class="summary-stat">
      <span>داروهای انتخاب‌شده</span>
      <strong>${selectedDrugs.length}</strong>
    </div>

    <div class="summary-stat">
      <span>تداخلات پیدا‌شده</span>
      <strong>${foundInteractions.length}</strong>
    </div>

    <div class="summary-stat">
      <span>شدید</span>
      <strong>${counts.HIGH}</strong>
    </div>

    <div class="summary-stat">
      <span>متوسط</span>
      <strong>${counts.MODERATE}</strong>
    </div>

    <div class="summary-stat">
      <span>خفیف</span>
      <strong>${counts.LOW}</strong>
    </div>
  `;
}

function showMessage(message, type = 'info') {
  if (elements.results) {
    elements.results.innerHTML = `
      <div class="check-message check-message-${escapeHtml(type)}">
        ${escapeHtml(message)}
      </div>
    `;
  }
}

function clearResults() {
  if (elements.summary) {
    elements.summary.innerHTML = '';
  }

  if (elements.results) {
    elements.results.innerHTML = '';
  }

  if (elements.loading) {
    elements.loading.hidden = true;
  }
}

async function checkInteractions() {
  if (selectedDrugs.length < 2 || isChecking) {
    showMessage('برای بررسی، حداقل دو دارو انتخاب کن.', 'error');
    return;
  }

  isChecking = true;
  renderSelectedDrugs();

  if (elements.loading) {
    elements.loading.hidden = false;
  }

  if (elements.results) {
    elements.results.innerHTML = '';
  }

  try {
    // تداخلات از API دریافت شده‌اند؛ اینجا زوج‌های انتخاب‌شده
    // با رکوردهای ثبت‌شده در پایگاه داده مقایسه می‌شوند.
    const foundInteractions = findInteractions();

    renderInteractionResults(foundInteractions);
    updateSummary(foundInteractions);
  } catch (error) {
    console.error('خطا در بررسی تداخلات:', error);
    showMessage('بررسی تداخلات با خطا مواجه شد.', 'error');
  } finally {
    isChecking = false;

    if (elements.loading) {
      elements.loading.hidden = true;
    }

    renderSelectedDrugs();
  }
}

function resetCheck() {
  selectedDrugs = [];

  if (elements.drugSearch) {
    elements.drugSearch.value = '';
  }

  clearResults();
  renderSelectedDrugs();
}

if (elements.drugSearch) {
  elements.drugSearch.addEventListener('input', renderDrugSearchResults);

  elements.drugSearch.addEventListener('focus', () => {
    if (elements.drugSearch.value.trim()) {
      renderDrugSearchResults();
    }
  });
}

if (elements.drugSearchResults) {
  elements.drugSearchResults.addEventListener('click', (event) => {
    const button = event.target.closest('[data-drug-id]');

    if (button) {
      addDrug(button.dataset.drugId);
    }
  });
}

if (elements.selectedDrugs) {
  elements.selectedDrugs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-drug]');

    if (button) {
      removeDrug(button.dataset.removeDrug);
    }
  });
}

if (elements.checkButton) {
  elements.checkButton.addEventListener('click', checkInteractions);
}

if (elements.resetButton) {
  elements.resetButton.addEventListener('click', resetCheck);
}

if (elements.retryButton) {
  elements.retryButton.addEventListener('click', initializePage);
}

document.addEventListener('click', (event) => {
  if (
    elements.drugSearchResults &&
    elements.drugSearch &&
    !elements.drugSearchResults.contains(event.target) &&
    !elements.drugSearch.contains(event.target)
  ) {
    elements.drugSearchResults.hidden = true;
  }
});

initializePage();
