document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('wholesale-registration-modal');
  const closeBtn = document.querySelector('.wholesale-modal-close');
  const form = document.getElementById('wholesale-registration-form');
  const messageEl = document.getElementById('wholesale-form-message');
  const submitBtn = document.getElementById('wholesale-submit-btn');
  
  const sameAsBillingCheckbox = document.getElementById('sameAsBilling');
  const shippingSection = document.getElementById('shipping-address-section');

  const questionStep = document.getElementById('wholesale-question-step');
  const formStep = document.getElementById('wholesale-form-step');
  const showFormBtn = document.getElementById('wholesale-show-form-btn');
  const resetBtn = document.getElementById('wholesale-reset-btn');

  if (!modal || !form) return;

  if (showFormBtn && questionStep && formStep) {
    showFormBtn.addEventListener('click', () => {
      questionStep.style.display = 'none';
      formStep.style.display = 'block';
      // Auto-focus first input for accessibility
      const firstInput = formStep.querySelector('input');
      if (firstInput) firstInput.focus();
    });
  }

  function resetSteps() {
    if (questionStep && formStep) {
      questionStep.style.display = 'block';
      formStep.style.display = 'none';
    }
  }

  function clearFormErrors() {
    const errorInputs = form.querySelectorAll('.has-error');
    errorInputs.forEach(input => {
      input.classList.remove('has-error');
    });

    const errorMessages = form.querySelectorAll('.wholesale-field-error');
    errorMessages.forEach(msg => {
      msg.textContent = '';
      msg.classList.remove('show');
    });

    messageEl.hidden = true;
    messageEl.className = 'wholesale-message';
    messageEl.textContent = '';
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      clearFormErrors();
      resetSteps();
    });
  }

  if (sameAsBillingCheckbox && shippingSection) {
    sameAsBillingCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        shippingSection.style.display = 'none';
        const reqFields = shippingSection.querySelectorAll('input[required], select[required]');
        reqFields.forEach(f => f.removeAttribute('required'));
      } else {
        shippingSection.style.display = 'block';
      }
    });
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('a[href="#wholesale-register"]');
    if (trigger) {
      e.preventDefault();
      openModal();
    }
  });

  closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  function openModal() {
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; 
    clearFormErrors();
    resetSteps();
  }

  function closeModal() {
    if (document.activeElement && modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    
    // Automatically reset form when closed
    form.reset();
    clearFormErrors();
    resetSteps();
  }

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Custom JS Validation
    const errorInputs = form.querySelectorAll('.has-error');
    errorInputs.forEach(input => {
      input.classList.remove('has-error');
    });
    
    const errorMessages = form.querySelectorAll('.wholesale-field-error');
    errorMessages.forEach(msg => {
      msg.textContent = '';
      msg.classList.remove('show');
    });

    let isValid = true;
    let firstErrorField = null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9+\-\s()]{7,20}$/; // Basic phone validation
    const zipRegex = /^[a-zA-Z0-9\s\-]{3,12}$/; // Basic zip validation

    const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
    
    // First, check all required fields for emptiness
    requiredFields.forEach(field => {
      if (field.offsetParent !== null) {
        const val = field.value.trim();
        if (!val) {
          setError(field, 'This field is required.');
        }
      }
    });

    // Then, validate specific formats if they are not empty
    const allInputs = form.querySelectorAll('input');
    allInputs.forEach(field => {
      if (field.offsetParent !== null) {
        const val = field.value.trim();
        if (val) {
          if (field.type === 'email' && !emailRegex.test(val)) {
            setError(field, 'Please enter a valid email address.');
          } else if (field.type === 'tel') {
            const digitCount = val.replace(/\D/g, '').length;
            if (!val.startsWith('+')) {
              setError(field, 'Please add your country code (e.g., +1 or +91).');
            } else if (digitCount < 10) {
              setError(field, 'Phone number must have at least 10 digits.');
            }
          } else if (field.name === 'b_zip' || field.name === 's_zip') {
            if (!zipRegex.test(val)) {
              setError(field, 'Please enter a valid ZIP / Postal code.');
            }
          }
        }
      }
    });

    function setError(field, message) {
      field.classList.add('has-error');
      const errorDiv = document.getElementById(`error-${field.id}`);
      if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
      }
      isValid = false;
      if (!firstErrorField) firstErrorField = field;
    }

    if (!isValid) {
      // Don't show the bottom error message since inline messages handle it now
      if (firstErrorField) firstErrorField.focus();
      return; // Stop submission
    }

    // Disable submit button to prevent double submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    messageEl.hidden = true;
    messageEl.className = 'wholesale-message';
    
    try {
      const formData = new FormData(form);

      // Concatenate contactName if firstName and lastName were used
      const firstName = formData.get('firstName') || '';
      const lastName = formData.get('lastName') || '';
      if (firstName || lastName) {
        formData.set('contactName', `${firstName} ${lastName}`.trim());
      }

      // Format Billing Address
      const b_address1 = formData.get('b_address1') || '';
      const b_address2 = formData.get('b_address2') || '';
      const b_city = formData.get('b_city') || '';
      const b_state = formData.get('b_state') || '';
      const b_zip = formData.get('b_zip') || '';
      const b_country = formData.get('b_country') || '';
      
      const billingData = {
        address1: b_address1,
        address2: b_address2,
        city: b_city,
        province: b_state,
        zip: b_zip,
        country: b_country
      };
      
      formData.set('billingAddress', JSON.stringify(billingData));

      // Format Shipping Address
      let shippingData = {};
      if (sameAsBillingCheckbox && sameAsBillingCheckbox.checked) {
        shippingData = billingData;
      } else {
        const s_address1 = formData.get('s_address1') || '';
        const s_address2 = formData.get('s_address2') || '';
        const s_city = formData.get('s_city') || '';
        const s_state = formData.get('s_state') || '';
        const s_zip = formData.get('s_zip') || '';
        const s_country = formData.get('s_country') || '';
        
        shippingData = {
          address1: s_address1,
          address2: s_address2,
          city: s_city,
          province: s_state,
          zip: s_zip,
          country: s_country
        };
      }

      formData.set('shippingAddress', JSON.stringify(shippingData));

      const actionUrl = form.getAttribute('action'); // "/a/wholesale/api/register"
      
      const response = await fetch(actionUrl, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header when sending FormData, the browser sets it with the correct boundary
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showMessage('Your wholesale application has been submitted successfully! We will review it shortly.', 'success');
        form.reset();
        
        // Auto-close after 3 seconds on success
        setTimeout(() => {
          closeModal();
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
        }, 3000);
      } else {
        showMessage(result.error || 'Failed to submit application. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    } catch (error) {
      console.error('Error submitting wholesale application:', error);
      showMessage('A network error occurred. Please try again later.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  });

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `wholesale-message ${type}`;
    messageEl.hidden = false;
  }
});
