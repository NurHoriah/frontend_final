document.addEventListener("DOMContentLoaded", () => {
  // === 1. KONFIGURASI & GLOBAL VARIABLES ===
  const XLSX = window.XLSX;
  const TOKEN = localStorage.getItem("access_token");

  // Proteksi Halaman: Jika tidak ada token, tendang ke login
  if (!TOKEN) {
    window.location.replace("login.html");
    return;
  }

  // URL API Backend
  window.API_URL = window.location.hostname === "localhost" ? "http://localhost:5004" : "https://api.xyz.biz.id";
  const BACKEND_URL = window.API_URL;

  // DOM Elements - Form Manual
  const form = document.getElementById("analyzer-form");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultEl = document.getElementById("result");
  const resultLabel = document.getElementById("result-label");
  const resultExplanation = document.getElementById("result-explanation");
  const resultTips = document.getElementById("result-tips");
  const resultProbs = document.getElementById("result-probs");

  // DOM Elements - Import Kolektif
  const csvSection = document.getElementById("csv-section");
  const csvFileInput = document.getElementById("csv-file-input");
  const csvUploadBtn = document.getElementById("csv-upload-btn");
  const csvResetBtn = document.getElementById("csv-reset-btn");
  const csvDropZone = document.getElementById("csv-drop-zone");
  const csvProgress = document.getElementById("csv-progress");
  const csvProgressBar = document.getElementById("csv-progress-bar");
  const csvProgressText = document.getElementById("csv-progress-text");

  let parsedCsvData = [];
  let detailedResults = [];

  // === 2. AUTO HITUNG RATA-RATA & INDEKS (LOGIKA LAMA KAMU) ===
  const scoreFields = ["nilai_bahasa", "nilai_mtk", "nilai_ipa", "nilai_ips"];
  scoreFields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateCalculatedFields);
  });

  function updateCalculatedFields() {
    const b = +document.getElementById("nilai_bahasa").value || 0;
    const m = +document.getElementById("nilai_mtk").value || 0;
    const i = +document.getElementById("nilai_ipa").value || 0;
    const s = +document.getElementById("nilai_ips").value || 0;

    const avgEl = document.getElementById("rata_rata_umum");
    const eksEl = document.getElementById("indeks_eksakta");
    const nonEksEl = document.getElementById("indeks_non_eksakta");

    if (avgEl) avgEl.value = Math.round((b + m + i + s) / 4);
    if (eksEl) eksEl.value = Math.round((m + i) / 2);
    if (nonEksEl) nonEksEl.value = Math.round((b + s) / 2);
  }

  // === 3. FITUR DOWNLOAD TEMPLATE (SESUAI 13 KRITERIA) ===
  const kriteriaHeaders = [
    "nama_siswa", "kelas", "nilai_bahasa", "nilai_mtk", "nilai_ipa", "nilai_ips",
    "daya_visual_gambar", "mengingat_suara", "suka_praktik", "suka_membaca_mencatat",
    "ekskul_motorik", "ekskul_musik", "konsentrasi_belajar"
  ];

  document.getElementById("download-template-csv")?.addEventListener("click", (e) => {
    e.preventDefault();
    const csvContent = kriteriaHeaders.join(",") + "\nContoh Siswa,6A,80,85,90,75,3,3,3,3,3,3,3";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "Template_INKA_Kolektif.csv");
    link.click();
  });

  document.getElementById("download-template-excel")?.addEventListener("click", (e) => {
    e.preventDefault();
    const ws = XLSX.utils.aoa_to_sheet([kriteriaHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_INKA_Kolektif.xlsx");
  });

  // === 4. LOGIKA HANDLING FILE (STABIL & ANTI-ERROR) ===
  if (csvDropZone) {
    csvDropZone.addEventListener("click", () => csvFileInput.click());
  }

  csvFileInput?.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  function handleFile(file) {
    const infoBox = document.getElementById("selected-file-info");
    const nameDisplay = document.getElementById("selected-file-name");
    
    if (infoBox) infoBox.classList.remove("hidden");
    if (nameDisplay) nameDisplay.textContent = file.name;
    
    // AKTIFKAN TOMBOL ANALISIS
    csvUploadBtn.disabled = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
        const rows = jsonData.slice(1);

        parsedCsvData = rows.filter(row => row.length > 0).map(row => {
          const obj = {};
          headers.forEach((h, i) => obj[h] = row[i]);
          return obj;
        });
        previewData(parsedCsvData.slice(0, 5));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function previewData(data) {
    const previewBody = document.getElementById("preview-body");
    if (!previewBody) return;
    previewBody.innerHTML = data.map(row => `
      <tr>
        <td class="border px-2 py-1 text-xs">${row["nama_siswa"] || row["nama"] || "-"}</td>
        <td class="border px-2 py-1 text-xs">${row["kelas"] || "-"}</td>
        <td class="border px-2 py-1 text-xs">${row["nilai_bahasa"] || 0}</td>
        <td class="border px-2 py-1 text-xs">${row["nilai_mtk"] || 0}</td>
      </tr>
    `).join("");
    document.getElementById("csv-preview")?.classList.remove("hidden");
  }

  // === 5. ANALISIS DATA (MANUAL & KOLEKTIF) ===
  
  // -- Analisis Manual --
  analyzeBtn?.addEventListener("click", async () => {
    const payload = {
      nama_siswa: document.getElementById("nama_siswa").value,
      kelas: document.getElementById("kelas").value,
      nilai_bahasa: Number(document.getElementById("nilai_bahasa").value || 0),
      nilai_mtk: Number(document.getElementById("nilai_mtk").value || 0),
      nilai_ipa: Number(document.getElementById("nilai_ipa").value || 0),
      nilai_ips: Number(document.getElementById("nilai_ips").value || 0),
      daya_visual_gambar: Number(document.getElementById("daya_visual_gambar").value || 3),
      mengingat_suara: Number(document.getElementById("mengingat_suara").value || 3),
      suka_praktik: Number(document.getElementById("suka_praktik").value || 3),
      suka_membaca_mencatat: Number(document.getElementById("suka_membaca_mencatat").value || 3),
      ekskul_motorik: Number(document.getElementById("ekskul_motorik").value || 3),
      ekskul_musik: Number(document.getElementById("ekskul_musik").value || 3),
      konsentrasi_belajar: Number(document.getElementById("konsentrasi_belajar").value || 3),
    };

    try {
      const res = await fetch(`${BACKEND_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        renderSingleResult(data, payload.nama_siswa);
      }
    } catch (e) { console.error(e); }
  });

  // -- Analisis Kolektif (CSV/Excel) --
  csvUploadBtn?.addEventListener("click", async () => {
    if (parsedCsvData.length === 0) return;
    csvUploadBtn.disabled = true;
    csvProgress.classList.remove("hidden");
    detailedResults = [];

    for (let i = 0; i < parsedCsvData.length; i++) {
      const row = parsedCsvData[i];
      const payload = {
        nama_siswa: row["nama_siswa"] || row["nama"] || "Siswa",
        kelas: row["kelas"] || "-",
        nilai_bahasa: Number(row["nilai_bahasa"] || 0),
        nilai_mtk: Number(row["nilai_mtk"] || 0),
        nilai_ipa: Number(row["nilai_ipa"] || 0),
        nilai_ips: Number(row["nilai_ips"] || 0),
        daya_visual_gambar: Number(row["daya_visual_gambar"] || 3),
        mengingat_suara: Number(row["mengingat_suara"] || 3),
        suka_praktik: Number(row["suka_praktik"] || 3),
        suka_membaca_mencatat: Number(row["suka_membaca_mencatat"] || 3),
        ekskul_motorik: Number(row["ekskul_motorik"] || 3),
        ekskul_musik: Number(row["ekskul_musik"] || 3),
        konsentrasi_belajar: Number(row["konsentrasi_belajar"] || 3),
      };

      try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          detailedResults.push({ ...payload, ...data });
        }
      } catch (e) { console.error(e); }

      const pct = Math.round(((i + 1) / parsedCsvData.length) * 100);
      csvProgressBar.style.width = pct + "%";
      csvProgressText.textContent = pct + "%";
    }
    renderBatchResults(detailedResults);
    alert("Analisis Kolektif Selesai!");
    csvUploadBtn.disabled = false;
  });

  // === 6. RENDER HASIL & EXPORT ===
  function renderSingleResult(data, name) {
    resultEl.hidden = false;
    resultLabel.textContent = data.label || data.prediction;
    resultExplanation.textContent = data.explanation || `Siswa ${name} memiliki tipe belajar ${data.label}.`;
    resultTips.innerHTML = (data.tips || []).map((tip) => `<li>${tip}</li>`).join("");
    resultProbs.innerHTML = "";
    if (data.probabilities) {
      Object.entries(data.probabilities).forEach(([key, val]) => {
        const span = document.createElement("span");
        span.className = "px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs mr-2";
        span.textContent = `${key}: ${(val * 100).toFixed(1)}%`;
        resultProbs.appendChild(span);
      });
    }
  }

  function renderBatchResults(results) {
    const body = document.getElementById("detailed-results-body");
    if (body) {
      body.innerHTML = results.map(r => `
        <tr>
          <td class="border px-4 py-2">${r.nama_siswa}</td>
          <td class="border px-4 py-2">${r.kelas}</td>
          <td class="border px-4 py-2 font-bold text-primary-dark">${r.label || r.prediction}</td>
          <td class="border px-4 py-2 text-center text-xs">${((r.probabilities?.Visual || 0) * 100).toFixed(1)}%</td>
          <td class="border px-4 py-2 text-center text-xs">${((r.probabilities?.Auditori || 0) * 100).toFixed(1)}%</td>
          <td class="border px-4 py-2 text-center text-xs">${((r.probabilities?.Kinestetik || 0) * 100).toFixed(1)}%</td>
        </tr>
      `).join("");
      document.getElementById("detailed-results-section")?.classList.remove("hidden");
    }
    resultEl.hidden = false;
    resultLabel.textContent = `${results.length} Siswa Teranalisis`;
  }

  // Tombol Unduh Hasil (SANGAT PENTING)
  document.getElementById("download-results-excel")?.addEventListener("click", () => {
    if (detailedResults.length === 0) return alert("Belum ada data hasil analisis.");
    const exportData = detailedResults.map(r => ({
      "Nama Siswa": r.nama_siswa,
      "Kelas": r.kelas,
      "Hasil": r.label || r.prediction,
      "Visual": ((r.probabilities?.Visual || 0) * 100).toFixed(1) + "%",
      "Auditori": ((r.probabilities?.Auditori || 0) * 100).toFixed(1) + "%",
      "Kinestetik": ((r.probabilities?.Kinestetik || 0) * 100).toFixed(1) + "%"
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hasil Analisis");
    XLSX.writeFile(wb, "Hasil_INKA_Kolektif.xlsx");
  });

  // === 7. LOGIKA DASHBOARD (TAB & LOGOUT) ===
  document.getElementById("tab-manual")?.addEventListener("click", () => {
    form.classList.remove("hidden");
    csvSection.classList.add("hidden");
  });

  document.getElementById("tab-csv")?.addEventListener("click", () => {
    form.classList.add("hidden");
    csvSection.classList.remove("hidden");
  });

  csvResetBtn?.addEventListener("click", () => {
    parsedCsvData = [];
    detailedResults = [];
    csvFileInput.value = "";
    document.getElementById("selected-file-info")?.classList.add("hidden");
    document.getElementById("csv-preview")?.classList.add("hidden");
    csvProgress.classList.add("hidden");
    csvUploadBtn.disabled = true;
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });
});