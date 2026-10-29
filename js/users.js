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
    body: $("#usersTableBody"),
    total: $("#usersTotal"),
    active: $("#usersActive"),
    inactive: $("#usersInactive"),
    pageInfo: $("#pageInfo"),
    prev: $("#prevPageBtn"),
    next: $("#nextPageBtn"),
    search: $("#searchInput"),
    status: $("#statusFilter"),
    pageSize: $("#pageSize"),
    filters: $("#filtersForm"),
    refresh: $("#refreshBtn"),
    add: $("#addUserBtn"),
    modal: $("#userModal"),
    modalTitle: $("#modalTitle"),
    form: $("#userForm"),
    name: $("#fullName"),
    email: $("#userEmail"),
    password: $("#userPassword"),
    passwordField: $("#passwordField"),
    activeField: $("#isActive"),
    message: $("#userFormMessage"),
    save: $("#saveUserBtn"),
    toast: $("#toast"),
  };
  let toastTimer;
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  const date = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "—"
      : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(d);
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

  if (!response.ok) {
    const rawMessage = payload.message ?? payload.error;
    let message;

    if (Array.isArray(rawMessage)) {
      message = rawMessage.join('، ');
    } else if (typeof rawMessage === 'string') {
      message = rawMessage;
    } else if (rawMessage && typeof rawMessage === 'object') {
      message =
        rawMessage.message ??
        rawMessage.error ??
        JSON.stringify(rawMessage);
    } else {
      message = `خطای ${response.status}`;
    }

    throw new Error(message);
  }

  return payload;
}

  function unwrapList(payload) {
    let value = payload;
    for (let i = 0; i < 3 && value && !Array.isArray(value); i += 1) {
      if (Array.isArray(value.data)) {
        return {
          items: value.data,
          meta: value.meta || { total: value.data.length },
        };
      }
      if (value.data && typeof value.data === "object") value = value.data;
      else break;
    }
    if (Array.isArray(value))
      return { items: value, meta: { total: value.length } };
    return {
      items: value?.items || value?.users || [],
      meta: value?.meta || { total: value?.total || 0 },
    };
  }
  function render() {
    const activeCount = state.items.filter((u) => u.isActive).length;
    el.total.textContent = Number(state.total).toLocaleString("fa-IR");
    el.active.textContent = activeCount.toLocaleString("fa-IR");
    el.inactive.textContent = Math.max(
      0,
      state.total - activeCount
    ).toLocaleString("fa-IR");
    if (!state.items.length) {
      el.body.innerHTML =
        '<tr><td colspan="5" class="table-empty">کاربری برای نمایش وجود ندارد.</td></tr>';
    } else {
      el.body.innerHTML = state.items
        .map(
          (user) => `<tr>
        <td>${esc(user.fullName)}</td><td>${esc(user.email)}</td>
        <td><span class="status-pill ${
          user.isActive ? "active" : "inactive"
        }">${user.isActive ? "فعال" : "غیرفعال"}</span></td>
        <td>${date(user.createdAt)}</td>
        <td><div class="table-actions"><button class="table-action" data-action="edit" data-id="${esc(
          user.id
        )}">ویرایش</button><button class="table-action danger" data-action="delete" data-id="${esc(
            user.id
          )}">حذف</button></div></td>
      </tr>`
        )
        .join("");
    }
    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    el.pageInfo.textContent = `صفحه ${state.page.toLocaleString(
      "fa-IR"
    )} از ${pages.toLocaleString("fa-IR")}`;
    el.prev.disabled = state.page <= 1;
    el.next.disabled = state.page >= pages;
  }
  async function loadUsers() {
    el.body.innerHTML =
      '<tr><td colspan="5" class="table-empty">در حال دریافت اطلاعات...</td></tr>';
    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
      sortBy: "createdAt",
      sortOrder: "DESC",
    });
    if (state.search) params.set("search", state.search);
    if (state.isActive !== "") params.set("isActive", state.isActive);
    try {
      const payload = await request(`/users?${params}`);
      const result = unwrapList(payload);
      state.items = result.items;
      state.total = Number(result.meta?.total ?? result.items.length);
      render();
    } catch (error) {
      el.body.innerHTML = `<tr><td colspan="5" class="table-empty">${esc(
        error.message
      )}</td></tr>`;
      toast(error.message);
    }
  }
  function openModal(user = null) {
    state.editingId = user?.id || null;
    el.form.reset();
    clearFormError();
    el.modalTitle.textContent = user ? "ویرایش کاربر" : "افزودن کاربر";
    el.name.value = user?.fullName || "";
    el.email.value = user?.email || "";
    el.activeField.value = String(user?.isActive ?? true);
    el.password.required = !user;
    el.passwordField.hidden = Boolean(user);
    el.password.value = "";
    el.modal.hidden = false;
    el.name.focus();
  }
  function closeModal() {
    el.modal.hidden = true;
    state.editingId = null;
  }
  async function saveUser(event) {
    event.preventDefault();
    clearFormError();
    const body = {
      fullName: el.name.value.trim(),
      email: el.email.value.trim().toLowerCase(),
    };
    if (!state.editingId) body.password = el.password.value;
    body.isActive = el.activeField.value === "true";
    el.save.disabled = true;
    el.save.textContent = "در حال ذخیره...";
    try {
      const path = state.editingId
        ? `/users/${encodeURIComponent(state.editingId)}`
        : "/users";
      const result = await request(path, {
        method: state.editingId ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      closeModal();
      toast(result.message || "اطلاعات کاربر ذخیره شد.");
      await loadUsers();
    } catch (error) {
      showFormError(error.message);
    } finally {
      el.save.disabled = false;
      el.save.textContent = "ذخیره کاربر";
    }
  }
  async function handleTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const user = state.items.find((item) => item.id === button.dataset.id);
    if (!user) return;
    if (button.dataset.action === "edit") openModal(user);
    if (button.dataset.action === "delete") {
      if (
        !confirm(
          `کاربر «${user.fullName}» حذف شود؟ این عملیات قابل بازگشت نیست.`
        )
      )
        return;
      try {
        const result = await request(`/users/${encodeURIComponent(user.id)}`, {
          method: "DELETE",
        });
        toast(result.message || "کاربر حذف شد.");
        if (state.items.length === 1 && state.page > 1) state.page -= 1;
        await loadUsers();
      } catch (error) {
        toast(error.message);
      }
    }
  }
  el.filters.addEventListener("submit", (event) => {
    event.preventDefault();
    state.search = el.search.value.trim();
    state.isActive = el.status.value;
    state.limit = Number(el.pageSize.value);
    state.page = 1;
    loadUsers();
  });
  el.refresh.addEventListener("click", loadUsers);
  el.prev.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      loadUsers();
    }
  });
  el.next.addEventListener("click", () => {
    if (state.page * state.limit < state.total) {
      state.page += 1;
      loadUsers();
    }
  });
  el.add.addEventListener("click", () => openModal());
  el.form.addEventListener("submit", saveUser);
  el.body.addEventListener("click", handleTableClick);
  $("#closeModalBtn").addEventListener("click", closeModal);
  $("#cancelModalBtn").addEventListener("click", closeModal);
  el.modal.addEventListener("click", (event) => {
    if (event.target === el.modal) closeModal();
  });
  loadUsers();
})();
