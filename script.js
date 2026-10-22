



document.addEventListener("DOMContentLoaded", () => {
  // ==================== TEMA OSCURO ====================
  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = themeBtn?.querySelector("i");

  try {
    if (localStorage.getItem("theme") === "dark") {
      document.body.classList.add("dark-mode");
      themeIcon?.classList.replace("fa-moon", "fa-sun");
    }
  } catch (error) {
    console.warn("El navegador no permite guardar el tema:", error);
  }

  themeBtn?.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const dark = document.body.classList.contains("dark-mode");
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (_) {}
    themeIcon?.classList.toggle("fa-moon", !dark);
    themeIcon?.classList.toggle("fa-sun", dark);
  });

  // ==================== CARRUSEL ====================
  const slider = document.getElementById("slider");
  const groups = [...document.querySelectorAll(".cards-group")];
  let currentGroup = 0;

  function updateSlider() {
    if (!slider || !groups.length) return;
    slider.style.transform = `translateX(-${currentGroup * (100 / groups.length)}%)`;
  }
  document.getElementById("nextBtn")?.addEventListener("click", () => {
    if (!groups.length) return;
    currentGroup = (currentGroup + 1) % groups.length;
    updateSlider();
  });
  document.getElementById("prevBtn")?.addEventListener("click", () => {
    if (!groups.length) return;
    currentGroup = (currentGroup - 1 + groups.length) % groups.length;
    updateSlider();
  });
  window.addEventListener("resize", updateSlider);
  updateSlider();

  // ==================== MENÚ DE REDES ====================
  document.querySelectorAll(".menu-button").forEach((btn) => {
    btn.addEventListener("click", () => btn.nextElementSibling?.classList.toggle("show-icons"));
  });

  // ==================== VISOR PDF ====================
  const modal = document.getElementById("pdfModal");
  const canvas = document.getElementById("pdfCanvas");
  const ctx = canvas?.getContext("2d");
  const stage = document.getElementById("pdfStage");
  const canvasWrapper = document.getElementById("canvasWrapper");
  const loading = document.getElementById("pdfLoading");
  const errorBox = document.getElementById("pdfError");
  const pageLabel = document.getElementById("pageNum");
  const zoomLabel = document.getElementById("zoomLevel");
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");
  const fileNameLabel = document.getElementById("pdfFileName");
  const openPdfBtn = document.getElementById("downloadPdf");

  let pdfDoc = null;
  let pageNum = 1;
  let zoom = 1;
  let currentUrl = "";
  let renderTask = null;
  let loadToken = 0;

  if (window.pdfjsLib) {
    //  misma versión de pdf.min.js 
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js";
  }

  function showLoading() {
    if (loading) { loading.hidden = false; loading.style.display = "flex"; }
    if (errorBox) { errorBox.hidden = true; errorBox.style.display = "none"; }
    if (canvasWrapper) canvasWrapper.style.display = "none";
  }
  function showError(message) {
    if (loading) { loading.hidden = true; loading.style.display = "none"; }
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.style.display = "flex";
      const paragraph = errorBox.querySelector("p");
      const small = errorBox.querySelector("small");
      if (paragraph) paragraph.textContent = message || "No se pudo cargar el PDF.";
      if (small) small.textContent = "Comprueba el nombre del archivo y la ruta. Si abriste el HTML con doble clic, usa localhost o abre el PDF en otra pestaña.";
    }
    if (canvasWrapper) canvasWrapper.style.display = "none";
  }
  function updateControls() {
    if (pageLabel) pageLabel.textContent = pdfDoc ? `${pageNum} / ${pdfDoc.numPages}` : "—";
    if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    if (prevPageBtn) prevPageBtn.disabled = !pdfDoc || pageNum <= 1;
    if (nextPageBtn) nextPageBtn.disabled = !pdfDoc || pageNum >= pdfDoc.numPages;
  }
  function openModal() {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("pdf-open");
    modal.querySelector(".pdf-close")?.focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pdf-open");
    loadToken++;
    if (renderTask) { try { renderTask.cancel(); } catch (_) {} renderTask = null; }
  }

  async function renderPage(number) {
    if (!pdfDoc || !ctx || !canvas || !stage || !canvasWrapper) return;
    if (renderTask) { try { renderTask.cancel(); } catch (_) {} renderTask = null; }
    showLoading();
    try {
      const page = await pdfDoc.getPage(number);
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(240, stage.clientWidth - 28);
      const fitScale = Math.min(1.35, availableWidth / baseViewport.width);
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
      const task = page.render({ canvasContext: ctx, viewport, transform });
      renderTask = task;
      await task.promise;
      if (renderTask !== task) return;
      renderTask = null;
      canvasWrapper.style.display = "block";
      if (loading) { loading.hidden = true; loading.style.display = "none"; }
      if (errorBox) { errorBox.hidden = true; errorBox.style.display = "none"; }
      updateControls();
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    } catch (err) {
      if (err?.name === "RenderingCancelledException") return;
      console.error("Error al dibujar la página del PDF:", err);
      showError("El PDF se encontró, pero no se pudo mostrar en la vista previa.");
    }
  }

  document.querySelectorAll(".btn-cv").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ruta = btn.getAttribute("data-pdf")?.trim();
      if (!ruta) { alert("Este botón no tiene una ruta data-pdf configurada."); return; }

      // Convierte pdf/Nombre.pdf en una ruta absoluta 
      const url = new URL(ruta.replace(/\\/g, "/"), document.baseURI).href;
      currentUrl = url;
      const nombre = decodeURIComponent(url.split("/").pop() || "Documento.pdf");
      if (fileNameLabel) fileNameLabel.textContent = nombre;

      // file:// impide que PDF.js lea archivos locales en muchos navegadores.
      //  usar el visor PDF nativo del navegador.
      if (window.location.protocol === "file:") {
        window.open(url, "_blank", "noopener");
        return;
      }
      if (!window.pdfjsLib) {
        openModal();
        showError("No se pudo cargar la librería PDF.js. Comprueba tu conexión a Internet.");
        return;
      }

      const token = ++loadToken;
      pageNum = 1;
      zoom = 1;
      pdfDoc = null;
      updateControls();
      showLoading();
      openModal();
      try {
        // Evita cachear una respuesta errónea del servidor y permite que PDF.js
        // reciba la URL completa, no una ruta relativa 
        const task = pdfjsLib.getDocument({ url });
        const loadedDoc = await task.promise;
        if (token !== loadToken) { try { await loadedDoc.destroy(); } catch (_) {} return; }
        pdfDoc = loadedDoc;
        updateControls();
        await renderPage(pageNum);
      } catch (err) {
        if (token !== loadToken) return;
        console.error("No se pudo cargar el PDF:", { url, error: err });
        showError(`No se pudo cargar: ${nombre}. Verifica que exista en la carpeta pdf.`);
      }
    });
  });

  modal?.querySelector(".pdf-close")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal?.classList.contains("is-open")) closeModal();
  });
  prevPageBtn?.addEventListener("click", () => {
    if (pdfDoc && pageNum > 1) { pageNum--; renderPage(pageNum); }
  });
  nextPageBtn?.addEventListener("click", () => {
    if (pdfDoc && pageNum < pdfDoc.numPages) { pageNum++; renderPage(pageNum); }
  });
  document.getElementById("zoomIn")?.addEventListener("click", () => {
    if (pdfDoc && zoom < 2.5) { zoom = Math.min(2.5, +(zoom + 0.15).toFixed(2)); renderPage(pageNum); }
  });
  document.getElementById("zoomOut")?.addEventListener("click", () => {
    if (pdfDoc && zoom > 0.55) { zoom = Math.max(0.55, +(zoom - 0.15).toFixed(2)); renderPage(pageNum); }
  });
  openPdfBtn?.addEventListener("click", () => {
    if (currentUrl) window.open(currentUrl, "_blank", "noopener,noreferrer");
  });
  updateControls();
});



