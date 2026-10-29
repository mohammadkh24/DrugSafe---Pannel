
(() => {
    'use strict';
  
    const API_BASE_URL = (
      window.API_BASE_URL || 'http://localhost:3000'
    ).replace(/\/+$/, '');
  
    const state = {
      page: 1,
      limit: 10,
      total: 0,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      search: '',
      brandName: '',
      activeIngredient: '',
      dosageForm: '',
      isActive: '',
      editingId: null,
      loading: false,
      requestId: 0,
    };
  
    const $ = (selector) => document.querySelector(selector);
  
    const elements = {
      serverDot: $('#serverDot'),
      serverStatus: $('#serverStatus'),
      totalDrugs: $('#totalDrugs'),
      resultsText: $('#resultsText'),
      tableBody: $('#drugsTableBody'),
      pageInfo: $('#pageInfo'),
      prevPageBtn: $('#prevPageBtn'),
      nextPageBtn: $('#nextPageBtn'),
      addDrugBtn: $('#addDrugBtn'),
      refreshBtn: $('#refreshBtn'),
      filtersForm: $('#filtersForm'),
      searchInput: $('#searchInput'),
      brandFilter: $('#brandFilter'),
      ingredientFilter: $('#ingredientFilter'),
      formFilter: $('#formFilter'),
      statusFilter: $('#statusFilter'),
      sortBy: $('#sortBy'),
      sortOrder: $('#sortOrder'),
      clearFiltersBtn: $('#clearFiltersBtn'),
      pageSize: $('#pageSize'),
      modal: $('#drugModal'),
      modalTitle: $('#modalTitle'),
      closeModalBtn: $('#closeModalBtn'),
      cancelModalBtn: $('#cancelModalBtn'),
      drugForm: $('#drugForm'),
      saveDrugBtn: $('#saveDrugBtn'),
      toast: $('#toast'),
    };
  
    let searchTimer = null;
    let toastTimer = null;
    let previousFocus = null;
  
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]);
    }
  
    function unwrapResponse(payload) {
      let result = payload;
  
      // پشتیبانی از پاسخ‌هایی مانند { success: true, data: ... }
      for (let i = 0; i < 3; i += 1) {
        if (
          result &&
          typeof result === 'object' &&
          !Array.isArray(result) &&
          Object.prototype.hasOwnProperty.call(result, 'data')
        ) {
          result = result.data;
        } else {
          break;
        }
      }
  
      return result;
    }
  
    async function apiRequest(path, options = {}) {
      const headers = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      };
  
      let response;
  
      try {
        response = await (window.apiFetch ? window.apiFetch(path, {
          ...options,
          headers,
        }) : fetch(`${API_BASE_URL}${path}`, { ...options, headers }));
      } catch {
        setServerStatus(false);
        throw new Error(
          'ارتباط با سرور برقرار نشد. مطمئن شو بک‌اند در حال اجراست.'
        );
      }
  
      setServerStatus(true);
  
      if (!response.ok) {
        let message = `خطای سرور (${response.status})`;
  
        try {
          const errorBody = await response.json();
  
          if (Array.isArray(errorBody.message)) {
            message = errorBody.message.join('، ');
          } else if (errorBody.message) {
            message = errorBody.message;
          } else if (errorBody.error) {
            message = errorBody.error;
          }
        } catch {
          // ممکن است پاسخ خطا JSON نباشد.
        }
  
        throw new Error(message);
      }
  
      if (response.status === 204) {
        return null;
      }
  
      const text = await response.text();
  
      if (!text) {
        return null;
      }
  
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  
    
function setServerStatus(isOnline) {
    elements.serverDot.style.background = isOnline
      ? '#16a34a'
      : '#dc2626';
  
    elements.serverStatus.textContent = isOnline
      ? 'متصل'
      : 'عدم اتصال';
  
    elements.serverStatus.classList.toggle('connected', isOnline);
  }
  
  
    function showToast(message, type = 'success') {
      clearTimeout(toastTimer);
  
      elements.toast.textContent = message;
      elements.toast.className = `toast ${type} show`;
  
      toastTimer = setTimeout(() => {
        elements.toast.classList.remove('show');
      }, 3500);
    }
  
    function formatDate(value) {
      if (!value) return '—';
  
      const date = new Date(value);
  
      if (Number.isNaN(date.getTime())) {
        return '—';
      }
  
      try {
        return new Intl.DateTimeFormat('fa-IR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(date);
      } catch {
        return date.toLocaleDateString();
      }
    }
  
    function formatNumber(value) {
      const number = Number(value);
  
      return Number.isFinite(number)
        ? new Intl.NumberFormat('fa-IR').format(number)
        : '—';
    }
  
    function extractDrugList(payload) {
      const original = payload;
      const result = unwrapResponse(payload);
  
      if (Array.isArray(result)) {
        return {
          items: result,
          total: result.length,
          totalKnown: false,
        };
      }
  
      if (!result || typeof result !== 'object') {
        return {
          items: [],
          total: 0,
          totalKnown: true,
        };
      }
  
      const items =
        result.items ??
        result.results ??
        result.drugs ??
        result.records ??
        result.data?.items ??
        [];
  
      const meta = result.meta ?? result.pagination ?? {};
  
      const totalValue =
        result.total ??
        result.totalItems ??
        result.totalCount ??
        meta.total ??
        meta.totalItems ??
        meta.totalCount ??
        original?.meta?.total;
  
      const totalKnown =
        totalValue !== undefined &&
        totalValue !== null &&
        Number.isFinite(Number(totalValue));
  
      return {
        items: Array.isArray(items) ? items : [],
        total: totalKnown ? Number(totalValue) : 0,
        totalKnown,
        page: Number(result.page ?? meta.page ?? state.page),
        limit: Number(result.limit ?? meta.limit ?? state.limit),
      };
    }
  
    function getTotalPages(total) {
      return Math.max(1, Math.ceil(total / state.limit));
    }
  
    function buildQuery() {
      const params = new URLSearchParams();
  
      params.set('page', String(state.page));
      params.set('limit', String(state.limit));
      params.set('sortBy', state.sortBy);
      params.set('sortOrder', state.sortOrder);
  
      const filters = {
        search: state.search,
        brandName: state.brandName,
        activeIngredient: state.activeIngredient,
        dosageForm: state.dosageForm,
        isActive: state.isActive,
      };
  
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '') {
          params.set(key, value);
        }
      });
  
      return params.toString();
    }
  
    function renderDrugs(items) {
      if (!items.length) {
        elements.tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="table-message">
              دارویی با این مشخصات پیدا نشد.
            </td>
          </tr>
        `;
        return;
      }
  
      elements.tableBody.innerHTML = items.map((drug) => {
        const active = drug.isActive === true;
  
        return `
          <tr>
            <td>
              <div class="drug-name">
                <strong>${escapeHtml(drug.genericName || 'بدون نام')}</strong>
                <span class="drug-id">${escapeHtml(drug.id || '')}</span>
              </div>
            </td>
  
            <td>${escapeHtml(drug.brandName || '—')}</td>
            <td>${escapeHtml(drug.activeIngredient || '—')}</td>
            <td>${escapeHtml(drug.strength || '—')}</td>
            <td>${escapeHtml(drug.dosageForm || '—')}</td>
  
            <td>
              <span class="status-badge ${active ? 'active' : 'inactive'}">
                ${active ? 'فعال' : 'غیرفعال'}
              </span>
            </td>
  
            <td>${escapeHtml(formatDate(drug.createdAt))}</td>
  
            <td>
              <div class="row-actions">
                <button
                  type="button"
                  class="action-btn edit"
                  data-action="edit"
                  data-id="${escapeHtml(drug.id)}"
                >ویرایش</button>
  
                ${
                  active
                    ? `<button
                        type="button"
                        class="action-btn deactivate"
                        data-action="deactivate"
                        data-id="${escapeHtml(drug.id)}"
                        data-name="${escapeHtml(drug.genericName || 'این دارو')}"
                      >غیرفعال‌سازی</button>`
                    : `<button
                        type="button"
                        class="action-btn activate"
                        data-action="activate"
                        data-id="${escapeHtml(drug.id)}"
                        data-name="${escapeHtml(drug.genericName || 'این دارو')}"
                      >فعال‌سازی</button>`
                }
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  
    function renderPagination(total, totalKnown) {
      const totalPages = getTotalPages(total);
  
      elements.pageInfo.textContent =
        `صفحه ${formatNumber(state.page)} از ${formatNumber(totalPages)}`;
  
      elements.prevPageBtn.disabled = state.page <= 1;
  
      // اگر تعداد کل معلوم نیست، وجود صفحه بعد را از تعداد رکوردها حدس می‌زنیم.
      elements.nextPageBtn.disabled = totalKnown
        ? state.page >= totalPages
        : false;
    }
  
    function renderLoading() {
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="table-message">
            در حال دریافت اطلاعات داروها...
          </td>
        </tr>
      `;
  
      elements.resultsText.textContent = 'در حال بارگذاری...';
    }
  
    async function loadDrugs() {
      if (state.loading) {
        // درخواست قبلی لغو نشده، اما پاسخ قدیمی نباید روی نتایج جدید بنشیند.
        // شناسه درخواست مشخص می‌کند کدام پاسخ معتبر است.
      }
  
      const requestId = ++state.requestId;
      state.loading = true;
  
      renderLoading();
      elements.refreshBtn.disabled = true;
  
      try {
        const payload = await apiRequest(`/drugs?${buildQuery()}`);
  
        if (requestId !== state.requestId) return;
  
        const result = extractDrugList(payload);
        const items = result.items;
  
        let total = result.total;
        let totalKnown = result.totalKnown;
  
        if (!totalKnown) {
          total = (state.page - 1) * state.limit + items.length;
  
          // اگر صفحه پر باشد، ممکن است صفحات بعدی هم وجود داشته باشند.
          if (items.length === state.limit) {
            total += 1;
          }
        }
  
        state.total = total;
        elements.totalDrugs.textContent = totalKnown
          ? formatNumber(total)
          : `${formatNumber((state.page - 1) * state.limit + items.length)}+`;
  
        elements.resultsText.textContent = totalKnown
          ? `${formatNumber(total)} نتیجه`
          : `${formatNumber(items.length)} نتیجه در این صفحه`;
  
        renderDrugs(items);
        renderPagination(total, totalKnown);
      } catch (error) {
        if (requestId !== state.requestId) return;
  
        elements.tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="table-message error">
              ${escapeHtml(error.message)}
            </td>
          </tr>
        `;
  
        elements.totalDrugs.textContent = '—';
        elements.resultsText.textContent = 'دریافت اطلاعات ناموفق بود';
        elements.pageInfo.textContent = `صفحه ${formatNumber(state.page)}`;
        elements.prevPageBtn.disabled = state.page <= 1;
        elements.nextPageBtn.disabled = true;
      } finally {
        if (requestId === state.requestId) {
          state.loading = false;
          elements.refreshBtn.disabled = false;
        }
      }
    }
  
    function readFilters() {
      state.search = elements.searchInput.value.trim();
      state.brandName = elements.brandFilter.value.trim();
      state.activeIngredient = elements.ingredientFilter.value.trim();
      state.dosageForm = elements.formFilter.value.trim();
      state.isActive = elements.statusFilter.value;
      state.sortBy = elements.sortBy.value;
      state.sortOrder = elements.sortOrder.value;
      state.page = 1;
    }
  
    function openModal(drug = null) {
      previousFocus = document.activeElement;
      state.editingId = drug?.id ?? null;
  
      elements.drugForm.reset();
  
      elements.modalTitle.textContent = drug
        ? 'ویرایش دارو'
        : 'ثبت داروی جدید';
  
      elements.saveDrugBtn.textContent = drug
        ? 'ذخیره تغییرات'
        : 'ذخیره دارو';
  
      const fields = [
        'genericName',
        'brandName',
        'activeIngredient',
        'strength',
        'dosageForm',
        'isActive',
        'description',
      ];
  
      fields.forEach((name) => {
        const input = elements.drugForm.elements.namedItem(name);
        if (!input) return;
  
        if (name === 'isActive') {
          input.value = String(drug?.isActive ?? true);
        } else {
          input.value = drug?.[name] ?? '';
        }
      });
  
      elements.modal.hidden = false;
      document.body.style.overflow = 'hidden';
      $('#genericName').focus();
    }
  
    function closeModal() {
      if (elements.saveDrugBtn.disabled) return;
  
      elements.modal.hidden = true;
      document.body.style.overflow = '';
  
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    }
  
    async function editDrug(id) {
      try {
        const payload = await apiRequest(`/drugs/${encodeURIComponent(id)}`);
        const drug = unwrapResponse(payload);
  
        if (!drug || typeof drug !== 'object' || !drug.id) {
          throw new Error('اطلاعات دارو در پاسخ سرور معتبر نیست.');
        }
  
        openModal(drug);
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  
    function readForm() {
      const formData = new FormData(elements.drugForm);
      const body = {};
  
      body.genericName = String(formData.get('genericName') || '').trim();
  
      const optionalFields = [
        'brandName',
        'activeIngredient',
        'strength',
        'dosageForm',
        'description',
      ];
  
      optionalFields.forEach((key) => {
        const value = String(formData.get(key) || '').trim();
  
        // null امکان پاک‌کردن مقدار قبلی را هنگام ویرایش فراهم می‌کند.
        body[key] = value || null;
      });
  
      body.isActive = formData.get('isActive') === 'true';
  
      return body;
    }
  
    async function saveDrug(event) {
      event.preventDefault();
  
      if (!elements.drugForm.reportValidity()) return;
  
      const isEditing = Boolean(state.editingId);
      const body = readForm();
  
      elements.saveDrugBtn.disabled = true;
      elements.saveDrugBtn.classList.add('is-loading');
      elements.saveDrugBtn.textContent = 'در حال ذخیره...';
  
      try {
        const path = isEditing
          ? `/drugs/${encodeURIComponent(state.editingId)}`
          : '/drugs';
  
        await apiRequest(path, {
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        });
  
        elements.modal.hidden = true;
        document.body.style.overflow = '';
  
        showToast(
          isEditing
            ? 'اطلاعات دارو با موفقیت ویرایش شد.'
            : 'داروی جدید با موفقیت ثبت شد.',
          'success'
        );
  
        // بعد از ثبت، صفحه اول را نشان می‌دهیم تا نتیجه جدید دیده شود.
        if (!isEditing) {
          state.page = 1;
        }
  
        await loadDrugs();
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        elements.saveDrugBtn.disabled = false;
        elements.saveDrugBtn.classList.remove('is-loading');
        elements.saveDrugBtn.textContent = state.editingId
          ? 'ذخیره تغییرات'
          : 'ذخیره دارو';
      }
    }
  
    async function changeDrugStatus(id, name, shouldActivate) {
      const actionText = shouldActivate ? 'فعال‌سازی' : 'غیرفعال‌سازی';
  
      const confirmed = window.confirm(
        `آیا از ${actionText} «${name}» مطمئن هستی؟`
      );
  
      if (!confirmed) return;
  
      try {
        if (shouldActivate) {
          // مسیر PATCH در کنترلر موجود است؛ وضعیت دارو را فعال می‌کنیم.
          await apiRequest(`/drugs/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive: true }),
          });
        } else {
          // طبق کنترلر، DELETE دارو را غیرفعال می‌کند.
          await apiRequest(`/drugs/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
        }
  
        showToast(
          shouldActivate
            ? 'دارو با موفقیت فعال شد.'
            : 'دارو با موفقیت غیرفعال شد.',
          'success'
        );
  
        await loadDrugs();
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  
    elements.addDrugBtn.addEventListener('click', () => openModal());
  
    elements.refreshBtn.addEventListener('click', () => {
      loadDrugs();
    });
  
    elements.filtersForm.addEventListener('submit', (event) => {
      event.preventDefault();
      readFilters();
      loadDrugs();
    });
  
    elements.clearFiltersBtn.addEventListener('click', () => {
      elements.filtersForm.reset();
  
      state.search = '';
      state.brandName = '';
      state.activeIngredient = '';
      state.dosageForm = '';
      state.isActive = '';
      state.sortBy = 'createdAt';
      state.sortOrder = 'DESC';
      state.page = 1;
  
      elements.sortBy.value = state.sortBy;
      elements.sortOrder.value = state.sortOrder;
  
      loadDrugs();
    });
  
    // جست‌وجوی خودکار با مکث کوتاه.
    elements.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
  
      searchTimer = setTimeout(() => {
        readFilters();
        loadDrugs();
      }, 400);
    });
  
    [
      elements.brandFilter,
      elements.ingredientFilter,
      elements.formFilter,
    ].forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          readFilters();
          loadDrugs();
        }
      });
    });
  
    elements.pageSize.addEventListener('change', () => {
      state.limit = Number(elements.pageSize.value) || 10;
      state.page = 1;
      loadDrugs();
    });
  
    elements.prevPageBtn.addEventListener('click', () => {
      if (state.page <= 1) return;
  
      state.page -= 1;
      loadDrugs();
    });
  
    elements.nextPageBtn.addEventListener('click', () => {
      state.page += 1;
      loadDrugs();
    });
  
    elements.tableBody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
  
      if (!button) return;
  
      const { action, id, name } = button.dataset;
  
      if (!id) {
        showToast('شناسه دارو پیدا نشد.', 'error');
        return;
      }
  
      if (action === 'edit') {
        editDrug(id);
      } else if (action === 'deactivate') {
        changeDrugStatus(id, name || 'این دارو', false);
      } else if (action === 'activate') {
        changeDrugStatus(id, name || 'این دارو', true);
      }
    });
  
    elements.drugForm.addEventListener('submit', saveDrug);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelModalBtn.addEventListener('click', closeModal);
  
    elements.modal.addEventListener('click', (event) => {
      if (event.target === elements.modal) {
        closeModal();
      }
    });
  
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.modal.hidden) {
        closeModal();
      }
    });
  
    // مقدار اولیه فیلترها و دریافت داده‌ها.
    elements.pageSize.value = String(state.limit);
    loadDrugs();
  })();
  