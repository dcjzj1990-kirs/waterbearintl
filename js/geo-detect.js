/**
 * WaterbearIntl - Geo-Detection Module
 * Auto-detects visitor country via IP API and switches language accordingly.
 * Prioritizes user's manual language selection over auto-detection.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'water-bearintl_lang';
  const MANUAL_FLAG_KEY = 'water-bearintl_manual_lang';
  const GEO_CACHE_KEY = 'water-bearintl_geo_country';

  /** Map country codes to languages */
  const COUNTRY_LANG_MAP = {
    cn: 'zh', hk: 'zh', tw: 'zh', sg: 'zh', my: 'zh',
    es: 'es', mx: 'es', ar: 'es', cl: 'es', co: 'es', pe: 'es',
    sa: 'ar', ae: 'ar', eg: 'ar', qa: 'ar', kw: 'ar', om: 'ar', bh: 'ar',
    fr: 'fr', be: 'fr', ch: 'fr',
    de: 'de', at: 'de',
    ru: 'ru', by: 'ru', kz: 'ru',
    jp: 'ja',
    kr: 'ko',
    pt: 'pt', br: 'pt',
    it: 'it',
    nl: 'nl',
    pl: 'pl',
    tr: 'tr',
    th: 'th',
    vn: 'vi',
    id: 'id',
    in: 'en'
  };

  /** Country-code to display name for UI */
  const COUNTRY_NAMES = {
    cn: 'China', hk: 'Hong Kong', tw: 'Taiwan', sg: 'Singapore', my: 'Malaysia',
    us: 'United States', gb: 'United Kingdom', ca: 'Canada', au: 'Australia', nz: 'New Zealand',
    de: 'Germany', fr: 'France', es: 'Spain', it: 'Italy', nl: 'Netherlands',
    be: 'Belgium', at: 'Austria', ch: 'Switzerland', pl: 'Poland', tr: 'Turkey',
    jp: 'Japan', kr: 'South Korea', th: 'Thailand', vn: 'Vietnam', id: 'Indonesia',
    ph: 'Philippines', in: 'India', pk: 'Pakistan', bd: 'Bangladesh',
    mx: 'Mexico', ar: 'Argentina', cl: 'Chile', co: 'Colombia', pe: 'Peru', br: 'Brazil',
    sa: 'Saudi Arabia', ae: 'United Arab Emirates', eg: 'Egypt', qa: 'Qatar',
    kw: 'Kuwait', om: 'Oman', bh: 'Bahrain', ru: 'Russia', by: 'Belarus', kz: 'Kazakhstan',
    za: 'South Africa', ng: 'Nigeria', ke: 'Kenya'
  };

  window.geoDetect = {

    /** Whether user has manually chosen a language */
    isManual() {
      return sessionStorage.getItem(MANUAL_FLAG_KEY) === '1';
    },

    /** Called when user manually switches language via lang-btn */
    onManualLangChange(lang) {
      sessionStorage.setItem(MANUAL_FLAG_KEY, '1');
      this.updateFlagIndicator(lang);
    },

    /**
     * Detect country via free IP APIs (tries multiple in order)
     */
    async detectCountry() {
      // Return cached result if available
      const cached = sessionStorage.getItem(GEO_CACHE_KEY);
      if (cached) return cached;

      const apis = [
        async () => {
          const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
          if (!res.ok) throw new Error('ipapi.co failed');
          const data = await res.json();
          return data.country_code?.toLowerCase();
        },
        async () => {
          const res = await fetch('https://ipinfo.io/json?token=', { signal: AbortSignal.timeout(4000) });
          if (!res.ok) throw new Error('ipinfo.io failed');
          const data = await res.json();
          return data.country?.toLowerCase();
        },
        async () => {
          const res = await fetch('/api/geo', { signal: AbortSignal.timeout(4000) });
          if (!res.ok) throw new Error('proxy failed');
          const data = await res.json();
          return data.country_code?.toLowerCase();
        }
      ];

      for (const fn of apis) {
        try {
          const country = await fn();
          if (country && country.length === 2) {
            sessionStorage.setItem(GEO_CACHE_KEY, country);
            return country;
          }
        } catch (_) { /* try next */ }
      }
      return null;
    },

    /**
     * Determine language from country code
     */
    getLangForCountry(countryCode) {
      if (!countryCode) return null;
      return COUNTRY_LANG_MAP[countryCode] || 'en';
    },

    /**
     * Update the lang-btn with flag indicator
     */
    updateFlagIndicator(lang) {
      const flagMap = { zh: '🇨🇳', en: '🇺🇸', es: '🇪🇸', ar: '🇸🇦', fr: '🇫🇷', de: '🇩🇪', ru: '🇷🇺', ja: '🇯🇵', ko: '🇰🇷', pt: '🇧🇷', it: '🇮🇹', nl: '🇳🇱', pl: '🇵🇱', tr: '🇹🇷', th: '🇹🇭', vi: '🇻🇳', id: '🇮🇩' };
      const flag = flagMap[lang] || '🇬🇧';
      const btns = document.querySelectorAll('.lang-btn');
      if (btns.length > 0) {
        const activeBtn = document.querySelector('.lang-btn[data-lang="' + lang + '"]');
        if (activeBtn) {
          activeBtn.setAttribute('data-flag', flag);
        }
      }
      // Also update the nav indicator if exists
      const indicator = document.getElementById('lang-indicator');
      if (indicator) {
        indicator.textContent = flag;
      }
    },

    /**
     * Initialize geo-detection
     */
    async init() {
      // If user has manually chosen a language, respect that
      if (this.isManual()) {
        this.updateFlagIndicator(i18n.currentLang);
        return;
      }

      try {
        const country = await this.detectCountry();
        if (country) {
          const detectedLang = this.getLangForCountry(country);
          const countryName = COUNTRY_NAMES[country] || country.toUpperCase();

          console.log('[GeoDetect] Country: ' + countryName + ' → Language: ' + detectedLang);

          // Only switch if detected language is different from current
          if (detectedLang !== i18n.currentLang && i18n.translations[detectedLang]) {
            i18n.setLang(detectedLang);
          }
          this.updateFlagIndicator(i18n.currentLang);
        }
      } catch (e) {
        console.warn('[GeoDetect] Failed to detect location:', e.message);
        // Keep current language
      }
    }
  };

})();