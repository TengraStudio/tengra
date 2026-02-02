/**
 * Form Intelligence - Advanced form detection and auto-fill system
 * Handles multi-step forms, field type detection, and secure data storage
 */

class FormIntelligence {
    constructor() {
        this.profiles = {};
        this.activeProfile = 'default';
        this.fieldMappings = this.getDefaultFieldMappings();
    }

    /**
     * Default field mappings for common form fields
     */
    getDefaultFieldMappings() {
        return {
            // Personal Info
            firstName: {
                patterns: ['firstname', 'first-name', 'first_name', 'fname', 'givenname'],
                type: 'text',
                placeholder: 'John'
            },
            lastName: {
                patterns: ['lastname', 'last-name', 'last_name', 'lname', 'surname', 'familyname'],
                type: 'text',
                placeholder: 'Doe'
            },
            fullName: {
                patterns: ['fullname', 'full-name', 'full_name', 'name', 'your-name'],
                type: 'text',
                placeholder: 'John Doe'
            },
            email: {
                patterns: ['email', 'e-mail', 'emailaddress', 'email-address'],
                type: 'email',
                placeholder: 'john@example.com'
            },
            phone: {
                patterns: ['phone', 'telephone', 'tel', 'mobile', 'phonenumber'],
                type: 'tel',
                placeholder: '+1234567890'
            },
            
            // Address
            address: {
                patterns: ['address', 'street', 'streetaddress', 'address1', 'addressline1'],
                type: 'text',
                placeholder: '123 Main St'
            },
            address2: {
                patterns: ['address2', 'addressline2', 'apt', 'apartment', 'suite'],
                type: 'text',
                placeholder: 'Apt 4B'
            },
            city: {
                patterns: ['city', 'town', 'locality'],
                type: 'text',
                placeholder: 'New York'
            },
            state: {
                patterns: ['state', 'province', 'region', 'county'],
                type: 'text',
                placeholder: 'NY'
            },
            zipCode: {
                patterns: ['zip', 'zipcode', 'postal', 'postalcode', 'postcode'],
                type: 'text',
                placeholder: '10001'
            },
            country: {
                patterns: ['country'],
                type: 'text',
                placeholder: 'United States'
            },
            
            // Company
            company: {
                patterns: ['company', 'organization', 'org', 'companyname'],
                type: 'text',
                placeholder: 'Acme Inc'
            },
            jobTitle: {
                patterns: ['jobtitle', 'title', 'position', 'role'],
                type: 'text',
                placeholder: 'Software Engineer'
            },
            
            // Account
            username: {
                patterns: ['username', 'user-name', 'user_name', 'login', 'userid'],
                type: 'text',
                placeholder: 'johndoe123'
            },
            password: {
                patterns: ['password', 'pass', 'pwd'],
                type: 'password',
                placeholder: '********'
            },
            
            // Other
            website: {
                patterns: ['website', 'url', 'homepage', 'site'],
                type: 'url',
                placeholder: 'https://example.com'
            },
            age: {
                patterns: ['age'],
                type: 'number',
                placeholder: '25'
            },
            birthday: {
                patterns: ['birthday', 'birthdate', 'dob', 'dateofbirth'],
                type: 'date',
                placeholder: '1990-01-01'
            },
            gender: {
                patterns: ['gender', 'sex'],
                type: 'select',
                placeholder: 'Male'
            }
        };
    }

    /**
     * Detect and analyze all forms on the page
     */
    analyzeForms() {
        const forms = Array.from(document.querySelectorAll('form'));
        
        return forms.map((form, index) => {
            const fields = this.detectFormFields(form);
            const formType = this.identifyFormType(form, fields);
            const steps = this.detectMultiStepForm(form);
            const validation = this.extractValidationRules(fields);
            
            return {
                index,
                element: form,
                id: form.id || `form-${index}`,
                action: form.action,
                method: form.method,
                type: formType,
                isMultiStep: steps.length > 1,
                steps,
                fields,
                validation,
                requiredFields: fields.filter(f => f.required).length,
                fillableFields: fields.filter(f => this.canAutoFill(f)).length
            };
        });
    }

    /**
     * Detect and classify form fields
     */
    detectFormFields(form) {
        const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), textarea, select'));
        
        return inputs.map((input, index) => {
            const fieldType = this.identifyFieldType(input);
            const label = this.findFieldLabel(input);
            const validation = this.extractFieldValidation(input);
            
            return {
                index,
                element: input,
                type: input.type || input.tagName.toLowerCase(),
                name: input.name,
                id: input.id,
                label,
                placeholder: input.placeholder,
                value: input.value,
                required: input.required || validation.required,
                pattern: input.pattern,
                minLength: input.minLength,
                maxLength: input.maxLength,
                min: input.min,
                max: input.max,
                validation,
                fieldType, // Our detected type (email, phone, etc.)
                autoFillKey: this.getAutoFillKey(input, label)
            };
        });
    }

    /**
     * Identify field type by analyzing attributes and patterns
     */
    identifyFieldType(input) {
        const type = input.type?.toLowerCase();
        const name = input.name?.toLowerCase() || '';
        const id = input.id?.toLowerCase() || '';
        const placeholder = input.placeholder?.toLowerCase() || '';
        const label = this.findFieldLabel(input)?.toLowerCase() || '';
        
        const combined = `${name} ${id} ${placeholder} ${label}`;
        
        // Check against our field mappings
        for (const [fieldType, config] of Object.entries(this.fieldMappings)) {
            if (config.patterns.some(pattern => combined.includes(pattern))) {
                return fieldType;
            }
        }
        
        // Fallback to input type
        return type || 'text';
    }

    /**
     * Get auto-fill key for a field
     */
    getAutoFillKey(input, label) {
        const fieldType = this.identifyFieldType(input);
        return fieldType;
    }

    /**
     * Identify form type (login, signup, contact, checkout, etc.)
     */
    identifyFormType(form, fields) {
        const html = form.outerHTML.toLowerCase();
        const fieldTypes = fields.map(f => f.fieldType);
        
        // Login form
        if (fieldTypes.includes('password') && (fieldTypes.includes('email') || fieldTypes.includes('username'))) {
            if (html.includes('login') || html.includes('signin') || html.includes('log-in')) {
                return 'login';
            }
        }
        
        // Signup form
        if (fields.length > 3 && (html.includes('signup') || html.includes('register') || html.includes('create account'))) {
            return 'signup';
        }
        
        // Contact form
        if (fieldTypes.includes('email') && (fieldTypes.includes('fullName') || fieldTypes.includes('firstName'))) {
            if (html.includes('contact') || html.includes('message') || html.includes('inquiry')) {
                return 'contact';
            }
        }
        
        // Checkout form
        if (fieldTypes.includes('address') || (fieldTypes.includes('city') && fieldTypes.includes('zipCode'))) {
            if (html.includes('checkout') || html.includes('billing') || html.includes('shipping')) {
                return 'checkout';
            }
        }
        
        // Search form
        if (fields.length === 1 && (html.includes('search') || html.includes('query'))) {
            return 'search';
        }
        
        return 'generic';
    }

    /**
     * Detect multi-step form structure
     */
    detectMultiStepForm(form) {
        const steps = [];
        
        // Look for step indicators
        const stepContainers = form.querySelectorAll('[class*="step"], [class*="page"], [data-step]');
        if (stepContainers.length > 1) {
            stepContainers.forEach((container, index) => {
                const fields = container.querySelectorAll('input:not([type="hidden"]), textarea, select');
                steps.push({
                    index,
                    element: container,
                    visible: this.isVisible(container),
                    fields: fields.length
                });
            });
        }
        
        // If no steps found, treat as single-step
        if (steps.length === 0) {
            steps.push({
                index: 0,
                element: form,
                visible: true,
                fields: form.querySelectorAll('input:not([type="hidden"]), textarea, select').length
            });
        }
        
        return steps;
    }

    /**
     * Extract validation rules from form fields
     */
    extractValidationRules(fields) {
        const rules = {};
        
        fields.forEach(field => {
            const fieldRules = this.extractFieldValidation(field.element);
            if (Object.keys(fieldRules).length > 0) {
                rules[field.name || field.id] = fieldRules;
            }
        });
        
        return rules;
    }

    /**
     * Extract validation rules from a single field
     */
    extractFieldValidation(input) {
        const rules = {
            required: input.required || input.hasAttribute('required')
        };
        
        if (input.pattern) rules.pattern = input.pattern;
        if (input.minLength > 0) rules.minLength = input.minLength;
        if (input.maxLength > 0) rules.maxLength = input.maxLength;
        if (input.min) rules.min = input.min;
        if (input.max) rules.max = input.max;
        
        // Check for HTML5 validation attributes
        if (input.type === 'email') rules.email = true;
        if (input.type === 'url') rules.url = true;
        if (input.type === 'number') rules.number = true;
        
        return rules;
    }

    /**
     * Auto-fill a form with profile data
     */
    async autoFillForm(formIndex, profileName = 'default') {
        const forms = this.analyzeForms();
        if (formIndex >= forms.length) {
            return { success: false, error: 'Form not found' };
        }
        
        const form = forms[formIndex];
        const profile = await this.getProfile(profileName);
        
        if (!profile) {
            return { success: false, error: 'Profile not found' };
        }
        
        let filled = 0;
        
        for (const field of form.fields) {
            if (field.autoFillKey && profile[field.autoFillKey]) {
                const success = this.fillField(field.element, profile[field.autoFillKey]);
                if (success) filled++;
            }
        }
        
        return {
            success: true,
            filled,
            total: form.fields.length
        };
    }

    /**
     * Fill a single field
     */
    fillField(element, value) {
        try {
            if (element.tagName === 'SELECT') {
                // Find matching option
                const option = Array.from(element.options).find(opt => 
                    opt.value === value || opt.text.toLowerCase().includes(value.toLowerCase())
                );
                if (option) {
                    element.value = option.value;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            } else {
                element.value = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        } catch (error) {
            console.error('Error filling field:', error);
            return false;
        }
        return false;
    }

    /**
     * Check if field can be auto-filled
     */
    canAutoFill(field) {
        return field.autoFillKey && 
               field.type !== 'password' && 
               field.type !== 'hidden' &&
               field.type !== 'submit';
    }

    /**
     * Save a profile
     */
    async saveProfile(name, data) {
        // In real implementation, this should encrypt sensitive data
        await chrome.storage.local.get(['formProfiles'], (result) => {
            const profiles = result.formProfiles || {};
            profiles[name] = {
                ...data,
                updatedAt: Date.now()
            };
            chrome.storage.local.set({ formProfiles: profiles });
        });
    }

    /**
     * Get a profile
     */
    async getProfile(name) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['formProfiles'], (result) => {
                const profiles = result.formProfiles || {};
                resolve(profiles[name] || null);
            });
        });
    }

    /**
     * Helper: Find label for input
     */
    findFieldLabel(input) {
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.textContent?.trim();
        }
        
        const parentLabel = input.closest('label');
        if (parentLabel) return parentLabel.textContent?.trim();
        
        let prev = input.previousElementSibling;
        while (prev && prev.tagName !== 'INPUT') {
            if (prev.tagName === 'LABEL' || prev.tagName === 'SPAN') {
                return prev.textContent?.trim();
            }
            prev = prev.previousElementSibling;
        }
        
        return '';
    }

    /**
     * Helper: Check if element is visible
     */
    isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden';
    }
}

// Export for content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormIntelligence;
} else {
    window.FormIntelligence = FormIntelligence;
}
