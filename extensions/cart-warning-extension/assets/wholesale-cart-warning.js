(function() {
 
  
  // Only run if the configuration exists (injected via Liquid)
  if (!window.wholesaleEngineConfig) {
    console.log("wholesale-cart-warning.js: Config not found. Aborting.");
    return;
  }

  console.log('Wholesale Engine Cart Warning Extension Loaded');

  const config = window.wholesaleEngineConfig;
  const minQuantity = config.minQuantity;
  let currentCartCount = config.currentCartCount;

  // Parse error messages from the raw string or object
  let errorMessages = {};
  if (config.errorMessagesRaw) {
    if (typeof config.errorMessagesRaw === 'string') {
      try {
        errorMessages = JSON.parse(config.errorMessagesRaw);
      } catch (e) {
        console.warn("Could not parse Wholesale Engine error messages", e);
      }
    } else {
      // It's already an object (parsed by Liquid)
      errorMessages = config.errorMessagesRaw;
    }
  }

  // Format the error message
  function getErrorMessage(total) {
    let msg = "";
    if (config.isNewCustomer) {
      msg = errorMessages?.newCustomerMessage || 
            `As a new customer, you must order at least {limit} items. You currently have {total} items in your cart.`;
    } else {
      msg = errorMessages?.taggedCustomerMessage || 
            `Based on your customer tags, you must order at least {limit} items. You currently have {total} items in your cart.`;
    }
    return msg.replace(/{limit}/g, minQuantity).replace(/{total}/g, total);
  }

  // Inject or update the warning UI
  function updateUI(total) {
    const isError = total > 0 && total < minQuantity;
    const errorMessage = getErrorMessage(total);

    const checkoutButtons = document.querySelectorAll('button[name="checkout"], input[name="checkout"], a[href="/checkout"], #checkout, .cart__checkout-button');
    
    console.log("wholesale-cart-warning.js: Found checkout buttons:", checkoutButtons.length);
    
    checkoutButtons.forEach(btn => {
      // Differentiate between Drawer and Cart Page
      const isDrawer = btn.closest('cart-drawer') || btn.closest('.drawer');
      const bannerClass = isDrawer ? 'wholesale-engine-cart-warning-drawer' : 'wholesale-engine-cart-warning-page';
      
      let warningBanner = document.querySelector('.' + bannerClass);
      
      if (!warningBanner) {
        warningBanner = document.createElement('div');
        warningBanner.className = 'wholesale-engine-cart-warning ' + bannerClass;
        
        if (isDrawer) {
          // Inside a Drawer
          let inner = isDrawer.querySelector('.drawer__inner') || isDrawer;
          let header = inner.querySelector('.drawer__header');
          if (header) {
            inner.insertBefore(warningBanner, header.nextSibling);
          } else {
            inner.insertBefore(warningBanner, inner.firstChild);
          }
        } else {
          // On the Cart Page
          let cartItems = document.querySelector('cart-items');
          if (cartItems) {
            // Dawn theme: put it at the very top of the page-width wrapper
            let wrapper = cartItems.closest('.page-width') || cartItems.closest('.container') || cartItems.parentNode;
            wrapper.insertBefore(warningBanner, wrapper.firstChild);
          } else {
            // Fallback for other themes
            let mainForm = document.querySelector('form[action^="/cart"]');
            if (mainForm) {
              let wrapper = mainForm.closest('.page-width') || mainForm.closest('.container') || mainForm.parentNode;
              wrapper.insertBefore(warningBanner, wrapper.firstChild);
            } else {
              document.body.insertBefore(warningBanner, document.body.firstChild);
            }
          }
        }
      }

      if (isError) {
        warningBanner.textContent = errorMessage;
        warningBanner.classList.add('is-visible');
        btn.setAttribute('disabled', 'disabled');
        btn.classList.add('disabled');
      } else {
        warningBanner.classList.remove('is-visible');
        btn.removeAttribute('disabled');
        btn.classList.remove('disabled');
      }
    });
  }

  // Initial check on page load
  function init() {
    updateUI(currentCartCount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Intercept Fetch API to detect Cart AJAX updates
  const originalFetch = window.fetch;
  window.fetch = async function() {
    const response = await originalFetch.apply(this, arguments);
    const url = arguments[0];
    
    // Check if the request is modifying the cart or fetching the cart state
    if (typeof url === 'string' && (url.includes('/cart/add') || url.includes('/cart/change') || url.includes('/cart/update') || url.includes('/cart.js'))) {
      response.clone().json().then(data => {
        if (data.item_count !== undefined) {
          currentCartCount = data.item_count;
          updateUI(currentCartCount);
        }
      }).catch(e => {
        // Ignore json parse errors
      });
    }
    return response;
  };

  // Intercept XMLHttpRequest to detect Cart AJAX updates
  const originalXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function() {
    this.addEventListener('load', function() {
      const url = this.responseURL || arguments[1];
      if (typeof url === 'string' && (url.includes('/cart/add') || url.includes('/cart/change') || url.includes('/cart/update') || url.includes('/cart.js'))) {
        try {
          const data = JSON.parse(this.responseText);
          if (data.item_count !== undefined) {
            currentCartCount = data.item_count;
            updateUI(currentCartCount);
          }
        } catch (e) {
          // Ignore
        }
      }
    });
    return originalXHR.apply(this, arguments);
  };
})();  
