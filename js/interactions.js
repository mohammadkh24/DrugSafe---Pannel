// -----------------------------
// وضعیت اتصال به سرور
// -----------------------------

async function checkServerConnection() {
    const serverStatus = document.querySelector('#serverStatus');
    const serverDot = document.querySelector('#serverDot');
  
    if (!serverStatus || !serverDot) return;
  
    try {
      const response = await (window.apiFetch ? window.apiFetch('/drugs?page=1&limit=1') : fetch(`${API_BASE_URL}/drugs?page=1&limit=1`));
  
      if (!response.ok) {
        throw new Error('Server unavailable');
      }
  
      serverStatus.textContent = 'متصل';
      serverStatus.style.color = '#16a34a';
      serverDot.style.backgroundColor = '#16a34a';
    } catch (error) {
      serverStatus.textContent = 'قطع اتصال';
      serverStatus.style.color = '#ef4444';
      serverDot.style.backgroundColor = '#ef4444';
    }
  }
  
  checkServerConnection();
(() => {
    'use strict';
  
    const API_BASE_URL = (
      window.API_BASE_URL || 'http://localhost:3000'
    ).replace(/\/+$/, '');
  
    const $ = (selector) => document.querySelector(selector);
  
    // جدول و فیلترها
    const tableBody = $('#interactionsTableBody');
    const searchInput = $('#interactionSearch');
    const severityFilter = $('#severityFilter');
    const refreshButton = $('#refreshInteractionsBtn');
  
    // آمار
    const totalInteractions = $('#totalInteractions');
    const highRiskInteractions = $('#highRiskInteractions');
    const moderateRiskInteractions = $('#moderateRiskInteractions');
    const lowRiskInteractions = $('#lowRiskInteractions');
  
    // فرم
    const modal = $('#interactionModal');
    const form = $('#interactionForm');
    const drugASelect = $('#drugAId');
    const drugBSelect = $('#drugBId');
    const severitySelect = $('#interactionSeverity');
    const descriptionInput = $('#interactionDescription');
    const recommendationInput = $('#interactionRecommendation');
    const formMessage = $('#interactionFormMessage');
    const submitButton = $('#submitInteractionBtn');
    const addButton = $('#addInteractionBtn');
    const closeButton = $('#closeInteractionModal');
    const cancelButton = $('#cancelInteractionForm');
  
    let allInteractions = [];
    let allDrugs = [];
    let isLoading = false;
    let isSubmitting = false;
  
    // -----------------------------
    // API
    // -----------------------------
  
    async function request(path, options = {}) {
      const response = await (window.apiFetch ? window.apiFetch(path, {
        ...options,
        headers: {
          ...(options.body
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...options.headers,
        },
      }) : fetch(`${API_BASE_URL}${path}`, { ...options }));
  
      const text = await response.text();
      let result = {};
  
      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        result = { message: text };
      }
  
      if (!response.ok) {
        const message = Array.isArray(result.message)
          ? result.message.join('، ')
          : result.message;
  
        throw new Error(
          message || `خطای سرور (${response.status})`
        );
      }
  
      return result;
    }
  
    function getList(result) {
      if (Array.isArray(result)) return result;
      if (Array.isArray(result.data)) return result.data;
      if (Array.isArray(result.data?.items)) {
        return result.data.items;
      }
      if (Array.isArray(result.items)) return result.items;
  
      return [];
    }
  
    function escapeHTML(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[char]);
    }
  
    // -----------------------------
    // پیام‌ها
    // -----------------------------
  
    function showTableMessage(message, type = '') {
      if (!tableBody) return;
  
      const className = type
        ? `table-message ${type}`
        : 'table-message';
  
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="${className}">
            ${escapeHTML(message)}
          </td>
        </tr>
      `;
    }
  
    function showFormMessage(message, type = 'error') {
      if (!formMessage) return;
  
      formMessage.textContent = message;
      formMessage.className =
        `interaction-form-message ${type}`;
      formMessage.hidden = false;
    }
  
    function clearFormMessage() {
      if (!formMessage) return;
  
      formMessage.textContent = '';
      formMessage.hidden = true;
    }
  
    // -----------------------------
    // داروها
    // -----------------------------
  
    function getDrugName(drug) {
      if (!drug) return null;
      if (typeof drug === 'string') return drug;
  
      return (
        drug.genericName ||
        drug.brandName ||
        drug.name ||
        drug.title ||
        null
      );
    }
  
    function getDrugLabel(interaction, side) {
      const relation = interaction[side];
      const id = interaction[`${side}Id`];
  
      const relationName = getDrugName(relation);
      if (relationName) return relationName;
  
      const drug = allDrugs.find(
        (item) => String(item.id) === String(id)
      );
  
      return getDrugName(drug) || `شناسه ${id ?? 'نامشخص'}`;
    }
  
    async function loadDrugs() {
      if (!drugASelect || !drugBSelect) return;
  
      try {
        const result = await request('/drugs?page=1&limit=100');
        allDrugs = getList(result);
  
        const currentA = drugASelect.value;
        const currentB = drugBSelect.value;
  
        const options = allDrugs.map((drug) => {
          const name = getDrugName(drug) || `دارو ${drug.id}`;
  
          return `
            <option value="${escapeHTML(drug.id)}">
              ${escapeHTML(name)}
            </option>
          `;
        }).join('');
  
        drugASelect.innerHTML = `
          <option value="">داروی اول را انتخاب کنید</option>
          ${options}
        `;
  
        drugBSelect.innerHTML = `
          <option value="">داروی دوم را انتخاب کنید</option>
          ${options}
        `;
  
        if (allDrugs.some(
          (drug) => String(drug.id) === currentA
        )) {
          drugASelect.value = currentA;
        }
  
        if (allDrugs.some(
          (drug) => String(drug.id) === currentB
        )) {
          drugBSelect.value = currentB;
        }
      } catch (error) {
        console.error('خطا در دریافت داروها:', error);
  
        showFormMessage(
          `دریافت فهرست داروها ناموفق بود: ${error.message}`
        );
      }
    }
  
    // -----------------------------
    // سطح خطر
    // -----------------------------
  
    function getSeverityInfo(severity) {
      const levels = {
        HIGH: {
          label: 'خطر بالا',
          className: 'severity-high',
        },
        MODERATE: {
          label: 'خطر متوسط',
          className: 'severity-moderate',
        },
        LOW: {
          label: 'خطر پایین',
          className: 'severity-low',
        },
      };
  
      const key = String(severity || '').toUpperCase();
  
      return levels[key] || {
        label: severity || 'نامشخص',
        className: 'severity-unknown',
      };
    }
  
    // -----------------------------
    // آمار
    // -----------------------------
  
    function updateStats(interactions) {
      if (totalInteractions) {
        totalInteractions.textContent = interactions.length;
      }
  
      if (highRiskInteractions) {
        highRiskInteractions.textContent = interactions.filter(
          (item) =>
            String(item.severity).toUpperCase() === 'HIGH'
        ).length;
      }
  
      if (moderateRiskInteractions) {
        moderateRiskInteractions.textContent = interactions.filter(
          (item) =>
            String(item.severity).toUpperCase() === 'MODERATE'
        ).length;
      }
  
      if (lowRiskInteractions) {
        lowRiskInteractions.textContent = interactions.filter(
          (item) =>
            String(item.severity).toUpperCase() === 'LOW'
        ).length;
      }
    }
  
    // -----------------------------
    // جست‌وجو و فیلتر
    // -----------------------------
  
    function getFilteredInteractions() {
      const search = (searchInput?.value || '')
        .trim()
        .toLocaleLowerCase();
  
      const severity = (severityFilter?.value || '')
        .toUpperCase();
  
      return allInteractions.filter((interaction) => {
        const drugA = getDrugLabel(interaction, 'drugA');
        const drugB = getDrugLabel(interaction, 'drugB');
  
        const searchableText = [
          drugA,
          drugB,
          interaction.description,
          interaction.recommendation,
          interaction.severity,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();
  
        const matchesSearch =
          !search || searchableText.includes(search);
  
        const matchesSeverity =
          !severity ||
          String(interaction.severity).toUpperCase() === severity;
  
        return matchesSearch && matchesSeverity;
      });
    }
  
    // -----------------------------
    // رندر جدول
    // -----------------------------
  
    function renderInteractions() {
      if (!tableBody) return;
  
      const interactions = getFilteredInteractions();
  
      if (interactions.length === 0) {
        showTableMessage(
          allInteractions.length === 0
            ? 'هنوز تعاملی ثبت نشده است.'
            : 'تعامل موردنظر پیدا نشد.'
        );
  
        return;
      }
  
      tableBody.innerHTML = interactions.map(
        (interaction, index) => {
          const id = interaction.id;
          const drugA = getDrugLabel(interaction, 'drugA');
          const drugB = getDrugLabel(interaction, 'drugB');
          const severity = getSeverityInfo(interaction.severity);
  
          const description = interaction.description || '—';
          const recommendation = interaction.recommendation;
  
          return `
            <tr>
              <!-- ردیف -->
              <td class="interaction-row-number">
                ${index + 1}
              </td>
  
              <!-- داروی اول -->
              <td class="interaction-drug">
                ${escapeHTML(drugA)}
              </td>
  
              <!-- داروی دوم -->
              <td class="interaction-drug">
                ${escapeHTML(drugB)}
              </td>
  
              <!-- سطح خطر -->
              <td>
                <span class="severity-badge ${severity.className}">
                  ${escapeHTML(severity.label)}
                </span>
              </td>
  
              <!-- توضیحات و توصیه -->
              <td class="interaction-description">
                <div class="interaction-description-text">
                  ${escapeHTML(description)}
                </div>
  
                ${
                  recommendation
                    ? `
                      <div class="interaction-recommendation">
                        <span>توصیه:</span>
                        ${escapeHTML(recommendation)}
                      </div>
                    `
                    : ''
                }
              </td>
  
              <!-- عملیات -->
              <td class="interaction-actions">
                <button
                  type="button"
                  class="delete-interaction-btn"
                  data-delete-id="${escapeHTML(id)}"
                  aria-label="حذف تعامل"
                  title="حذف تعامل"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18"/>
                    <path d="M8 6V4h8v2"/>
                    <path d="m19 6-1 14H6L5 6"/>
                    <path d="M10 11v5"/>
                    <path d="M14 11v5"/>
                  </svg>
                  <span>حذف</span>
                </button>
              </td>
            </tr>
          `;
        }
      ).join('');
    }
  
    // -----------------------------
    // دریافت تعاملات
    // -----------------------------
  
    async function loadInteractions() {
      if (!tableBody || isLoading) return;
  
      isLoading = true;
      showTableMessage('در حال دریافت اطلاعات...');
  
      try {
        const result = await request(
          '/interactions?page=1&limit=100'
        );
  
        allInteractions = getList(result).filter(
          (item) => item.isActive !== false
        );
  
        updateStats(allInteractions);
        renderInteractions();
      } catch (error) {
        console.error('خطا در دریافت تعاملات:', error);
  
        showTableMessage(
          `دریافت تعاملات ناموفق بود: ${error.message}`,
          'error'
        );
      } finally {
        isLoading = false;
      }
    }
  
    window.loadInteractions = loadInteractions;
  
    // -----------------------------
    // باز و بسته کردن مودال
    // -----------------------------
  
    async function openModal() {
      if (!modal) return;
  
      modal.classList.add('is-open');
      document.body.classList.add('modal-open');
  
      clearFormMessage();
      await loadDrugs();
    }
  
    function closeModal() {
      if (!modal) return;
  
      modal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
  
      form?.reset();
      clearFormMessage();
    }
  
    addButton?.addEventListener('click', openModal);
    closeButton?.addEventListener('click', closeModal);
    cancelButton?.addEventListener('click', closeModal);
  
    modal?.querySelectorAll('[data-close-modal]').forEach(
      (element) => {
        element.addEventListener('click', closeModal);
      }
    );
  
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal?.classList.contains('is-open')) {
        closeModal();
      }
    });
  
    // -----------------------------
    // ثبت تعامل
    // -----------------------------
  
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
  
      if (isSubmitting) return;
  
      clearFormMessage();
  
      const drugAId = drugASelect?.value;
      const drugBId = drugBSelect?.value;
      const severity = severitySelect?.value;
      const description = descriptionInput?.value.trim();
      const recommendation = recommendationInput?.value.trim();
  
      if (!drugAId || !drugBId) {
        showFormMessage('لطفاً هر دو دارو را انتخاب کنید.');
        return;
      }
  
      if (String(drugAId) === String(drugBId)) {
        showFormMessage(
          'نمی‌توانید یک دارو را در هر دو فیلد انتخاب کنید.'
        );
        return;
      }
  
      if (!severity || !description) {
        showFormMessage(
          'لطفاً سطح خطر و توضیحات را وارد کنید.'
        );
        return;
      }
  
      const toId = (value) =>
        Number.isNaN(Number(value)) ? value : Number(value);
  
      const payload = {
        drugAId: toId(drugAId),
        drugBId: toId(drugBId),
        severity,
        description,
        ...(recommendation ? { recommendation } : {}),
      };
  
      isSubmitting = true;
  
      const originalButtonText = submitButton?.textContent;
  
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'در حال ثبت...';
      }
  
      try {
        await request('/interactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
  
        showFormMessage('تعامل با موفقیت ثبت شد.', 'success');
  
        await loadInteractions();
  
        window.setTimeout(closeModal, 700);
      } catch (error) {
        console.error('خطا در ثبت تعامل:', error);
  
        showFormMessage(
          `ثبت تعامل ناموفق بود: ${error.message}`
        );
      } finally {
        isSubmitting = false;
  
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent =
            originalButtonText || 'ثبت تعامل';
        }
      }
    });
  
    // -----------------------------
    // حذف تعامل
    // -----------------------------
  
    tableBody?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-delete-id]');
  
      if (!button || button.disabled) return;
  
      const id = button.dataset.deleteId;
      if (!id) return;
  
      const confirmed = window.confirm(
        'آیا از حذف این تعامل مطمئن هستید؟'
      );
  
      if (!confirmed) return;
  
      button.disabled = true;
  
      try {
        await request(
          `/interactions/${encodeURIComponent(id)}`,
          { method: 'DELETE' }
        );
  
        await loadInteractions();
      } catch (error) {
        console.error('خطا در حذف تعامل:', error);
  
        window.alert(`حذف تعامل ناموفق بود: ${error.message}`);
        button.disabled = false;
      }
    });
  
    // -----------------------------
    // فیلترها و تازه‌سازی
    // -----------------------------
  
    searchInput?.addEventListener('input', renderInteractions);
    severityFilter?.addEventListener('change', renderInteractions);
    refreshButton?.addEventListener('click', loadInteractions);
  
    document.addEventListener(
      'interactions:refresh',
      loadInteractions
    );
  
    // ابتدا داروها را بگیر تا نام داروهای جدول هم قابل نمایش باشد.
    async function initialize() {
      await loadDrugs();
      await loadInteractions();
    }
  
    initialize();
  })();
  