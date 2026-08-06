(function () {
  "use strict";

  const config = window.ATHEER_CONFIG || {};
  const client = config.supabaseUrl && config.supabaseAnonKey && window.supabase
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;
  const state = { products: [], assets: [], content: [], settings: [], currentView: "overview", session: null };
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove("show"), 3000);
  }

  function setLoginError(message) {
    const element = $("#login-error");
    element.textContent = message;
    element.hidden = !message;
  }

  function isConfigured() {
    return Boolean(client && config.supabaseUrl && config.supabaseAnonKey);
  }

  function showApp(session) {
    state.session = session;
    $("#auth-view").hidden = true;
    $("#app-view").hidden = false;
    $("#user-email").textContent = session?.user?.email || "";
  }

  function showAuth() {
    $("#auth-view").hidden = false;
    $("#app-view").hidden = true;
  }

  async function signIn(event) {
    event.preventDefault();
    setLoginError("");
    if (!isConfigured()) {
      setLoginError("أكمل إعداد Supabase في admin/config.js ثم أعد المحاولة.");
      return;
    }
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: $("#login-email").value.trim(),
        password: $("#login-password").value
      });
      if (error) throw error;
      showApp(data.session);
      await loadData();
      renderView();
    } catch (error) {
      setLoginError(error.message || "تعذر تسجيل الدخول. تحقق من البيانات.");
    } finally {
      button.disabled = false;
    }
  }

  async function loadData() {
    const results = await Promise.all([
      client.from("products").select("*").order("gender").order("sort_order"),
      client.from("site_assets").select("*").order("sort_order"),
      client.from("site_content").select("*").order("content_key"),
      client.from("settings").select("*").order("setting_key")
    ]);
    const failed = results.find(result => result.error);
    if (failed) throw failed.error;
    state.products = results[0].data || [];
    state.assets = results[1].data || [];
    state.content = results[2].data || [];
    state.settings = results[3].data || [];
  }

  function navView(view) {
    state.currentView = view;
    document.querySelectorAll(".nav-item[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === view));
    document.querySelectorAll(".view").forEach(item => item.classList.remove("active-view"));
    $(`#view-${view}`).classList.add("active-view");
    $("#page-title").textContent = ({ overview: "نظرة عامة", products: "المنتجات", media: "الصور والوسائط", content: "المحتوى", settings: "الإعدادات" })[view];
    renderView();
    $(".sidebar")?.classList.remove("open");
  }

  function renderView() {
    if (state.currentView === "overview") renderOverview();
    if (state.currentView === "products") renderProducts();
    if (state.currentView === "media") renderMedia();
    if (state.currentView === "content") renderContent();
    if (state.currentView === "settings") renderSettings();
  }

  function renderOverview() {
    const visibleProducts = state.products.filter(item => !item.is_hidden);
    const hiddenProducts = state.products.filter(item => item.is_hidden);
    const visibleAssets = state.assets.filter(item => !item.is_hidden);
    $("#view-overview").innerHTML = `
      <div class="dashboard-grid">
        <div class="stat-card"><small>كل المنتجات</small><strong>${state.products.length}</strong></div>
        <div class="stat-card"><small>منتجات ظاهرة</small><strong>${visibleProducts.length}</strong></div>
        <div class="stat-card"><small>صور مسجلة</small><strong>${state.assets.length}</strong></div>
        <div class="stat-card"><small>محتوى قابل للتعديل</small><strong>${state.content.length}</strong></div>
      </div>
      <section class="panel">
        <div class="panel-head"><div><h2>حالة المتجر</h2><p>ملخص سريع للمحتوى الذي يظهر للزوار</p></div><span class="badge visible">${visibleProducts.length} منتج نشط</span></div>
        <div class="overview-body">
          <div class="overview-line"><span>المنتجات المخفية</span><b>${hiddenProducts.length}</b></div>
          <div class="overview-line"><span>الصور الظاهرة</span><b>${visibleAssets.length}</b></div>
          <div class="overview-line"><span>آخر مزامنة</span><b>${new Date().toLocaleDateString("ar-MA")}</b></div>
        </div>
      </section>`;
  }

  function renderProducts() {
    const query = ($("#product-search")?.value || "").toLowerCase();
    const showHidden = $("#show-hidden-products")?.checked;
    const rows = state.products.filter(item => (showHidden || !item.is_hidden) && `${item.code} ${item.name}`.toLowerCase().includes(query));
    $("#view-products").innerHTML = `
      <section class="panel">
        <div class="panel-head"><div><h2>كتالوج العطور</h2><p>الإخفاء يحافظ على المنتج ويمكن استرجاعه لاحقاً.</p></div><div class="toolbar"><input id="product-search" value="${escapeHtml(query)}" placeholder="ابحث بالاسم أو الكود" /><label class="check-label"><input id="show-hidden-products" type="checkbox" ${showHidden ? "checked" : ""}/> المخفية</label><button class="primary-button" id="add-product">منتج جديد <b>+</b></button></div></div>
        <table class="data-table"><thead><tr><th>الكود</th><th>الاسم</th><th>القسم</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
          ${rows.length ? rows.map(productRow).join("") : '<tr><td colspan="5" class="empty">لا توجد منتجات مطابقة.</td></tr>'}
        </tbody></table>
      </section>`;
    $("#product-search").addEventListener("input", renderProducts);
    $("#show-hidden-products").addEventListener("change", renderProducts);
    $("#add-product").addEventListener("click", () => openProductDialog());
    $("#view-products").querySelectorAll("[data-product-action]").forEach(button => button.addEventListener("click", () => productAction(button.dataset.productAction, button.dataset.id)));
  }

  function productRow(item) {
    return `<tr class="${item.is_hidden ? "is-hidden" : ""}">
      <td><span class="code">${escapeHtml(item.code)}</span></td><td>${escapeHtml(item.name)}</td><td>${item.gender === "femme" ? "نسائي" : "رجالي"}</td>
      <td><span class="badge ${item.is_hidden ? "hidden-badge" : "visible"}">${item.is_hidden ? "مخفي" : "ظاهر"}</span></td>
      <td><div class="row-actions"><button class="table-action" data-product-action="edit" data-id="${item.id}">تعديل</button><button class="table-action ${item.is_hidden ? "restore" : ""}" data-product-action="toggle" data-id="${item.id}">${item.is_hidden ? "استرجاع" : "إخفاء"}</button></div></td>
    </tr>`;
  }

  function renderMedia() {
    $("#view-media").innerHTML = `
      <section class="panel"><div class="panel-head"><div><h2>مكتبة الصور</h2><p>أخفِ أي صورة من الموقع دون حذفها نهائياً.</p></div></div>
      <div class="upload-box"><div><strong>رفع صورة جديدة</strong><p>PNG أو JPG أو WEBP — تحفظ في Supabase Storage.</p></div><input id="media-upload" type="file" accept="image/png,image/jpeg,image/webp" /></div>
      <div class="media-grid">${state.assets.length ? state.assets.map(assetCard).join("") : '<div class="empty">لا توجد صور مسجلة بعد.</div>'}</div></section>`;
    $("#media-upload").addEventListener("change", uploadAsset);
    $("#view-media").querySelectorAll("[data-asset-action]").forEach(button => button.addEventListener("click", () => assetAction(button.dataset.assetAction, button.dataset.id)));
  }

  function assetCard(item) {
    const url = item.public_url || `../${item.storage_path || ""}`;
    return `<article class="media-card ${item.is_hidden ? "is-hidden" : ""}"><img class="media-thumb" src="${escapeHtml(url)}" alt="${escapeHtml(item.alt_text)}" /><div class="media-info"><strong>${escapeHtml(item.asset_key)}</strong><small>${escapeHtml(item.placement)} · ${item.is_hidden ? "مخفي" : "ظاهر"}</small><div class="row-actions"><button class="table-action ${item.is_hidden ? "restore" : ""}" data-asset-action="toggle" data-id="${item.id}">${item.is_hidden ? "استرجاع" : "إخفاء"}</button></div></div></article>`;
  }

  function renderContent() {
    $("#view-content").innerHTML = `<section class="panel"><div class="panel-head"><div><h2>محتوى الموقع</h2><p>عدّل النصوص دون لمس التصميم أو الكود.</p></div></div><div class="content-list">${state.content.length ? state.content.map(item => `<div class="content-row"><span class="content-key">${escapeHtml(item.content_key)}</span><span class="content-value">${escapeHtml(item.value)}</span><button class="table-action" data-content-id="${item.id}">تعديل</button></div>`).join("") : '<div class="empty">شغّل supabase/schema.sql أولاً.</div>'}</div></section>`;
    $("#view-content").querySelectorAll("[data-content-id]").forEach(button => button.addEventListener("click", () => openContentDialog(button.dataset.contentId)));
  }

  function renderSettings() {
    $("#view-settings").innerHTML = `<section class="panel"><div class="panel-head"><div><h2>إعدادات المتجر</h2><p>بيانات التواصل والعرض الحالي.</p></div></div><div class="settings-list">${state.settings.length ? state.settings.map(item => `<div class="setting-row"><span class="setting-label">${escapeHtml(item.label || item.setting_key)}</span><label><input data-setting-key="${escapeHtml(item.setting_key)}" value="${escapeHtml(item.value)}" /></label></div>`).join("") : '<div class="empty">لا توجد إعدادات بعد.</div>'}</div><div class="panel-head"><button id="save-settings" class="primary-button">حفظ الإعدادات <b>←</b></button></div></section>`;
    $("#save-settings")?.addEventListener("click", saveSettings);
  }

  function openProductDialog(id) {
    const product = state.products.find(item => item.id === id);
    $("#product-dialog-title").textContent = product ? "تعديل المنتج" : "منتج جديد";
    $("#product-id").value = product?.id || "";
    $("#product-code").value = product?.code || "";
    $("#product-name").value = product?.name || "";
    $("#product-gender").value = product?.gender || "femme";
    $("#product-order").value = product?.sort_order || 0;
    $("#product-featured").checked = product?.is_featured !== false;
    $("#product-dialog").showModal();
  }

  async function saveProduct(event) {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const id = $("#product-id").value;
    const payload = { code: $("#product-code").value.trim(), name: $("#product-name").value.trim(), gender: $("#product-gender").value, sort_order: Number($("#product-order").value) || 0, is_featured: $("#product-featured").checked, updated_by: state.session.user.id };
    const result = id ? await client.from("products").update(payload).eq("id", id) : await client.from("products").insert(payload);
    if (result.error) return toast(result.error.message);
    $("#product-dialog").close();
    await loadData(); renderView(); toast("تم حفظ المنتج");
  }

  async function productAction(action, id) {
    if (action === "edit") return openProductDialog(id);
    const product = state.products.find(item => item.id === id);
    const result = await client.from("products").update({ is_hidden: !product.is_hidden, updated_by: state.session.user.id }).eq("id", id);
    if (result.error) return toast(result.error.message);
    await loadData(); renderView(); toast(product.is_hidden ? "تم استرجاع المنتج" : "تم إخفاء المنتج");
  }

  async function uploadAsset(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
    const path = `${Date.now()}-${safeName}`;
    const upload = await client.storage.from("atheer-media").upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) return toast(upload.error.message);
    const publicUrl = client.storage.from("atheer-media").getPublicUrl(path).data.publicUrl;
    const asset = await client.from("site_assets").insert({ asset_key: path.replace(/\.[^.]+$/, ""), storage_path: path, public_url: publicUrl, alt_text: file.name, placement: "other" });
    if (asset.error) return toast(asset.error.message);
    await loadData(); renderMedia(); toast("تم رفع الصورة");
  }

  async function assetAction(action, id) {
    if (action !== "toggle") return;
    const asset = state.assets.find(item => item.id === id);
    const result = await client.from("site_assets").update({ is_hidden: !asset.is_hidden, updated_by: state.session.user.id }).eq("id", id);
    if (result.error) return toast(result.error.message);
    await loadData(); renderMedia(); toast(asset.is_hidden ? "تم استرجاع الصورة" : "تم إخفاء الصورة");
  }

  function openContentDialog(id) {
    const item = state.content.find(content => content.id === id);
    if (!item) return;
    $("#content-id").value = item.id;
    $("#content-key").value = item.content_key;
    $("#content-label").value = item.label || item.content_key;
    $("#content-value").value = item.value;
    $("#content-dialog").showModal();
  }

  async function saveContent(event) {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const result = await client.from("site_content").update({ label: $("#content-label").value.trim(), value: $("#content-value").value, updated_by: state.session.user.id }).eq("id", $("#content-id").value);
    if (result.error) return toast(result.error.message);
    $("#content-dialog").close(); await loadData(); renderContent(); toast("تم حفظ المحتوى");
  }

  async function saveSettings() {
    const inputs = [...document.querySelectorAll("[data-setting-key]")];
    for (const input of inputs) {
      const result = await client.from("settings").update({ value: input.value, updated_by: state.session.user.id }).eq("setting_key", input.dataset.settingKey);
      if (result.error) return toast(result.error.message);
    }
    await loadData(); toast("تم حفظ الإعدادات");
  }

  async function boot() {
    $("#login-form").addEventListener("submit", signIn);
    $("#product-form").addEventListener("submit", saveProduct);
    $("#content-form").addEventListener("submit", saveContent);
    $("#logout-btn").addEventListener("click", async () => { await client.auth.signOut(); showAuth(); });
    document.querySelectorAll(".nav-item[data-view]").forEach(item => item.addEventListener("click", () => navView(item.dataset.view)));
    $("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
    if (!isConfigured()) {
      setLoginError("لوحة التحكم غير مهيأة بعد: أضف رابط Supabase والمفتاح العام في admin/config.js.");
      return;
    }
    const { data } = await client.auth.getSession();
    if (data.session) {
      try { showApp(data.session); await loadData(); renderView(); } catch (error) { showAuth(); setLoginError(error.message || "تعذر تحميل البيانات."); }
    }
    client.auth.onAuthStateChange((_event, session) => { if (session) showApp(session); else showAuth(); });
  }

  boot();
})();