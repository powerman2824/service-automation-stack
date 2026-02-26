/**
 * =====================================================================
 * SERVICE AUTOMATION STACK — FRONTEND JS (NEUTRAL)
 * ---------------------------------------------------------------------
 * Goals:
 * 1) Keep the site lightweight (no frameworks)
 * 2) Make rebranding easy via window.SITE_CONFIG
 * 3) Provide clean form submission:
 *    - optional parsing (first/last name, city/state)
 *    - compiledMessage for readable email/workflow payloads
 *    - success/error UI states
 * 4) Mobile navigation toggle
 *
 * Notes:
 * - This file is intentionally written as plain, modern JS.
 * - It will work on GitHub Pages as-is.
 * =====================================================================
 */

(() => {
  "use strict";

  /* ===================================================================
   * 0) CONFIG + HELPERS
   * =================================================================== */

  /** Read config injected by index.html */
  const CFG = window.SITE_CONFIG || {};

  /** Shorthand selectors */
  const $ = (sel, root = document) => root.querySelector(sel);

  /** Safe text set (prevents "undefined") */
  const setText = (el, value, fallback = "") => {
    if (!el) return;
    el.textContent = (value ?? fallback).toString();
  };

  /** Safe attribute set */
  const setAttr = (el, name, value) => {
    if (!el || value == null) return;
    el.setAttribute(name, value);
  };

  /** Basic phone sanitizer for tel: links (keeps leading + if present) */
  const toTelHref = (e164OrDisplay) => {
    if (!e164OrDisplay) return null;
    // Keep + if present, strip everything else non-digit
    const cleaned = e164OrDisplay.startsWith("+")
      ? "+" + e164OrDisplay.slice(1).replace(/\D/g, "")
      : e164OrDisplay.replace(/\D/g, "");
    return cleaned ? `tel:${cleaned}` : null;
  };

  /** Normalize whitespace */
  const clean = (s) => (s || "").toString().trim().replace(/\s+/g, " ");

  /** Split a full name into first/last (simple heuristic) */
  const splitName = (fullName) => {
    const name = clean(fullName);
    if (!name) return { first: "", last: "" };

    const parts = name.split(" ");
    if (parts.length === 1) return { first: parts[0], last: "" };

    return {
      first: parts[0],
      last: parts.slice(1).join(" "),
    };
  };

  /**
   * Parse location into city/state if the user enters "City, ST"
   * - Accepts: "Hartford, CT", "Hartford CT", "Hartford"
   */
  const parseLocation = (location) => {
    const raw = clean(location);
    if (!raw) return { city: "", state: "" };

    // Try comma format first
    if (raw.includes(",")) {
      const [cityPart, statePart] = raw.split(",");
      return {
        city: clean(cityPart),
        state: clean(statePart).toUpperCase(),
      };
    }

    // Try last token as state if it looks like 2 letters
    const tokens = raw.split(" ");
    const maybeState = tokens[tokens.length - 1];
    if (/^[A-Za-z]{2}$/.test(maybeState)) {
      return {
        city: clean(tokens.slice(0, -1).join(" ")),
        state: maybeState.toUpperCase(),
      };
    }

    return { city: raw, state: "" };
  };

  /* ===================================================================
   * 1) BRANDING / CONTENT INJECTION
   * =================================================================== */

  const applyBranding = () => {
    // Brand mark + name
    setText($("#brandMark"), CFG.brandMark, "SB");
    setText($("#brandName"), CFG.businessName, "YOUR_BUSINESS_NAME");

    // Small sub label under the name (optional)
    setText($("#brandSub"), CFG.primaryServiceArea ? "Service Company" : "Service Company", "Service Company");

    // Topbar “Serving”
    setText($("#topbarAreaText"), CFG.primaryServiceArea, "Your Service Area");

    // Hero kicker / urgency / phone
    setText($("#heroKicker"), CFG.taglineShort, "Fast • Friendly • Reliable");
    setText($("#heroUrgency"), CFG.urgencyNote, "Limited weekend availability — reserve early.");
    setText($("#heroPhoneText"), CFG.phoneDisplay, "(555) 555-5555");

    // Footer
    setText($("#footerBrand"), CFG.businessName, "YOUR_BUSINESS_NAME");
    setText($("#footerArea"), CFG.primaryServiceArea, "Your Primary Service Area");
    setText($("#footerRadius"), CFG.serviceRadiusNote, "Approx. service radius: 30–50 miles");
    setText($("#footerHours"), CFG.hoursText, "Hours: Mon–Sun • 8am–6pm");

    // Privacy page might not have these, so this is safe
    setText($("#areasPrimaryText"), CFG.primaryServiceArea, "Your Primary Service Area");

    // Links: phone + email
    const telHref = toTelHref(CFG.phoneE164 || CFG.phoneDisplay);
    if (telHref) {
      setAttr($("#heroPhoneLink"), "href", telHref);
      setAttr($("#mobileCallLink"), "href", telHref);
      setAttr($("#footerPhoneLink"), "href", telHref);
    }

    setText($("#footerPhoneText"), CFG.phoneDisplay, "(555) 555-5555");

    if (CFG.email) {
      setAttr($("#footerEmailLink"), "href", `mailto:${CFG.email}`);
      setText($("#footerEmailText"), CFG.email, "hello@example.com");
    }

    // Year auto-update
    setText($("#year"), new Date().getFullYear());
  };

  /* ===================================================================
   * 2) MOBILE NAV TOGGLE
   * =================================================================== */

  const initMobileNav = () => {
    const toggle = $(".nav-toggle");
    const nav = $("#site-nav");
    if (!toggle || !nav) return;

    const closeNav = () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    const openNav = () => {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    };

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.contains("is-open");
      isOpen ? closeNav() : openNav();
    });

    // Close on nav link click (mobile UX)
    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      closeNav();
    });

    // Close on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });
  };

  /* ===================================================================
   * 3) QUOTE FORM — PARSE + COMPILE + SUBMIT
   * =================================================================== */

  const initQuoteForm = () => {
    const form = $("#quoteForm");
    if (!form) return;

    // Optional override: set the form action from config
    if (CFG.formEndpoint) form.action = CFG.formEndpoint;

    // UI elements
    const successEl = $("#quoteSuccess");
    const errorEl = $("#quoteError");
    const errorMsgEl = $("#quoteErrorMsg");

    // Hidden fields (kept to match your previous design)
    const firstNameEl = $("#firstName");
    const lastNameEl = $("#lastName");
    const cityEl = $("#cityField");
    const stateEl = $("#stateField");
    const contactTagEl = $("#contactTag");
    const compiledMessageEl = $("#compiledMessage");

    /**
     * Build a clean "compiled message" for email/workflows.
     * This becomes your single most useful field when piping into n8n.
     */
    const buildCompiledMessage = (data) => {
      const lines = [
        "New Quote Request",
        "",
        `Contact Tag: ${data.contactTag || ""}`,
        `Name: ${data.fullName || ""}`,
        `Phone: ${data.phone || ""}`,
        `Email: ${data.email || ""}`,
        `Location: ${data.location || ""}`,
        "",
        "Job Details:",
        `${data.details || ""}`,
      ];
      return lines.join("\n");
    };

    /**
     * Pull key values out of the form in one place.
     * This also lets us keep your hidden parsed fields updated.
     */
    const collect = () => {
      const fullName = clean(form.elements.full_name?.value);
      const phone = clean(form.elements.phone?.value);
      const email = clean(form.elements.email?.value);
      const location = clean(form.elements.location?.value);
      const details = clean(form.elements.details?.value);

      const { first, last } = splitName(fullName);
      const { city, state } = parseLocation(location);

      // Contact tag: a stable-ish identifier for downstream automations
      // (you can change this to any convention later)
      const contactTag = [
        (first || "contact").toLowerCase(),
        (last || "").toLowerCase().replace(/\s+/g, "-"),
        city ? city.toLowerCase().replace(/\s+/g, "-") : "",
      ]
        .filter(Boolean)
        .join("_");

      return {
        fullName,
        first,
        last,
        phone,
        email,
        location,
        city,
        state,
        details,
        contactTag,
      };
    };

    /**
     * Update hidden fields so the payload is automation-friendly.
     *
     * These hidden fields allow:
     * - Clean parsing in external systems
     * - Easier database insertion later
     * - Human-readable emails (compiledMessage)
     * - Machine-readable JSON (payload_json)
     */
    const syncHiddenFields = (data) => {
      // ---- Basic parsed fields (good for spreadsheets / CRM columns) ----
      if (firstNameEl) firstNameEl.value = data.first;
      if (lastNameEl) lastNameEl.value = data.last;
      if (cityEl) cityEl.value = data.city;
      if (stateEl) stateEl.value = data.state;
      if (contactTagEl) contactTagEl.value = data.contactTag;

      // ---- Human readable summary (good for email notifications) ----
      if (compiledMessageEl) {
        compiledMessageEl.value = buildCompiledMessage(data);
      }

      /**
       * ---- Structured automation payload (VERY IMPORTANT) ----
       *
       * This JSON blob is designed to be:
       * - Easily parsed by n8n
       * - Directly inserted into Google Sheets
       * - Compatible with Airtable / HubSpot / etc.
       * - Swappable to a real database later (SQLite/Postgres)
       *
       * If you ever replace Formspree with:
       * - A custom API
       * - A serverless function
       * - A direct n8n webhook
       *
       * This structure can stay exactly the same.
       */
      const payloadJsonEl = document.getElementById("payloadJson");

      if (payloadJsonEl) {
        payloadJsonEl.value = JSON.stringify({
          timestamp: new Date().toISOString(),

          contactTag: data.contactTag,

          fullName: data.fullName,
          firstName: data.first,
          lastName: data.last,

          phone: data.phone,
          email: data.email,

          location: data.location,
          city: data.city,
          state: data.state,

          details: data.details,

          source: "github-pages",
          page: window.location.href
        });
      }
    };

    /**
     * UI helpers: show/hide success/error
     */
    const showSuccess = () => {
      if (errorEl) errorEl.hidden = true;
      if (successEl) successEl.hidden = false;
      // Small scroll for visibility on long forms
      successEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const showError = (msg) => {
      if (successEl) successEl.hidden = true;
      if (errorEl) errorEl.hidden = false;

      // Friendly fallback message includes the configured phone if we have it
      const fallbackPhone = CFG.phoneDisplay || "(555) 555-5555";
      const safeMsg =
        msg ||
        `Please try again. If it keeps failing, call/text ${fallbackPhone} and we’ll help fast.`;

      if (errorMsgEl) errorMsgEl.textContent = safeMsg;
      errorEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    /**
     * Handle submit with fetch(FormData)
     * - works with Formspree
     * - works with n8n webhook later
     */
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Gather + sync hidden fields before sending
      const data = collect();
      syncHiddenFields(data);

      try {
        const resp = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });

        if (resp.ok) {
          form.reset();

          // Keep success visible, hide error if it was shown
          showSuccess();
        } else {
          // Try to extract any server message (Formspree can return JSON errors)
          let message = "";
          try {
            const payload = await resp.json();
            message =
              payload?.errors?.[0]?.message ||
              payload?.error ||
              payload?.message ||
              "";
          } catch {
            // no-op (non-JSON response)
          }
          showError(message);
        }
      } catch (err) {
        showError();
      }
    });

    /**
     * Optional: live-update hidden fields when user types
     * - Makes debugging/testing easier
     * - Keeps compiledMessage current if you inspect payloads
     */
    form.addEventListener("input", () => {
      const data = collect();
      syncHiddenFields(data);
    });
  };

  /* ===================================================================
   * 4) BOOTSTRAP
   * =================================================================== */

  document.addEventListener("DOMContentLoaded", () => {
    applyBranding();
    initMobileNav();
    initQuoteForm();
  });
})();