(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const state = {
    page: 1,
    limit: 10,
    total: 0,
    search: "",
    isActive: "",
    editingId: null,
    items: [],
  };

  const el = {
    body: $("#customersTableBody"),
    total: $("#customersTotal"),
    active: $("#customersActive"),
    inactive: $("#customersInactive"),
    pageInfo: $("#pageInfo"),
    prev: $("#prevPageBtn"),
    next: $("#nextPageBtn"),
    search: $("#searchInput"),
    status: $("#statusFilter"),
    pageSize: $("#pageSize"),
    filters: $("#filtersForm"),
    refresh: $("#refreshBtn"),
    add: $("#addCustomerBtn"),
    modal: $("#customerModal"),
    modalTitle: $("#modalTitle"),
    form: $("#customerForm"),
    name: $("#customerFullName"),
    phone: $("#customerPhone"),
    nationalCode: $("#customerNationalCode"),
    birthDate: $("#customerBirthDate"),
    notes: $("#customerNotes"),
    activeField: $("#customerIsActive"),
    message: $("#customerFormMessage"),
    save: $("#saveCustomerBtn"),
    toast: $("#toast"),
  };

  let toastTimer;
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char]));

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
  };

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 3500);
  }

  function showFormError(message) {
    el.message.textContent = message;
    el.message.classList.add("show");
  }

  function clearFormError() {
    el.message.textContent = "";
    el.message.classList.remove("show");
  }

  async function request(path, options = {}) {
    const response = await window.apiFetch(path, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      const rawMessage = payload.message ?? payload.error;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join("، ")
        : typeof rawMessage === "string"
          ? rawMessage
          : `خطای ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  function unwrapList(payload) {
    // Supports both {data: [], meta: {}} and a nested {data: {data: [], meta: {}}} response.
    let current = payload;
    for (let depth = 0; depth < 4 && current; depth += 1) {
      if (Array.isArray(current)) {
        return { items: current, meta: { total: current.length } };
      }
      if (Array.isArray(current.data)) {
        return {
          items: current.data,
          meta: current.meta || payload.meta || { total: current.data.length },
        };
      }
      if (current.data && typeof current.data === "object") current = current.data;
      else break;
    }
    return { items: [], meta: { total: 0 } };
  }

  function render() {
    const activeCount = state.items.filter((customer) => customer.isActive).length;
    el.total.textContent = Number(state.total).toLocaleString("fa-IR");
    el.active.textContent = activeCount.toLocaleString("fa-IR");
    el.inactive.textContent = Math.max(0, state.items.length - activeCount).toLocaleString("fa-IR");

    if (!state.items.length) {
      el.body.innerHTML = '<tr><td colspan="7" class="table-empty">مشتری‌ای برای نمایش وجود ندارد.</td></tr>';
    } else {
      el.body.innerHTML = state.items.map((customer) => `
        <tr>
          <td>${esc(customer.fullName)}</td>
          <td dir="ltr">${esc(customer.phone)}</td>
          <td>${esc(customer.nationalCode || "—")}</td>
          <td>${formatDate(customer.birthDate)}</td>
          <td><span class="status-pill ${customer.isActive ? "active" : "inactive"}">${customer.isActive ? "فعال" : "غیرفعال"}</span></td>
          <td>${formatDate(customer.createdAt)}</td>
          <td><div class="table-actions">
            <button class="table-action" data-action="edit" data-id="${esc(customer.id)}">مشاهده / ویرایش</button>
            ${customer.isActive ? `<button class="table-action danger" data-action="deactivate" data-id="${esc(customer.id)}">غیرفعال‌سازی</button>` : ""}
          </div></td>
        </tr>
      `).join("");
    }

    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    el.pageInfo.textContent = `صفحه ${state.page.toLocaleString("fa-IR")} از ${pages.toLocaleString("fa-IR")} · ${state.total.toLocaleString("fa-IR")} مشتری`;
    el.prev.disabled = state.page <= 1;
    el.next.disabled = state.page >= pages;
  }

  async function loadCustomers() {
    el.body.innerHTML = '<tr><td colspan="7" class="table-empty">در حال دریافت اطلاعات...</td></tr>';
    el.refresh.disabled = true;
    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
      sortBy: "createdAt",
      sortOrder: "DESC",
    });
    if (state.search) params.set("search", state.search);
    if (state.isActive !== "") params.set("isActive", state.isActive);

    try {
      const payload = await request(`/customers?${params.toString()}`);
      const result = unwrapList(payload);
      state.items = result.items;
      state.total = Number(result.meta?.total ?? result.items.length);
      render();
    } catch (error) {
      el.body.innerHTML = `<tr><td colspan="7" class="table-empty">${esc(error.message || "دریافت مشتریان ناموفق بود.")}</td></tr>`;
      toast(error.message || "دریافت مشتریان ناموفق بود.");
    } finally {
      el.refresh.disabled = false;
    }
  }

  function openModal(customer = null) {
    state.editingId = customer?.id || null;
    el.form.reset();
    clearFormError();
    el.modalTitle.textContent = customer ? "مشاهده / ویرایش مشتری" : "ثبت مشتری جدید";
    el.name.value = customer?.fullName || "";
    el.phone.value = customer?.phone || "";
    el.nationalCode.value = customer?.nationalCode || "";
    el.birthDate.value = customer?.birthDate ? String(customer.birthDate).slice(0, 10) : "";
    el.notes.value = customer?.notes || "";
    el.activeField.value = String(customer?.isActive ?? true);
    el.save.textContent = customer ? "ذخیره تغییرات" : "ذخیره مشتری";
    el.modal.hidden = false;
    el.name.focus();
  }

  function closeModal() {
    el.modal.hidden = true;
    state.editingId = null;
  }

  async function saveCustomer(event) {
    event.preventDefault();
    clearFormError();

    const body = {
      fullName: el.name.value.trim(),
      phone: el.phone.value.trim(),
      nationalCode: el.nationalCode.value.trim() || undefined,
      birthDate: el.birthDate.value || undefined,
      notes: el.notes.value.trim() || undefined,
      isActive: el.activeField.value === "true",
    };

    // Optional fields are omitted rather than sent as empty strings.
    Object.keys(body).forEach((key) => body[key] === undefined && delete body[key]);

    el.save.disabled = true;
    el.save.textContent = "در حال ذخیره...";

    try {
      const isEditing = Boolean(state.editingId);
      const path = isEditing ? `/customers/${encodeURIComponent(state.editingId)}` : "/customers";
      const result = await request(path, {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      closeModal();
      toast(result.message || (isEditing ? "اطلاعات مشتری به‌روزرسانی شد." : "مشتری ثبت شد."));
      await loadCustomers();
    } catch (error) {
      showFormError(error.message || "ذخیره اطلاعات مشتری ناموفق بود.");
    } finally {
      el.save.disabled = false;
      el.save.textContent = state.editingId ? "ذخیره تغییرات" : "ذخیره مشتری";
    }
  }

  async function handleTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const customer = state.items.find((item) => item.id === button.dataset.id);
    if (!customer) return;

    if (button.dataset.action === "edit") {
      // Fetch the latest record, then open the same form for viewing/editing.
      try {
        const result = await request(`/customers/${encodeURIComponent(customer.id)}`);
        const record = result.data && !Array.isArray(result.data) ? result.data : customer;
        openModal(record?.id ? record : customer);
      } catch (error) {
        toast(error.message || "دریافت اطلاعات مشتری ناموفق بود.");
      }
      return;
    }

    if (button.dataset.action === "deactivate") {
      if (!confirm(`پرونده «${customer.fullName}» غیرفعال شود؟`)) return;
      button.disabled = true;
      try {
        const result = await request(`/customers/${encodeURIComponent(customer.id)}/deactivate`, {
          method: "PATCH",
        });
        toast(result.message || "پرونده مشتری غیرفعال شد.");
        if (state.items.length === 1 && state.page > 1) state.page -= 1;
        await loadCustomers();
      } catch (error) {
        toast(error.message || "غیرفعال‌سازی مشتری ناموفق بود.");
        button.disabled = false;
      }
    }
  }

  el.filters.addEventListener("submit", (event) => {
    event.preventDefault();
    state.search = el.search.value.trim();
    state.isActive = el.status.value;
    state.limit = Number(el.pageSize.value) || 10;
    state.page = 1;
    loadCustomers();
  });

  el.refresh.addEventListener("click", loadCustomers);
  el.prev.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      loadCustomers();
    }
  });
  el.next.addEventListener("click", () => {
    if (state.page * state.limit < state.total) {
      state.page += 1;
      loadCustomers();
    }
  });
  el.add.addEventListener("click", () => openModal());
  el.form.addEventListener("submit", saveCustomer);
  el.body.addEventListener("click", handleTableClick);
  $("#closeModalBtn").addEventListener("click", closeModal);
  $("#cancelModalBtn").addEventListener("click", closeModal);
  el.modal.addEventListener("click", (event) => {
    if (event.target === el.modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.modal.hidden) closeModal();
  });

  loadCustomers();
})();
