/**
 * SABLE — Lookbook Carousel, GSAP Choreography & Shopping Bag Controller
 */
(() => {
  "use strict";

  const LOOKS = window.SABLE_LOOKS || [];
  if (!LOOKS.length || typeof window.gsap === "undefined") return;

  const STORAGE_KEY = "sable_aw26_bag_v1";
  const DRAG_THRESHOLD_PX = 6;

  // DOM References
  const root = document.getElementById("sableRoot");
  const wordsLayer = document.getElementById("wordsLayer");
  const stage = document.getElementById("carouselStage");
  const dotsList = document.getElementById("dotsList");
  const lookNumberEl = document.getElementById("lookNumber");
  const lookTitleEl = document.getElementById("lookTitle");
  const lookItemsList = document.getElementById("lookItemsList");
  const lookTotalPriceEl = document.getElementById("lookTotalPrice");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const shopLookBtn = document.getElementById("shopLookBtn");

  // Detail Panel References
  const detailPanel = document.getElementById("detailPanel");
  const closePanelBtn = document.getElementById("closePanelBtn");
  const panelLookNumber = document.getElementById("panelLookNumber");
  const panelTitle = document.getElementById("panelTitle");
  const panelDescription = document.getElementById("panelDescription");
  const panelPiecesList = document.getElementById("panelPiecesList");
  const panelTotalPrice = document.getElementById("panelTotalPrice");
  const addLookBtn = document.getElementById("addLookBtn");

  // Bag Drawer References
  const bagTrigger = document.getElementById("bagTrigger");
  const bagCountEl = document.getElementById("bagCount");
  const bagDrawer = document.getElementById("bagDrawer");
  const closeBagBtn = document.getElementById("closeBagBtn");
  const bagEmptyState = document.getElementById("bagEmptyState");
  const bagItemsList = document.getElementById("bagItemsList");
  const bagFooter = document.getElementById("bagFooter");
  const bagSubtotalEl = document.getElementById("bagSubtotal");
  const checkoutBtn = document.getElementById("checkoutBtn");

  // Toast & Screen Reader Announcer
  const toastEl = document.getElementById("sableToast");
  const srAnnouncer = document.getElementById("srAnnouncer");

  // Application State
  const state = {
    activeIndex: 0,
    progress: 0,
    panelProgress: 0,
    isPanelOpen: false,
    isBagOpen: false,
    selectedSizes: {},
    bag: loadBagFromStorage(),
    lastFocusedElement: null,
  };

  // Initialize default sizes for every garment
  LOOKS.forEach((look) => {
    look.pieces.forEach((piece) => {
      state.selectedSizes[`${look.id}:${piece.id}`] = piece.defaultSize;
    });
  });

  const figureButtons = [];
  const wordSpans = [];
  const dotButtons = [];
  let toastTimer = null;
  let railTween = null;

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isMobileViewport = () => window.matchMedia("(max-width: 720px)").matches;

  function formatEuro(amount) {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getLookTotal(look) {
    return look.pieces.reduce((sum, piece) => sum + piece.price, 0);
  }

  function loadBagFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveBagToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bag));
    } catch {
      // Ignore storage quota errors in restricted browsing modes
    }
  }

  function announce(message) {
    if (!srAnnouncer) return;
    srAnnouncer.textContent = "";
    requestAnimationFrame(() => {
      srAnnouncer.textContent = message;
    });
  }

  function showToast(message) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    gsap.killTweensOf(toastEl);

    if (prefersReducedMotion()) {
      gsap.set(toastEl, { autoAlpha: 1, y: 0 });
    } else {
      gsap.fromTo(
        toastEl,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" }
      );
    }

    toastTimer = setTimeout(() => {
      gsap.to(toastEl, {
        autoAlpha: 0,
        y: 10,
        duration: prefersReducedMotion() ? 0 : 0.35,
        ease: "power2.in",
      });
    }, 2400);
  }

  /* ========================================================================
     1. DOM Construction (Words, Cut-Out Figures, Dots)
     ======================================================================== */
  function buildStageDOM() {
    LOOKS.forEach((look, index) => {
      // Giant Serif Wordmark
      const wordSpan = document.createElement("span");
      wordSpan.style.setProperty("--len", String(look.word.length));
      wordSpan.style.color = look.wordColor;
      const em = document.createElement("em");
      em.textContent = look.word;
      wordSpan.appendChild(em);
      wordsLayer.appendChild(wordSpan);
      wordSpans.push(wordSpan);

      // Cut-out Figure Button
      const figBtn = document.createElement("button");
      figBtn.type = "button";
      figBtn.className = "sable-figure";
      figBtn.style.aspectRatio = look.aspectRatio;
      figBtn.setAttribute(
        "aria-label",
        `Look ${look.number}: ${look.title}${index === 0 ? " — view details" : ""}`
      );

      const img = document.createElement("img");
      img.src = look.image;
      img.alt = "";
      img.draggable = false;
      img.loading = index <= 2 ? "eager" : "lazy";
      img.addEventListener("error", () => {
        const fallback = document.createElement("div");
        fallback.className = "sable-figure-fallback";
        fallback.textContent = `Look ${look.number}`;
        img.replaceWith(fallback);
      });

      const shadow = document.createElement("span");
      shadow.className = "sable-shadow";
      shadow.setAttribute("aria-hidden", "true");

      figBtn.appendChild(img);
      figBtn.appendChild(shadow);
      stage.appendChild(figBtn);
      figureButtons.push(figBtn);

      // Dot Indicator
      const li = document.createElement("li");
      const dotBtn = document.createElement("button");
      dotBtn.type = "button";
      dotBtn.setAttribute("aria-label", `Go to look ${index + 1}`);
      if (index === 0) dotBtn.setAttribute("aria-current", "true");
      dotBtn.addEventListener("click", () => {
        if (state.isPanelOpen) closeDetailPanel();
        goToLook(index);
      });
      li.appendChild(dotBtn);
      dotsList.appendChild(li);
      dotButtons.push(dotBtn);
    });
  }

  /* ========================================================================
     2. Rail Depth & Position Renderer (GPU-only Transforms)
     ======================================================================== */
  function wrapOffset(rawOffset, total) {
    let o = ((rawOffset % total) + total) % total;
    if (o > total / 2) o -= total;
    return o;
  }

  function renderRail() {
    const progress = state.progress;
    const total = LOOKS.length;
    const vw = window.innerWidth;
    const stepX = isMobileViewport()
      ? Math.max(195, vw * 0.54)
      : Math.min(365, Math.max(210, vw * 0.195));

    const mobile = isMobileViewport();
    const panelW = Math.min(480, Math.max(360, vw * 0.34));
    const p = state.panelProgress;
    const panelShiftX = mobile ? 0 : panelW * 0.5 * p;
    const panelShiftY = mobile ? -window.innerHeight * 0.085 * p : 0;

    figureButtons.forEach((btn, index) => {
      const offset = wrapOffset(index - progress, total);
      const absOffset = Math.abs(offset);

      // Non-linear editorial scale: 1.0 (center) -> 0.70 (1) -> 0.63 (2) -> 0.56 (3+)
      let scale;
      if (absOffset < 1) {
        scale = 1 - absOffset * 0.3;
      } else {
        scale = Math.max(0.56, 0.7 - (absOffset - 1) * 0.07);
      }

      if (p > 0 && index === state.activeIndex) {
        scale += mobile ? -0.14 * p : 0.05 * p;
      }

      // Center figure sits at -50% of its own width, shifted by offset * stepX
      const xPx = offset * stepX - panelShiftX;
      const yPx = index === state.activeIndex ? panelShiftY : 0;

      let opacity = 1;
      if (absOffset > 3.25) {
        opacity = 0;
      } else if (absOffset > 2.2) {
        opacity = Math.max(0, 1 - (absOffset - 2.2) / 1.05);
      }

      if (p > 0 && index !== state.activeIndex) {
        opacity *= 1 - p;
      }

      const zIndex = Math.max(10, 100 - Math.round(absOffset * 10));

      gsap.set(btn, {
        xPercent: -50,
        x: xPx,
        y: yPx,
        scale,
        autoAlpha: opacity,
        zIndex,
      });
    });
  }

  /* ========================================================================
     3. Wordmark, Info Band & Tint Transitions
     ======================================================================== */
  function updateWordmark(prevIndex, nextIndex, instant = false) {
    const reduced = instant || prefersReducedMotion();

    wordSpans.forEach((span, idx) => {
      const em = span.querySelector("em");
      gsap.killTweensOf(em);

      if (idx === nextIndex) {
        gsap.set(span, { zIndex: 2 });
        if (reduced) {
          gsap.set(em, { y: 0, yPercent: 0 });
        } else {
          gsap.fromTo(
            em,
            { y: 0, yPercent: 112 },
            { y: 0, yPercent: 0, duration: 0.9, delay: 0.06, ease: "power4.out" }
          );
        }
      } else if (idx === prevIndex && prevIndex !== nextIndex) {
        gsap.set(span, { zIndex: 1 });
        if (reduced) {
          gsap.set(em, { y: 0, yPercent: 112 });
        } else {
          gsap.to(em, {
            y: 0,
            yPercent: -112,
            duration: 0.45,
            ease: "power2.in",
          });
        }
      } else {
        gsap.set(span, { zIndex: 0 });
        gsap.set(em, { y: 0, yPercent: 112 });
      }
    });
  }

  function renderFooterInfo(look, animate = true) {
    lookNumberEl.textContent = `Look ${look.number}`;
    lookTitleEl.textContent = look.title;
    lookTotalPriceEl.textContent = formatEuro(getLookTotal(look));

    lookItemsList.innerHTML = "";
    look.pieces.forEach((piece, idx) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `<span>${piece.name}</span><span>${formatEuro(piece.price)}</span>`;
      btn.addEventListener("click", () => openDetailPanel(idx));
      li.appendChild(btn);
      lookItemsList.appendChild(li);
    });

    if (animate && !prefersReducedMotion()) {
      const targets = [
        lookTitleEl,
        ...lookItemsList.querySelectorAll("li"),
        lookTotalPriceEl,
      ];
      gsap.fromTo(
        targets,
        { y: 12, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.6,
          stagger: 0.05,
          ease: "power3.out",
          clearProps: "transform",
        }
      );
    }
  }

  function updateControlsState(index) {
    dotButtons.forEach((dot, idx) => {
      if (idx === index) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });

    figureButtons.forEach((btn, idx) => {
      const look = LOOKS[idx];
      const suffix =
        idx === index
          ? state.isPanelOpen
            ? " — close details"
            : " — view details"
          : "";
      btn.setAttribute("aria-label", `Look ${look.number}: ${look.title}${suffix}`);
      btn.setAttribute(
        "aria-expanded",
        idx === index && state.isPanelOpen ? "true" : "false"
      );
    });
  }

  function goToLook(targetIndex, { instant = false } = {}) {
    const total = LOOKS.length;
    const normalized = ((targetIndex % total) + total) % total;
    const prevIndex = state.activeIndex;
    const look = LOOKS[normalized];

    state.activeIndex = normalized;
    root.style.setProperty("--tint", look.tint);

    updateControlsState(normalized);
    updateWordmark(prevIndex, normalized, instant);
    renderFooterInfo(look, !instant && prevIndex !== normalized);

    if (state.isPanelOpen) {
      renderDetailPanel(look);
    }

    if (railTween) railTween.kill();

    if (instant || prefersReducedMotion()) {
      state.progress = normalized;
      renderRail();
    } else {
      // Shortest circular path on the 8-look rail
      const delta = wrapOffset(normalized - state.progress, total);
      const nextProgress = state.progress + delta;
      railTween = gsap.to(state, {
        progress: nextProgress,
        duration: 0.72,
        ease: "expo.out",
        onUpdate: renderRail,
        onComplete: () => {
          state.progress = normalized;
          renderRail();
        },
      });
    }

    announce(`Look ${look.number} of ${total}: ${look.title}`);
  }

  /* ========================================================================
     4. Pointer Drag & Inertia Snap
     ======================================================================== */
  function initDragControls() {
    let isPointerDown = false;
    let startX = 0;
    let startY = 0;
    let startProgress = 0;
    let lastX = 0;
    let velocityX = 0;
    let hasDragged = false;
    let clickedFigureIndex = -1;

    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (state.isBagOpen) return;

      isPointerDown = true;
      hasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      velocityX = 0;
      startProgress = state.progress;

      const figBtn = e.target.closest(".sable-figure");
      clickedFigureIndex = figBtn ? figureButtons.indexOf(figBtn) : -1;

      if (railTween) railTween.kill();
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener("pointermove", (e) => {
      if (!isPointerDown) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!hasDragged) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        // Respect vertical page scrolling on touch devices
        if (Math.abs(dy) > Math.abs(dx)) {
          isPointerDown = false;
          return;
        }
        hasDragged = true;
        stage.classList.add("is-dragging");
      }

      velocityX = e.clientX - lastX;
      lastX = e.clientX;

      const stepPx = isMobileViewport() ? 220 : 320;
      state.progress = startProgress - dx / stepPx;

      renderRail();
    });

    function handlePointerEnd(e) {
      if (!isPointerDown) return;
      isPointerDown = false;
      stage.classList.remove("is-dragging");

      if (stage.hasPointerCapture(e.pointerId)) {
        stage.releasePointerCapture(e.pointerId);
      }

      if (!hasDragged) {
        if (clickedFigureIndex !== -1) {
          if (clickedFigureIndex === state.activeIndex) {
            state.isPanelOpen ? closeDetailPanel() : openDetailPanel();
          } else {
            if (state.isPanelOpen) closeDetailPanel();
            goToLook(clickedFigureIndex);
          }
        } else if (state.isPanelOpen) {
          closeDetailPanel();
        }
        return;
      }

      // Snap with subtle velocity projection (circular wrap)
      const projected = state.progress - velocityX * 0.015;
      const targetIndex = Math.round(projected);
      if (state.isPanelOpen) closeDetailPanel();
      goToLook(targetIndex);
    }

    stage.addEventListener("pointerup", handlePointerEnd);
    stage.addEventListener("pointercancel", handlePointerEnd);
  }

  /* ========================================================================
     5. Detail Drawer & Garment Size Selection
     ======================================================================== */
  function renderDetailPanel(look, highlightPieceIndex = -1) {
    panelLookNumber.textContent = `Look ${look.number}`;
    panelTitle.textContent = look.title;
    panelDescription.textContent = look.description;
    panelTotalPrice.textContent = formatEuro(getLookTotal(look));

    panelPiecesList.innerHTML = "";
    look.pieces.forEach((piece, idx) => {
      const li = document.createElement("li");
      if (idx === highlightPieceIndex) {
        li.classList.add("is-highlighted");
      }

      const selectedSize =
        state.selectedSizes[`${look.id}:${piece.id}`] || piece.defaultSize;

      const head = document.createElement("div");
      head.className = "sable-piece-head";
      head.innerHTML = `
        <span class="sable-piece-idx">0${idx + 1}</span>
        <div>
          <h3>${piece.name}</h3>
          <p>${piece.material}</p>
        </div>
        <span class="sable-piece-price">${formatEuro(piece.price)}</span>
      `;

      const radioGroup = document.createElement("div");
      radioGroup.className = "sable-sizes";
      radioGroup.setAttribute("role", "radiogroup");
      radioGroup.setAttribute("aria-label", `Size for ${piece.name}`);

      piece.sizes.forEach((size) => {
        const sizeBtn = document.createElement("button");
        sizeBtn.type = "button";
        sizeBtn.setAttribute("role", "radio");
        sizeBtn.setAttribute("aria-checked", size === selectedSize ? "true" : "false");
        sizeBtn.textContent = size;

        sizeBtn.addEventListener("click", () => {
          state.selectedSizes[`${look.id}:${piece.id}`] = size;
          radioGroup.querySelectorAll("button").forEach((b) => {
            b.setAttribute("aria-checked", b === sizeBtn ? "true" : "false");
          });
          announce(`${piece.name} size ${size} selected`);
        });

        radioGroup.appendChild(sizeBtn);
      });

      li.appendChild(head);
      li.appendChild(radioGroup);
      panelPiecesList.appendChild(li);
    });
  }

  function openDetailPanel(highlightPieceIndex = -1) {
    if (state.isBagOpen) closeBagDrawer();
    const look = LOOKS[state.activeIndex];
    renderDetailPanel(look, highlightPieceIndex);

    if (state.isPanelOpen) return;
    state.lastFocusedElement = document.activeElement;
    state.isPanelOpen = true;
    root.classList.add("is-open");
    detailPanel.setAttribute("aria-hidden", "false");
    updateControlsState(state.activeIndex);

    const reduced = prefersReducedMotion();
    const mobile = isMobileViewport();

    gsap.killTweensOf([detailPanel, wordsLayer]);
    gsap.killTweensOf(state, "panelProgress");

    if (reduced) {
      state.panelProgress = 1;
      renderRail();
      gsap.set(detailPanel, { autoAlpha: 1, x: 0, y: 0, xPercent: 0, yPercent: 0 });
    } else {
      gsap.to(state, {
        panelProgress: 1,
        duration: 0.85,
        ease: "power3.out",
        onUpdate: renderRail,
      });

      if (mobile) {
        gsap.set(detailPanel, { autoAlpha: 1, x: 0, xPercent: 0 });
        if (gsap.getProperty(detailPanel, "yPercent") === 0 && !state.panelProgress) {
          gsap.set(detailPanel, { yPercent: 103 });
        }
        gsap.fromTo(
          detailPanel,
          { autoAlpha: 1, x: 0, y: 0, xPercent: 0, yPercent: 103 },
          { x: 0, y: 0, xPercent: 0, yPercent: 0, duration: 0.78, ease: "power3.out" }
        );
        gsap.to(wordsLayer, {
          y: "-9svh",
          opacity: 0.45,
          duration: 0.75,
          ease: "power3.out",
        });
      } else {
        gsap.fromTo(
          detailPanel,
          { autoAlpha: 1, x: 0, y: 0, xPercent: 103, yPercent: 0 },
          { x: 0, y: 0, xPercent: 0, yPercent: 0, duration: 0.85, ease: "power3.out" }
        );
        const panelW = Math.min(480, Math.max(360, window.innerWidth * 0.34));
        gsap.to(wordsLayer, {
          x: -panelW * 0.5,
          duration: 0.85,
          ease: "power3.out",
        });
      }

      gsap.fromTo(
        detailPanel.querySelectorAll(".sable-panel-in > *"),
        { y: 14, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.65,
          stagger: 0.045,
          delay: 0.16,
          ease: "power3.out",
          clearProps: "transform",
        }
      );
    }

    requestAnimationFrame(() => closePanelBtn.focus());
  }

  function closeDetailPanel() {
    if (!state.isPanelOpen) return;
    state.isPanelOpen = false;
    root.classList.remove("is-open");
    detailPanel.setAttribute("aria-hidden", "true");
    updateControlsState(state.activeIndex);

    const reduced = prefersReducedMotion();
    const mobile = isMobileViewport();

    gsap.killTweensOf([detailPanel, wordsLayer]);
    gsap.killTweensOf(state, "panelProgress");

    if (reduced) {
      state.panelProgress = 0;
      gsap.set(detailPanel, { autoAlpha: 0 });
      gsap.set(wordsLayer, { x: 0, y: 0, opacity: 1 });
      renderRail();
    } else {
      gsap.to(state, {
        panelProgress: 0,
        duration: 0.72,
        ease: "power3.out",
        onUpdate: renderRail,
      });

      gsap.to(detailPanel, {
        xPercent: mobile ? 0 : 103,
        yPercent: mobile ? 103 : 0,
        duration: 0.72,
        ease: "power3.out",
        onComplete: () => {
          if (!state.isPanelOpen) gsap.set(detailPanel, { autoAlpha: 0 });
        },
      });

      gsap.to(wordsLayer, {
        x: 0,
        y: 0,
        opacity: 1,
        duration: 0.72,
        ease: "power3.out",
      });
    }

    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === "function") {
      state.lastFocusedElement.focus();
    }
  }

  /* ========================================================================
     6. Bag State & Bag Drawer
     ======================================================================== */
  function updateBagUI(popBadge = false) {
    const count = state.bag.length;
    bagCountEl.textContent = String(count);
    bagTrigger.setAttribute("aria-label", `Bag, ${count} ${count === 1 ? "item" : "items"}`);

    if (popBadge && !prefersReducedMotion()) {
      gsap.fromTo(
        bagCountEl,
        { scale: 1.45 },
        { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" }
      );
    }

    bagItemsList.innerHTML = "";
    if (count === 0) {
      bagEmptyState.hidden = false;
      bagFooter.hidden = true;
      return;
    }

    bagEmptyState.hidden = true;
    bagFooter.hidden = false;

    let subtotal = 0;
    state.bag.forEach((item, idx) => {
      subtotal += item.price;
      const li = document.createElement("li");
      li.className = "sable-bag-item";
      li.innerHTML = `
        <div class="sable-bag-item-meta">
          <h4>${item.name}</h4>
          <p>${item.lookTitle} &middot; Size ${item.size}</p>
        </div>
        <div class="sable-bag-item-actions">
          <span>${formatEuro(item.price)}</span>
          <button type="button" class="sable-bag-remove" aria-label="Remove ${item.name}">Remove</button>
        </div>
      `;
      li.querySelector(".sable-bag-remove").addEventListener("click", () => {
        state.bag.splice(idx, 1);
        saveBagToStorage();
        updateBagUI(false);
        announce(`${item.name} removed from bag`);
      });
      bagItemsList.appendChild(li);
    });

    bagSubtotalEl.textContent = formatEuro(subtotal);
  }

  function addLookToBag() {
    const look = LOOKS[state.activeIndex];
    look.pieces.forEach((piece) => {
      const size =
        state.selectedSizes[`${look.id}:${piece.id}`] || piece.defaultSize;
      state.bag.push({
        lookId: look.id,
        lookTitle: look.title,
        pieceId: piece.id,
        name: piece.name,
        size,
        price: piece.price,
      });
    });

    saveBagToStorage();
    updateBagUI(true);
    showToast(`Added ${look.title} (3 pieces) to bag`);
    announce(`Added ${look.title} to bag. ${state.bag.length} items in bag.`);

    // Temporary CTA confirmation feedback
    const originalHTML = addLookBtn.innerHTML;
    addLookBtn.textContent = "Added to bag \u2713";
    addLookBtn.disabled = true;
    setTimeout(() => {
      addLookBtn.innerHTML = originalHTML;
      addLookBtn.disabled = false;
    }, 1500);
  }

  function openBagDrawer() {
    if (state.isPanelOpen) closeDetailPanel();
    if (state.isBagOpen) return;

    state.lastFocusedElement = document.activeElement;
    state.isBagOpen = true;
    bagDrawer.setAttribute("aria-hidden", "false");
    bagTrigger.setAttribute("aria-expanded", "true");
    updateBagUI(false);

    if (prefersReducedMotion()) {
      gsap.set(bagDrawer, { autoAlpha: 1, x: 0, xPercent: 0 });
    } else {
      gsap.fromTo(
        bagDrawer,
        { autoAlpha: 1, x: 0, xPercent: 103 },
        { x: 0, xPercent: 0, duration: 0.75, ease: "power3.out" }
      );
    }

    requestAnimationFrame(() => closeBagBtn.focus());
  }

  function closeBagDrawer() {
    if (!state.isBagOpen) return;
    state.isBagOpen = false;
    bagDrawer.setAttribute("aria-hidden", "true");
    bagTrigger.setAttribute("aria-expanded", "false");

    if (prefersReducedMotion()) {
      gsap.set(bagDrawer, { autoAlpha: 0 });
    } else {
      gsap.to(bagDrawer, {
        xPercent: 103,
        duration: 0.6,
        ease: "power3.inOut",
        onComplete: () => gsap.set(bagDrawer, { autoAlpha: 0 }),
      });
    }

    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === "function") {
      state.lastFocusedElement.focus();
    }
  }

  /* ========================================================================
     7. Entrance Timeline & Event Bindings
     ======================================================================== */
  function initEntranceTimeline() {
    if (prefersReducedMotion()) {
      renderRail();
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".sable-nav", {
      y: -14,
      autoAlpha: 0,
      duration: 0.8,
      clearProps: "all",
    })
      .from(
        ".sable-season",
        { y: 14, autoAlpha: 0, duration: 0.8, clearProps: "all" },
        "<0.15"
      )
      .from(
        ".sable-info",
        { y: 18, autoAlpha: 0, duration: 0.85, clearProps: "all" },
        "<0.1"
      );
  }

  function bindEvents() {
    prevBtn.addEventListener("click", () => {
      if (state.isPanelOpen) closeDetailPanel();
      goToLook(state.activeIndex - 1);
    });

    nextBtn.addEventListener("click", () => {
      if (state.isPanelOpen) closeDetailPanel();
      goToLook(state.activeIndex + 1);
    });

    shopLookBtn.addEventListener("click", () => openDetailPanel());
    closePanelBtn.addEventListener("click", closeDetailPanel);
    addLookBtn.addEventListener("click", addLookToBag);

    bagTrigger.addEventListener("click", () => {
      state.isBagOpen ? closeBagDrawer() : openBagDrawer();
    });
    closeBagBtn.addEventListener("click", closeBagDrawer);

    checkoutBtn.addEventListener("click", () => {
      showToast("Demo checkout — thank you for exploring SABLE.");
    });

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (state.isBagOpen) closeBagDrawer();
        else if (state.isPanelOpen) closeDetailPanel();
        return;
      }

      if (state.isBagOpen) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (state.isPanelOpen) closeDetailPanel();
        goToLook(state.activeIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (state.isPanelOpen) closeDetailPanel();
        goToLook(state.activeIndex - 1);
      }
    });

    // Horizontal wheel / trackpad swipe on stage
    let wheelLock = false;
    stage.addEventListener(
      "wheel",
      (e) => {
        if (state.isBagOpen || wheelLock) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
        if (Math.abs(delta) < 18) return;
        e.preventDefault();
        wheelLock = true;
        if (state.isPanelOpen) closeDetailPanel();
        goToLook(state.activeIndex + (delta > 0 ? 1 : -1));
        setTimeout(() => {
          wheelLock = false;
        }, 420);
      },
      { passive: false }
    );

    // Header nav link feedback
    document.querySelectorAll(".sable-nav nav a").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const label = link.textContent.trim();
        if (label === "Collection" || label === "Lookbook") {
          if (state.isPanelOpen) closeDetailPanel();
          goToLook(0);
        } else if (label === "Atelier") {
          showToast("SABLE Atelier — Hand-finished in Milan & Paris");
        } else if (label === "Stores") {
          showToast("Flagships — Paris · Milan · London · Tokyo");
        }
      });
    });

    // Recompute rail spacing on viewport resize
    let resizeRaf = null;
    window.addEventListener("resize", () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(renderRail);
    });
  }

  /* ========================================================================
     Bootstrap
     ======================================================================== */
  buildStageDOM();
  initDragControls();
  bindEvents();
  updateBagUI(false);
  goToLook(0, { instant: true });

  const startAnimations = () => {
    renderRail();
    initEntranceTimeline();
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(startAnimations);
  } else {
    startAnimations();
  }
})();
