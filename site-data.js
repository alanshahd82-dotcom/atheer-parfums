(function () {
  "use strict";
  const config = window.ATHEER_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) return;
  const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  const headers = { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` };
  const assetSelectors = {
    hero: [".hero::before"],
    product: [".product-shot"],
    offer: [".offer-main-img"],
    "gallery-flatlay": ['img[alt*="الحمضيات"]'],
    "gallery-room": ['img[alt*="مساحة مغربية"]'],
    "gallery-lantern": ['img[alt*="فانوس"]'],
    "gallery-zellige": ['img[alt*="زليج"]'],
    "gallery-hero": ['img[alt*="طاولة مغربية"]'],
    "gallery-gift": ['img[alt*="مجموعة عطر"]'],
    "gallery-closeup": ['img[alt*="تفاصيل"]']
  };
  const contentSelectors = {
    hero_subtitle: "#hero-title small",
    hero_copy: ".hero-copy",
    offer_subtitle: ".offer-sub",
    product_name: "#perfume-title",
    footer_copy: ".footer-copy"
  };

  function visible(selector) { return document.querySelector(selector.replace("::before", "")); }
  function updateAssets(assets) {
    assets.forEach(asset => {
      const url = asset.public_url || asset.storage_path;
      if (!url) return;
      const selectors = assetSelectors[asset.asset_key] || [];
      selectors.forEach(selector => {
        if (selector.endsWith("::before")) {
          document.documentElement.style.setProperty("--atheer-hero-image", `url("${url}")`);
          return;
        }
        document.querySelectorAll(selector).forEach(image => {
          image.src = url;
          if (asset.alt_text) image.alt = asset.alt_text;
        });
      });
    });
  }
  function updateContent(items) {
    items.forEach(item => {
      const selector = contentSelectors[item.content_key];
      if (selector) document.querySelectorAll(selector).forEach(element => { element.textContent = item.value; });
    });
  }
  async function fetchTable(table, query) {
    const response = await fetch(`${endpoint}/${table}?${query}`, { headers });
    if (!response.ok) throw new Error("Supabase content unavailable");
    return response.json();
  }
  async function sync() {
    try {
      const [assets, content] = await Promise.all([
        fetchTable("site_assets", "select=asset_key,storage_path,public_url,alt_text&is_hidden=eq.false&order=sort_order"),
        fetchTable("site_content", "select=content_key,value&is_hidden=eq.false")
      ]);
      updateAssets(assets);
      updateContent(content);
    } catch (_error) {
      // Static HTML remains the intentional fallback when the schema is not ready.
    }
  }
  sync();
})();