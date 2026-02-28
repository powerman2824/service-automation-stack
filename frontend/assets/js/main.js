/**
 * =====================================================================
 * SERVICE AUTOMATION STACK — FRONTEND JS (NEUTRAL)
 * Demo-first CRM behavior:
 * - Always saves submission to session (fake CRM)
 * - Only submits to Formspree if endpoint is a real /f/ URL
 * =====================================================================
 */

(() => {
  "use strict";

  /* ===================================================================
   * 0) CONFIG + HELPERS
   * =================================================================== */

  const CFG = window.SITE_CONFIG || {};

  const $ = (sel, root = document) => root.querySelector(sel);

  const setText = (el, value, fallback = "") => {
    if (!el) return;
    el.textContent = (value ?? fallback).toString();
  };

  const setAttr = (el, name, value) => {
    if (!el || value == null) return;
    el.setAttribute(name, value);
  };

  const toTelHref = (e164OrDisplay) => {
    if (!e164OrDisplay) return null;
    const cleaned = e164OrDisplay.startsWith("+")
      ? "+" + e164OrDisplay.slice(1).replace(/\D/g, "")
      : e164OrDisplay.replace(/\D/g, "");
    return cleaned ? `tel:${cleaned}` : null;
  };

  const clean = (s) => (s || "").toString().trim().replace(/\s+/g, " ");

  const splitName = (fullName) => {
    const name = clean(fullName);
    if (!name) return { first: "", last: "" };
    const parts = name.split(" ");
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  };

  const parseLocation = (location) => {
    const raw = clean(location);
    if (!raw) return { city: "", state: "" };

    if (raw.includes(",")) {
      const [cityPart, statePart] = raw.split(",");
      return { city: clean(cityPart), state: clean(statePart).toUpperCase() };
    }

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
   * 1) DEMO CRM (SESSION STORAGE)
   * =================================================================== */

  const DEMO_ACTION = "__DEMO__";
  const DEMO_KEY = "demo_leads_v1";

  const demo = {
    load() {
      try {
        return JSON.parse(sessionStorage.getItem(DEMO_KEY) || "[]");
      } catch {
        return [];
      }
    },
    save(leads) {
      sessionStorage.setItem(DEMO_KEY, JSON.stringify(leads));
    },
    add(lead) {
      const leads = demo.load();
      leads.unshift(lead);
      demo.save(leads);
    },
  };

  const maskEmail = (email = "") => {
    const [u, d] = email.split("@");
    if (!u || !d) return email;
    return `${u.slice(0, 2)}***@${d}`;
  };

  const maskPhone = (phone = "") => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return phone;
    return `***-***-${digits.slice(-4)}`;
  };

  const isRealFormspreeAction = (action) => {
    try {
      if (!action || action === DEMO_ACTION || action === "#") return false;
      const url = new URL(action, window.location.href);
      return url.hostname === "formspree.io" && url.pathname.startsWith("/f/");
    } catch {
      return false;
    }
  };

  /* ===================================================================
   * 2) BRANDING / CONTENT INJECTION
   * =================================================================== */

  const applyBranding = () => {
    setText($("#brandMark"), CFG.brandMark, "SB");
    setText($("#brandName"), CFG.businessName, "YOUR_BUSINESS_NAME");
    setText($("#brandSub"), "Service Company", "Service Company");

    setText($("#topbarAreaText"), CFG.primaryServiceArea, "Your Service Area");

    setText($("#heroKicker"), CFG.taglineShort, "Fast • Friendly • Reliable");
    setText(
      $("#heroUrgency"),
      CFG.urgencyNote,
      "Limited weekend availability — reserve early."
    );
    setText($("#heroPhoneText"), CFG.phoneDisplay, "(555) 555-5555");

    setText($("#footerBrand"), CFG.businessName, "YOUR_BUSINESS_NAME");
    setText($("#footerArea"), CFG.primaryServiceArea, "Your Primary Service Area");
    setText($("#footerRadius"), CFG.serviceRadiusNote, "Approx. service radius: 30–50 miles");
    setText($("#footerHours"), CFG.hoursText, "Hours: Mon–Sun • 8am–6pm");
    setText($("#areasPrimaryText"), CFG.primaryServiceArea, "Your Primary Service Area");

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

    setText($("#year"), new Date().getFullYear());
  };

  /* ===================================================================
   * 3) MOBILE NAV TOGGLE
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
      nav.classList.contains("is-open") ? closeNav() : openNav();
    });

    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) closeNav();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });
  };

  /* ===================================================================
   * 4) QUOTE FORM — PARSE + COMPILE + DEMO STORE + OPTIONAL SUBMIT
   * =================================================================== */

  const initQuoteForm = () => {
    const form = $("#quoteForm");
    if (!form) return;

    // Use config endpoint if present, otherwise keep the HTML action.
    if (CFG.formEndpoint) form.action = CFG.formEndpoint;

    const successEl = $("#quoteSuccess");
    const errorEl = $("#quoteError");
    const errorMsgEl = $("#quoteErrorMsg");

    const firstNameEl = $("#firstName");
    const lastNameEl = $("#lastName");
    const cityEl = $("#cityField");
    const stateEl = $("#stateField");
    const contactTagEl = $("#contactTag");
    const compiledMessageEl = $("#compiledMessage");
    const payloadJsonEl = $("#payloadJson");

    const buildCompiledMessage = (data) => {
      return [
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
      ].join("\n");
    };

    const collect = () => {
      const fullName = clean(form.elements.full_name?.value);
      const phone = clean(form.elements.phone?.value);
      const email = clean(form.elements.email?.value);
      const location = clean(form.elements.location?.value);
      const details = clean(form.elements.details?.value);

      const { first, last } = splitName(fullName);
      const { city, state } = parseLocation(location);

      const safeCity = city ? city.trim().toLowerCase().replace(/\s+/g, "-") : "";
      const safeFirst = first
        ? first.trim().charAt(0).toUpperCase() + first.trim().slice(1).toLowerCase()
        : "Contact";

      const contactTag = [safeCity, safeFirst].filter(Boolean).join("_");

      return { fullName, first, last, phone, email, location, city, state, details, contactTag };
    };

    const syncHiddenFields = (data) => {
      if (firstNameEl) firstNameEl.value = data.first;
      if (lastNameEl) lastNameEl.value = data.last;
      if (cityEl) cityEl.value = data.city;
      if (stateEl) stateEl.value = data.state;
      if (contactTagEl) contactTagEl.value = data.contactTag;

      if (compiledMessageEl) compiledMessageEl.value = buildCompiledMessage(data);

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
          source: CFG.source || "github-pages",
          page: window.location.href,
        });
      }
    };

    const showSuccess = (modeLabel = "Saved") => {
      if (errorEl) errorEl.hidden = true;
      if (successEl) successEl.hidden = false;

      // (Optional) tweak the visible success title if your markup uses .alert__title
      const title = successEl?.querySelector(".alert__title");
      if (title) title.textContent = modeLabel;

      successEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const showError = (msg) => {
      if (successEl) successEl.hidden = true;
      if (errorEl) errorEl.hidden = false;

      const fallbackPhone = CFG.phoneDisplay || "(555) 555-5555";
      const safeMsg =
        msg ||
        `Please try again. If it keeps failing, call/text ${fallbackPhone} and we’ll help fast.`;

      if (errorMsgEl) errorMsgEl.textContent = safeMsg;
      errorEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const saveToDemoCRM = (data) => {
      const lead = {
        id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
        createdAt: new Date().toISOString(),
        status: "New",
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        location: data.location,
        details: data.details,
        contactTag: data.contactTag,
        // nice-to-have masked preview (admin page can choose which to show)
        masked: { email: maskEmail(data.email), phone: maskPhone(data.phone) },
      };
      demo.add(lead);
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = collect();
      syncHiddenFields(data);

      // Always do demo CRM (even in Live mode)
      saveToDemoCRM(data);

      const action = form.action || "";
      const shouldSend = isRealFormspreeAction(action);

      // DEMO MODE: no network request
      if (!shouldSend) {
        form.reset();
        showSuccess("Saved to demo CRM (session only)");
        return;
      }

      // LIVE MODE: also submit to Formspree
      try {
        const resp = await fetch(action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });

        if (resp.ok) {
          form.reset();
          showSuccess("Sent + saved to demo CRM");
        } else {
          let message = "";
          try {
            const payload = await resp.json();
            message =
              payload?.errors?.[0]?.message ||
              payload?.error ||
              payload?.message ||
              "";
          } catch {
            // non-JSON response
          }
          showError(message);
        }
      } catch {
        showError();
      }
    });

    // Keep your “live update hidden fields” behavior (handy for debugging)
    form.addEventListener("input", () => {
      const data = collect();
      syncHiddenFields(data);
    });
  };

  /* ===================================================================
   * 5) BOOTSTRAP
   * =================================================================== */

  document.addEventListener("DOMContentLoaded", () => {
    applyBranding();
    initMobileNav();
    initQuoteForm();
  });
})();