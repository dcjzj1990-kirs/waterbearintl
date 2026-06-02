/**
 * WaterbearIntl - 前端数据加载器
 * 从后端 API 动态加载产品和配置数据，兼容静态模式
 * 用法：在 i18n.js 之前引入 <script src="js/data-loader.js"></script>
 */
(function () {
  const API = ''; // 相对路径，与页面同源

  // ============ 工具函数 ============
  async function fetchJSON(url, options = {}) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('API fetch failed:', e.message);
      return null;
    }
  }

  // ============ 加载产品数据 ============
  async function loadProducts() {
    const data = await fetchJSON(API + '/api/products');
    if (!data) return null;
    window.__products = data;
    return data;
  }

  // ============ 加载站点配置 ============
  async function loadConfig() {
    const data = await fetchJSON(API + '/api/settings');
    if (!data || data.error) return null;
    window.__siteConfig = data;
    return data;
  }

  // ============ 渲染产品卡片 ============
  function renderProductCards(container, products, lang) {
    if (!container || !products) return;
    const isZh = lang === 'zh';
    container.innerHTML = products.map(p => {
      const name = p.title || p.name || 'Untitled';
      const desc = p.description || '';
      const imgHtml = p.image
        ? `<img src="${p.image}" alt="${name}" class="product-card-img">`
        : `<div class="img-placeholder" style="background:rgba(255,255,255,.05);height:180px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.3);">No image</div>`;
      const tagMap = { 'bestseller': i18n.t('tag_bestseller'), 'hot': i18n.t('tag_hot'), 'new': i18n.t('tag_new') };
      const tagHtml = p.tag ? `<span class="product-tag">${tagMap[p.tag] || p.tag}</span>` : '';
      const category = p.category || 'machinery';
      return `
        <div class="product-card fade-in" data-category="${category}">
          <div class="product-img">${imgHtml}${tagHtml}</div>
          <div class="product-body">
            <h3>${name}</h3>
            <p>${desc}</p>
            <div class="product-meta">
              <span class="sku">SKU: ${p.sku || 'N/A'}</span>
              <a href="contact.html" class="btn btn-primary" style="padding:6px 14px;font-size:0.82rem;">${i18n.t('btn_inquiry')}</a>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ============ 应用站点配置到页面 ============
  function applyConfig(config, lang) {
    if (!config) return;
    const isZh = lang === 'zh';

    // Update footer contact info
    const footerEmail = document.querySelector('.footer-col a[href^="mailto"]');
    if (footerEmail && config.contact_email) {
      footerEmail.href = 'mailto:' + config.contact_email;
      footerEmail.textContent = config.contact_email;
    }
    const footerPhone = document.querySelector('.footer-col a[href^="tel"]');
    if (footerPhone && config.contact_phone) {
      footerPhone.href = 'tel:' + config.contact_phone.replace(/\s/g, '');
      footerPhone.textContent = config.contact_phone;
    }
  }

  // ============ 提交联系表单 ============
  async function submitContactForm(formData) {
    return await fetchJSON(API + '/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
  }

  // ============ 暴露全局 API ============
  window.GlobexData = {
    loadProducts,
    loadConfig,
    renderProductCards,
    applyConfig,
    submitContactForm,
    API
  };

  // 页面加载后自动尝试加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadConfig().then(c => {
        if (c && window.i18n) applyConfig(c, window.i18n.currentLang);
      });
    });
  } else {
    loadConfig().then(c => {
      if (c && window.i18n) applyConfig(c, window.i18n.currentLang);
    });
  }
})();
