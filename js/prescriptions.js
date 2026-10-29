(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const el = {
    customer: $("#prescriptionCustomer"),
    customerHint: $("#customerHint"),
    notes: $("#prescriptionNotes"),
    form: $("#prescriptionForm"),
    items: $("#prescriptionItems"),
    itemTemplate: $("#prescriptionItemTemplate"),
    addItem: $("#addPrescriptionItemBtn"),
    reset: $("#resetPrescriptionBtn"),
    save: $("#savePrescriptionBtn"),
    message: $("#prescriptionFormMessage"),
    historyCustomer: $("#historyCustomer"),
    loadHistory: $("#loadHistoryBtn"),
    history: $("#historyContent"),
    resultSection: $("#createdResultSection"),
    resultContent: $("#createdResultContent"),
    refresh: $("#refreshDataBtn"),
    serverDot: $("#serverDot"),
    serverStatus: $("#serverStatus"),
    toast: $("#toast"),
  };

  const state = { customers: [], drugs: [], itemCount: 0, lastCreatedCustomerId: null };
  let toastTimer;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));

  function setServerStatus(online) {
    if (el.serverDot) el.serverDot.style.background = online ? "#16a34a" : "#dc2626";
    if (el.serverStatus) {
      el.serverStatus.textContent = online ? "متصل" : "عدم اتصال";
      el.serverStatus.classList.toggle("connected", online);
    }
  }

  function toast(message, type = "success") {
    el.toast.textContent = message;
    el.toast.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 3500);
  }

  function showError(message) {
    el.message.textContent = message;
    el.message.classList.add("show");
  }
  function clearError() {
    el.message.textContent = "";
    el.message.classList.remove("show");
  }

  async function request(path, options = {}) {
    let response;
    try {
      response = await window.apiFetch(path, options);
    } catch {
      setServerStatus(false);
      throw new Error("ارتباط با سرور برقرار نشد. اجرای بک‌اند را بررسی کن.");
    }
    setServerStatus(true);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      const raw = payload?.message ?? payload?.error;
      throw new Error(Array.isArray(raw) ? raw.join("، ") : raw || `خطای سرور (${response.status})`);
    }
    return payload;
  }

  function unwrapArray(payload, preferredKeys = []) {
    let current = payload;
    for (let i = 0; i < 5 && current; i += 1) {
      if (Array.isArray(current)) return current;
      for (const key of preferredKeys) {
        if (Array.isArray(current[key])) return current[key];
      }
      if (Array.isArray(current.items)) return current.items;
      if (Array.isArray(current.results)) return current.results;
      if (current.data && typeof current.data === "object") {
        current = current.data;
        continue;
      }
      break;
    }
    return [];
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function customerLabel(customer) {
    return `${customer.fullName || "بدون نام"}${customer.phone ? ` — ${customer.phone}` : ""}`;
  }

  function populateCustomerSelects() {
    const activeCustomers = state.customers.filter((customer) => customer.isActive !== false);
    const options = activeCustomers.map((customer) =>
      `<option value="${esc(customer.id)}">${esc(customerLabel(customer))}</option>`).join("");
    el.customer.innerHTML = `<option value="">انتخاب مشتری...</option>${options}`;
    el.historyCustomer.innerHTML = `<option value="">انتخاب مشتری...</option>${options}`;
    el.customerHint.textContent = activeCustomers.length
      ? `${activeCustomers.length.toLocaleString("fa-IR")} مشتری فعال در دسترس است.`
      : "مشتری فعال پیدا نشد؛ ابتدا از بخش مدیریت مشتریان یک مشتری فعال ثبت کنید.";
  }

  function drugLabel(drug) {
    const name = drug.genericName || drug.name || "داروی بدون نام";
    const brand = drug.brandName ? ` (${drug.brandName})` : "";
    const strength = drug.strength ? ` · ${drug.strength}` : "";
    return `${name}${brand}${strength}`;
  }

  function addItem() {
    if (el.items.children.length >= 10) {
      toast("هر نسخه حداکثر می‌تواند ۱۰ دارو داشته باشد.", "error");
      return;
    }
    const fragment = el.itemTemplate.content.cloneNode(true);
    const item = $(".prescription-item", fragment);
    const select = $(".item-drug", item);
    const options = state.drugs
      .filter((drug) => drug.isActive !== false)
      .map((drug) => `<option value="${esc(drug.id)}">${esc(drugLabel(drug))}</option>`)
      .join("");
    select.insertAdjacentHTML("beforeend", options);
    el.items.appendChild(fragment);
    state.itemCount += 1;
    renumberItems();
  }

  function renumberItems() {
    $$(".prescription-item", el.items).forEach((item, index) => {
      $(".item-number", item).textContent = (index + 1).toLocaleString("fa-IR");
      $(".remove-item-btn", item).disabled = el.items.children.length === 1;
    });
    el.addItem.disabled = el.items.children.length >= 10;
  }

  function readItems() {
    return $$(".prescription-item", el.items).map((item) => ({
      drugId: $(".item-drug", item).value,
      dosage: $(".item-dosage", item).value.trim(),
      frequency: $(".item-frequency", item).value.trim(),
      duration: $(".item-duration", item).value.trim(),
      quantity: Number($(".item-quantity", item).value),
      instructions: $(".item-instructions", item).value.trim(),
    }));
  }

  function severityInfo(severity) {
    const map = {
      HIGH: ["شدید", "high"],
      MODERATE: ["متوسط", "moderate"],
      LOW: ["خفیف", "low"],
      CONTRAINDICATED: ["منع مصرف", "contraindicated"],
    };
    return map[severity] || ["نامشخص", "moderate"];
  }

  function renderInteractionResults(results, disclaimer) {
    const found = results.filter((item) => item.interactionFound).length;
    const cards = results.length ? results.map((pair) => {
      const a = pair.drugA?.genericName || pair.drugAName || "داروی اول";
      const b = pair.drugB?.genericName || pair.drugBName || "داروی دوم";
      if (!pair.interactionFound) {
        return `<article class="interaction-card safe">
          <div class="interaction-pair">${esc(a)} ↔ ${esc(b)}</div>
          <p>در اطلاعات ثبت‌شده سامانه، تعاملی برای این جفت دارویی پیدا نشد.</p>
        </article>`;
      }
      const interaction = pair.interaction || pair;
      const [label, className] = severityInfo(interaction.severity);
      return `<article class="interaction-card found">
        <div class="interaction-pair">${esc(a)} ↔ ${esc(b)}</div>
        <span class="severity ${className}">${label}</span>
        <p><strong>توضیح:</strong> ${esc(interaction.description || "توضیحی ثبت نشده است.")}</p>
        ${interaction.recommendation ? `<p><strong>توصیه ثبت‌شده:</strong> ${esc(interaction.recommendation)}</p>` : ""}
      </article>`;
    }).join("") : `<div class="empty-state">برای این نسخه جفت دارویی جهت بررسی تداخل وجود نداشت.</div>`;

    el.resultContent.innerHTML = `
      <div class="result-meta">
        <span class="meta-chip">تعداد جفت‌های بررسی‌شده: ${results.length.toLocaleString("fa-IR")}</span>
        <span class="meta-chip">تداخل‌های پیدا‌شده: ${found.toLocaleString("fa-IR")}</span>
      </div>
      <div class="interaction-list">${cards}</div>
      <p class="result-disclaimer">${esc(disclaimer || "نتایج فقط بر اساس اطلاعات ثبت‌شده در سامانه هستند و جایگزین نظر پزشک یا داروساز نیستند.")}</p>`;
    el.resultSection.hidden = false;
    el.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function statusLabel(status) {
    if (status === "COMPLETED") return ["تکمیل‌شده", "completed"];
    if (status === "CANCELLED") return ["لغوشده", "cancelled"];
    return ["فعال", ""];
  }

  function renderHistory(prescriptions) {
    if (!prescriptions.length) {
      el.history.innerHTML = '<div class="empty-state">برای این مشتری هنوز نسخه‌ای ثبت نشده است.</div>';
      return;
    }
    el.history.innerHTML = prescriptions.map((prescription) => {
      const [statusText, statusClass] = statusLabel(prescription.status);
      const items = Array.isArray(prescription.items) ? prescription.items : [];
      return `<article class="history-card">
        <div class="history-card-head">
          <div><strong>نسخه ${esc(String(prescription.id || "").slice(0, 8))}</strong><div class="history-date">${esc(formatDate(prescription.createdAt))}</div></div>
          <span class="status-pill ${statusClass}">${statusText}</span>
        </div>
        ${prescription.notes ? `<p class="history-drug">${esc(prescription.notes)}</p>` : ""}
        <div class="history-items">${items.map((item) => `<div class="history-drug">
          <strong>${esc(item.drugName || "دارو")}</strong>${item.strength ? ` · ${esc(item.strength)}` : ""}
          <div>${esc(item.dosage || "—")}، ${esc(item.frequency || "—")}، ${esc(item.duration || "—")} · تعداد: ${Number(item.quantity || 0).toLocaleString("fa-IR")}</div>
          ${item.instructions ? `<div>توضیح: ${esc(item.instructions)}</div>` : ""}
        </div>`).join("")}</div>
        <div class="history-actions"><button type="button" data-prescription-id="${esc(prescription.id)}">مشاهده جزئیات و تداخل‌ها</button></div>
      </article>`;
    }).join("");
  }

  async function loadHistory(customerId = el.historyCustomer.value) {
    if (!customerId) {
      el.history.innerHTML = '<div class="empty-state">ابتدا یک مشتری انتخاب کنید.</div>';
      return;
    }
    el.loadHistory.disabled = true;
    el.history.innerHTML = '<div class="empty-state">در حال دریافت تاریخچه...</div>';
    try {
      const payload = await request(`/prescriptions/customer/${encodeURIComponent(customerId)}`);
      const prescriptions = unwrapArray(payload, ["prescriptions"]);
      renderHistory(prescriptions);
    } catch (error) {
      el.history.innerHTML = `<div class="empty-state">${esc(error.message || "دریافت تاریخچه ناموفق بود.")}</div>`;
    } finally {
      el.loadHistory.disabled = false;
    }
  }

  async function showPrescriptionDetails(id) {
    try {
      const payload = await request(`/prescriptions/${encodeURIComponent(id)}`);
      let prescription = payload;
      for (let i = 0; i < 4 && prescription?.data; i += 1) prescription = prescription.data;
      const results = (prescription?.interactionResults || []).map((row) => ({
        drugAName: row.drugAName,
        drugBName: row.drugBName,
        interactionFound: row.interactionFound,
        severity: row.severity,
        description: row.description,
        recommendation: row.recommendation,
      }));
      renderInteractionResults(results, "این تاریخچه، نتیجه ذخیره‌شده در زمان ثبت نسخه را نمایش می‌دهد.");
    } catch (error) {
      toast(error.message || "دریافت جزئیات نسخه ناموفق بود.", "error");
    }
  }

  async function submitPrescription(event) {
    event.preventDefault();
    clearError();
    const items = readItems();
    const customerId = el.customer.value;
    if (!customerId) return showError("یک مشتری فعال انتخاب کن.");
    if (!items.length) return showError("حداقل یک دارو به نسخه اضافه کن.");
    if (items.some((item) => !item.drugId || !item.dosage || !item.frequency || !item.duration || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return showError("برای هر دارو، دارو و تمام فیلدهای ضروری را کامل کن.");
    }
    if (new Set(items.map((item) => item.drugId)).size !== items.length) {
      return showError("یک دارو را فقط یک بار در اقلام نسخه انتخاب کن.");
    }

    const body = {
      customerId,
      notes: el.notes.value.trim() || undefined,
      items: items.map((item) => ({
        ...item,
        instructions: item.instructions || undefined,
      })),
    };
    if (!body.notes) delete body.notes;

    el.save.disabled = true;
    el.save.textContent = "در حال ثبت نسخه...";
    try {
      const payload = await request("/prescriptions", {
        method: "POST",
        body: JSON.stringify(body),
      });
      let result = payload;
      for (let i = 0; i < 4 && result?.data; i += 1) {
        if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
          result = result.data;
        } else break;
      }
      const checkResults = Array.isArray(result.interactionResults) ? result.interactionResults : [];
      renderInteractionResults(checkResults, result.disclaimer);
      state.lastCreatedCustomerId = customerId;
      el.historyCustomer.value = customerId;
      await loadHistory(customerId);
      toast(payload.message || "نسخه با موفقیت ثبت شد.");
      el.form.reset();
      el.items.innerHTML = "";
      addItem();
      el.customer.value = "";
      el.notes.value = "";
    } catch (error) {
      showError(error.message || "ثبت نسخه ناموفق بود.");
    } finally {
      el.save.disabled = false;
      el.save.textContent = "ثبت نسخه و بررسی تداخل";
    }
  }

  async function initialize() {
    el.refresh.disabled = true;
    try {
      const [customersPayload, drugsPayload] = await Promise.all([
        request("/customers?page=1&limit=100&sortBy=createdAt&sortOrder=DESC"),
        request("/drugs?page=1&limit=100&sortBy=genericName&sortOrder=ASC"),
      ]);
      state.customers = unwrapArray(customersPayload, ["customers"]).filter((customer) => customer && customer.id);
      state.drugs = unwrapArray(drugsPayload, ["drugs"]).filter((drug) => drug && drug.id);
      populateCustomerSelects();
      el.items.innerHTML = "";
      addItem();
      setServerStatus(true);
    } catch (error) {
      setServerStatus(false);
      el.customer.innerHTML = '<option value="">بارگذاری مشتریان ناموفق بود</option>';
      el.historyCustomer.innerHTML = '<option value="">بارگذاری مشتریان ناموفق بود</option>';
      el.history.innerHTML = `<div class="empty-state">${esc(error.message || "دریافت اطلاعات اولیه ناموفق بود.")}</div>`;
      toast(error.message || "دریافت اطلاعات اولیه ناموفق بود.", "error");
    } finally {
      el.refresh.disabled = false;
    }
  }

  el.addItem.addEventListener("click", addItem);
  el.items.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-item-btn");
    if (!button || el.items.children.length <= 1) return;
    button.closest(".prescription-item").remove();
    renumberItems();
  });
  el.form.addEventListener("submit", submitPrescription);
  el.reset.addEventListener("click", () => {
    el.form.reset();
    el.items.innerHTML = "";
    addItem();
    clearError();
    el.resultSection.hidden = true;
  });
  el.loadHistory.addEventListener("click", () => loadHistory());
  el.history.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prescription-id]");
    if (button) showPrescriptionDetails(button.dataset.prescriptionId);
  });
  el.refresh.addEventListener("click", initialize);
  el.historyCustomer.addEventListener("change", () => {
    if (el.historyCustomer.value) loadHistory();
  });

  initialize();
})();
