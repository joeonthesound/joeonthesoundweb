const PRODUCT_ALIASES = {
  production: 'artistRelease',
  mixing: 'artistRelease',
  customSong: 'jingle',
  metadata: 'sonicIdentity'
};

let paypalSdkPromise = null;

function loadPayPalSdk(baseUrl, clientId, currency) {
  if (window.paypal?.Buttons) return Promise.resolve(window.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;

  paypalSdkPromise = new Promise((resolve, reject) => {
    if (!clientId || clientId === 'CLIENT_ID_PLACEHOLDER') {
      reject(new Error('PayPal public Client ID is missing from window.ENV.AppPagoJoeontheSoundWebClientID.'));
      return;
    }
    const existing = document.querySelector('script[data-paypal-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.paypal), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    const sdkUrl = new URL(baseUrl);
    sdkUrl.searchParams.set('client-id', clientId);
    sdkUrl.searchParams.set('currency', currency);
    script.src = sdkUrl.toString();
    script.async = true;
    script.dataset.paypalSdk = 'true';
    script.addEventListener('load', () => resolve(window.paypal), { once: true });
    script.addEventListener('error', event => {
      paypalSdkPromise = null;
      reject(event);
    }, { once: true });
    document.head.append(script);
  });
  return paypalSdkPromise;
}

export function mountQuoter({ container, config, dictionary, preselectedService = null }) {
  const initialProduct = PRODUCT_ALIASES[preselectedService] || preselectedService;
  const state = {
    step: 1,
    product: config.products.some(item => item.id === initialProduct) ? initialProduct : null,
    tier: null,
    metric: null,
    vocals: null,
    territory: '',
    reference: '',
    deadline: '',
    name: '',
    addons: [],
    termsAccepted: false
  };

  const product = () => config.products.find(item => item.id === state.product);
  const vocal = () => config.vocals.find(item => item.id === state.vocals);
  const addons = () => config.addons.filter(item => state.addons.includes(item.id));
  const money = value => `$${Number(value || 0).toFixed(2)} ${config.currency}`;
  const showToast = message => {
    const toast = container.querySelector('.toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  };

  function defaultMetric(item) {
    if (!item) return null;
    if (item.pricing === 'perMinute' || item.pricing === 'linearSeconds') {
      return item.metric.default || item.metric.options?.[0] || item.metric.min;
    }
    return item.metric?.id || null;
  }

  function costs() {
    const item = product();
    let creative = 0;
    if (item) {
      if (item.pricing === 'linearSeconds') {
        const seconds = Number(state.metric || item.metric.min);
        creative = item.minimumPrice
          + ((seconds - item.metric.min) * (item.maximumPrice - item.minimumPrice) / (item.metric.max - item.metric.min));
      } else if (item.pricing === 'tier') {
        creative = item.tiers.find(tier => tier.id === state.tier)?.base || 0;
      } else if (item.pricing === 'perMinute') {
        creative = Number(state.metric || 0) * item.rate;
      }
      creative = Math.max(creative, item.minimum || 0);
    }
    const external = vocal()?.price || 0;
    const extras = addons().reduce((sum, item) => sum + item.price, 0);
    return { creative, external, extras, total: creative + external + extras };
  }

  function calculateQuoterTotal() {
    return Number(costs().total.toFixed(2));
  }

  function productMetricLabel() {
    const item = product();
    if (!item) return '—';
    if (item.id === 'reels') return `${state.metric} ${dictionary.minutes}`;
    if (item.id === 'jingle') return `${state.metric} ${dictionary.seconds}`;
    if (item.id === 'soundtrack') return `${state.metric} ${dictionary.minutes}`;
    if (item.pricing === 'tier') return dictionary.tiers[item.id]?.[state.tier]?.title || '—';
    return dictionary[item.metric?.id] || item.metric?.id || '—';
  }

  function buildBrief() {
    const price = costs();
    const addonNames = addons().map(item => dictionary.addons[item.id].title);
    return [
      dictionary.brief.intro,
      `- ${dictionary.brief.classification}: ${dictionary.products[state.product]?.title || '—'}`,
      `- ${dictionary.brief.metric}: ${productMetricLabel()}`,
      `- ${dictionary.brief.vocals}: ${dictionary.vocals[state.vocals] || '—'}`,
      `- ${dictionary.brief.territory}: ${dictionary.territories[state.territory] || '—'}`,
      `- ${dictionary.brief.reference}: ${state.reference || '—'}`,
      `- ${dictionary.brief.deadline}: ${state.deadline || '—'}`,
      `- ${dictionary.brief.addons}: ${addonNames.join(', ') || dictionary.noAddons}`,
      '',
      `${dictionary.brief.financial}:`,
      `* ${dictionary.brief.base}: ${money(price.creative)}`,
      `* ${dictionary.brief.external}: ${money(price.external)}`,
      `* ${dictionary.brief.total}: ${money(price.total)}`
    ].join('\n');
  }

  function validateStep() {
    if (state.step === 1 && !state.product) return dictionary.select;
    if (state.step === 2 && (product()?.pricing === 'tier' ? !state.tier : !state.metric)) return dictionary.select;
    if (state.step === 3 && !state.vocals) return dictionary.select;
    if (state.step === 4) {
      if (!state.territory || !state.deadline || !state.name) return dictionary.required;
      if (state.reference) {
        try {
          const url = new URL(state.reference);
          const allowed = ['youtube.com', 'youtu.be', 'spotify.com', 'soundcloud.com'];
          if (!allowed.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return dictionary.invalidUrl;
        } catch {
          return dictionary.invalidUrl;
        }
      }
      const selected = new Date(`${state.deadline}T00:00:00`);
      const minimum = new Date(Date.now() + 48 * 60 * 60 * 1000);
      if (Number.isNaN(selected.getTime()) || selected < minimum) return dictionary.invalidDate;
    }
    return '';
  }

  function productStep() {
    return `
      <fieldset class="quote-step ${state.step === 1 ? 'is-active' : ''}">
        <legend class="heading">${dictionary.steps.product}</legend>
        <div class="quote-product-grid">
          ${config.products.map(item => `
            <label class="quote-choice ${state.product === item.id ? 'is-selected' : ''}">
              <input type="radio" name="product_type" value="${item.id}" ${state.product === item.id ? 'checked' : ''}>
              <strong>${dictionary.products[item.id].title}</strong>
              <small>${dictionary.products[item.id].body}</small>
            </label>`).join('')}
        </div>
      </fieldset>`;
  }

  function formatStep() {
    const item = product();
    let control = '';
    if (item?.id === 'reels') {
      control = `
        <label class="range-field">
          <span>${dictionary.minutesPerMonth}</span>
          <div class="range-value">${state.metric} ${dictionary.minutes}</div>
          <div class="range-controls">
            <button class="range-stepper" type="button" data-range-step="-1" aria-label="${dictionary.decrease}" ${Number(state.metric) <= item.metric.min ? 'disabled' : ''}>‹</button>
            <input type="range" min="${item.metric.min}" max="${item.metric.max}" step="${item.metric.step}" value="${state.metric}" data-metric-range>
            <button class="range-stepper" type="button" data-range-step="1" aria-label="${dictionary.increase}" ${Number(state.metric) >= item.metric.max ? 'disabled' : ''}>›</button>
          </div>
          <small>${dictionary.reelsLinearNote}</small>
        </label>`;
    } else if (item?.id === 'jingle') {
      control = `
        <label class="range-field">
          <span>${dictionary.jingleSeconds}</span>
          <div class="range-value">${state.metric} ${dictionary.seconds}</div>
          <div class="range-controls">
            <button class="range-stepper" type="button" data-range-step="-1" aria-label="${dictionary.decrease}" ${Number(state.metric) <= item.metric.min ? 'disabled' : ''}>‹</button>
            <input type="range" min="${item.metric.min}" max="${item.metric.max}" step="${item.metric.step}" value="${state.metric}" data-metric-range>
            <button class="range-stepper" type="button" data-range-step="1" aria-label="${dictionary.increase}" ${Number(state.metric) >= item.metric.max ? 'disabled' : ''}>›</button>
          </div>
          <small>${dictionary.jingleScaleNote}</small>
        </label>`;
    } else if (item?.id === 'soundtrack') {
      control = `
        <label class="field"><span>${dictionary.soundtrackMinutes}</span>
          <select data-metric-select>${item.metric.options.map(value => `<option value="${value}" ${Number(state.metric) === value ? 'selected' : ''}>${value} ${dictionary.minutes}</option>`).join('')}</select>
        </label>`;
    } else if (item?.pricing === 'tier') {
      control = `
        <h3>${dictionary.tiersTitle}</h3>
        <div class="quote-tier-grid">
          ${item.tiers.map(tier => `
            <label class="quote-choice ${state.tier === tier.id ? 'is-selected' : ''}">
              <input type="radio" name="product_tier" value="${tier.id}" ${state.tier === tier.id ? 'checked' : ''}>
              <strong>${dictionary.tiers[item.id][tier.id].title}</strong>
              <small>${dictionary.tiers[item.id][tier.id].body}</small>
              <b>${money(tier.base)}</b>
            </label>`).join('')}
        </div>`;
    }
    return `
      <section class="quote-step ${state.step === 2 ? 'is-active' : ''}">
        <h2 class="heading">${dictionary.formatTitle}</h2>
        <div class="quote-dynamic">${control}</div>
      </section>`;
  }

  function vocalsStep() {
    return `
      <fieldset class="quote-step ${state.step === 3 ? 'is-active' : ''}">
        <legend class="heading">${dictionary.vocalsTitle}</legend>
        <p class="quote-note">${dictionary.vocalsNotice}</p>
        <div class="quote-segments">
          ${config.vocals.map(item => `
            <label class="quote-choice ${state.vocals === item.id ? 'is-selected' : ''}">
              <input type="radio" name="vocal_type" value="${item.id}" ${state.vocals === item.id ? 'checked' : ''}>
              <strong>${dictionary.vocals[item.id]}</strong>
              <small>${item.price ? `+${money(item.price)}` : dictionary.included}</small>
              ${item.id === 'humanVoice' ? `<small>${dictionary.externalBreakdown}</small>` : ''}
            </label>`).join('')}
        </div>
      </fieldset>`;
  }

  function commercialStep() {
    const minimum = new Date(Date.now() + 48 * 60 * 60 * 1000);
    minimum.setHours(0, 0, 0, 0);
    if (minimum < new Date(Date.now() + 48 * 60 * 60 * 1000)) minimum.setDate(minimum.getDate() + 1);
    const minDate = [
      minimum.getFullYear(),
      String(minimum.getMonth() + 1).padStart(2, '0'),
      String(minimum.getDate()).padStart(2, '0')
    ].join('-');
    return `
      <section class="quote-step ${state.step === 4 ? 'is-active' : ''}">
        <h2 class="heading">${dictionary.commercialTitle}</h2>
        <div class="quote-form-grid">
          <label class="field"><span>${dictionary.name}</span><input type="text" data-field="name" value="${state.name}" placeholder="${dictionary.namePlaceholder}" required></label>
          <label class="field"><span>${dictionary.territory}</span><select data-field="territory" required><option value=""></option>${config.territories.map(id => `<option value="${id}" ${state.territory === id ? 'selected' : ''}>${dictionary.territories[id]}</option>`).join('')}</select></label>
          <label class="field quote-form-wide"><span>${dictionary.reference}</span><input type="url" data-field="reference" value="${state.reference}" placeholder="${dictionary.referencePlaceholder}" inputmode="url"></label>
          <label class="field"><span>${dictionary.deadline}</span><input type="date" data-field="deadline" min="${minDate}" value="${state.deadline}" required></label>
        </div>
      </section>`;
  }

  function addonsStep() {
    const price = costs();
    const brief = buildBrief();
    return `
      <section class="quote-step ${state.step === 5 ? 'is-active' : ''}">
        <h2 class="heading">${dictionary.addonsTitle}</h2>
        <div class="quote-addon-grid">
          ${config.addons.map(item => `
            <label class="quote-choice ${state.addons.includes(item.id) ? 'is-selected' : ''}">
              <input type="checkbox" value="${item.id}" ${state.addons.includes(item.id) ? 'checked' : ''}>
              <strong>${dictionary.addons[item.id].title}</strong>
              <small>${dictionary.addons[item.id].body}</small>
              <b>+${money(item.price)}</b>
            </label>`).join('')}
        </div>
        <div class="quote-breakdown">
          <div><span>${dictionary.creativeBase}</span><strong>${money(price.creative)}</strong></div>
          <div><span>${dictionary.externalLogistics}</span><strong>${money(price.external)}</strong></div>
          <div><span>${dictionary.addonsTotal}</span><strong>${money(price.extras)}</strong></div>
          <div class="quote-breakdown-total"><span>${dictionary.total}</span><strong>${money(price.total)}</strong></div>
        </div>
        <label class="terms-check">
          <input id="termsCheck" type="checkbox" ${state.termsAccepted ? 'checked' : ''}>
          <span>${dictionary.terms}</span>
        </label>
        <p class="terms-error">${state.termsAccepted ? '' : dictionary.termsRequired}</p>
        <div class="quote-actions">
          <a class="btn btn--primary ${state.termsAccepted ? '' : 'is-disabled'}" ${state.termsAccepted ? `href="${config.whatsappBase}${config.whatsapp}?text=${encodeURIComponent(brief)}" target="_blank" rel="noopener noreferrer"` : 'aria-disabled="true" tabindex="-1"'}>${dictionary.send}</a>
          <button class="btn" type="button" data-copy-brief ${state.termsAccepted ? '' : 'disabled'}>${dictionary.copy}</button>
          <div id="paypal-button-wrapper" class="paypal-button-wrapper ${state.termsAccepted ? 'is-enabled' : 'is-disabled'}" aria-disabled="${String(!state.termsAccepted)}">
            <div class="paypal-label">${dictionary.pay}</div>
            <div id="paypal-button-container"><span class="paypal-loading">${dictionary.paymentLoading}</span></div>
          </div>
        </div>
        <p class="quote-payment-note">${dictionary.payNotice}</p>
      </section>`;
  }

  function render() {
    const price = costs();
    container.innerHTML = `
      <div class="quote-tracker" aria-live="polite">
        <div><span>${dictionary.creativeBase}</span><strong>${money(price.creative)}</strong></div>
        <div><span>${dictionary.externalLogistics}</span><strong>${money(price.external)}</strong></div>
        <div class="quote-tracker-total"><span>${dictionary.total}</span><strong>${money(price.total)}</strong></div>
      </div>
      <div class="quote-progress">
        ${Object.values(dictionary.steps).map((label, index) => `<span class="${index + 1 <= state.step ? 'is-active' : ''}" title="${label}"></span>`).join('')}
      </div>
      <p class="quote-step-label">${dictionary.step} ${state.step} ${dictionary.of} 5 — ${Object.values(dictionary.steps)[state.step - 1]}</p>
      <div class="card quote-panel">
        ${productStep()}${formatStep()}${vocalsStep()}${commercialStep()}${addonsStep()}
        <p class="quote-error" aria-live="polite"></p>
        <div class="quote-nav">
          <button class="btn" type="button" data-back ${state.step === 1 ? 'disabled' : ''}>${dictionary.back}</button>
          ${state.step < 5 ? `<button class="btn btn--primary" type="button" data-next>${dictionary.next}</button>` : ''}
        </div>
      </div>
      <div class="toast" role="status" aria-live="polite"></div>`;

    container.querySelectorAll('input[name="product_type"]').forEach(input => input.addEventListener('change', () => {
      state.product = input.value;
      state.tier = null;
      state.metric = defaultMetric(product());
      render();
    }));
    container.querySelector('[data-metric-range]')?.addEventListener('input', event => {
      state.metric = Number(event.target.value);
      render();
    });
    container.querySelectorAll('[data-range-step]').forEach(button => button.addEventListener('click', () => {
      const item = product();
      if (!item?.metric) return;
      const next = Number(state.metric) + Number(button.dataset.rangeStep) * Number(item.metric.step || 1);
      state.metric = Math.min(item.metric.max, Math.max(item.metric.min, next));
      render();
    }));
    container.querySelector('[data-metric-select]')?.addEventListener('change', event => {
      state.metric = Number(event.target.value);
      render();
    });
    container.querySelectorAll('input[name="product_tier"]').forEach(input => input.addEventListener('change', () => {
      state.tier = input.value;
      render();
    }));
    container.querySelectorAll('input[name="vocal_type"]').forEach(input => input.addEventListener('change', () => {
      state.vocals = input.value;
      render();
    }));
    container.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', () => {
      state[input.dataset.field] = input.value.trim();
    }));
    container.querySelectorAll('.quote-addon-grid input').forEach(input => input.addEventListener('change', () => {
      state.addons = input.checked
        ? [...state.addons, input.value]
        : state.addons.filter(id => id !== input.value);
      render();
    }));
    container.querySelector('#termsCheck')?.addEventListener('change', event => {
      state.termsAccepted = event.target.checked;
      render();
    });
    container.querySelector('[data-back]')?.addEventListener('click', () => {
      state.step = Math.max(1, state.step - 1);
      render();
    });
    container.querySelector('[data-next]')?.addEventListener('click', () => {
      const error = validateStep();
      if (error) {
        container.querySelector('.quote-error').textContent = error;
        return;
      }
      state.step = Math.min(5, state.step + 1);
      render();
    });
    container.querySelector('[data-copy-brief]')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(buildBrief());
        showToast(dictionary.copied);
      } catch {
        showToast(dictionary.copyError);
      }
    });

    if (state.step === 5) {
      const paypalContainer = container.querySelector('#paypal-button-container');
      const livePayPalClientId = window.ENV?.AppPagoJoeontheSoundWebClientID;
      loadPayPalSdk(config.paypalSdkUrl, livePayPalClientId, config.currency)
        .then(paypal => {
          if (!paypalContainer?.isConnected || !paypal?.Buttons) return;
          paypalContainer.replaceChildren();
          return paypal.Buttons({
            fundingSource: paypal.FUNDING.PAYPAL,
            style: {
              layout: 'vertical',
              color: 'blue',
              shape: 'rect',
              label: 'paypal'
            },
            createOrder(data, actions) {
              if (!state.termsAccepted) throw new Error(dictionary.termsRequired);
              const finalAmount = calculateQuoterTotal().toFixed(2);
              return actions.order.create({
                purchase_units: [{
                  amount: {
                    currency_code: config.currency,
                    value: finalAmount
                  }
                }]
              });
            },
            onApprove(data, actions) {
              return actions.order.capture().then(details => {
                console.log('PayPal transaction details:', details);
                showToast(dictionary.paymentSuccess);
              });
            },
            onError(error) {
              console.error('PayPal payment error:', error);
              showToast(dictionary.paymentError);
            }
          }).render(paypalContainer);
        })
        .catch(error => {
          console.error('PayPal SDK load error:', error);
          if (paypalContainer?.isConnected) {
            paypalContainer.textContent = dictionary.paymentError;
          }
        });
    }
  }

  if (state.product) state.metric = defaultMetric(product());
  render();
}
