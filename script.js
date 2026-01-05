document.addEventListener("DOMContentLoaded", () => {
  // 1. Inisialisasi & Keamanan
  const XLSX = window.XLSX;
  const TOKEN = localStorage.getItem("access_token");

  if (!TOKEN) {
    window.location.replace("login.html");
    return;
  }

  window.API_URL = window.location.hostname === "localhost" ? "http://localhost:5004" : "https://api.xyz.biz.id";
  const BACKEND_URL = window.API_URL;

  function isTokenExpired() {
    try {
      const payload = JSON.parse(atob(TOKEN.split(".")[1]));
      return Date.now() >= payload.exp * 1000;
    } catch (e) {
      return true;
    }
  }

  if (isTokenExpired()) {
    localStorage.removeItem("access_token");
    window.location.replace("login.html");
    return;
  }

  // 2. DOM Elements
  const form = document.getElementById("analyzer-form");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultEl = document.getElementById("result");
  const resultLabel = document.getElementById("result-label");
  const resultExplanation = document.getElementById("result-explanation");
  const resultTips = document.getElementById("result-tips");
  const resultProbs = document.getElementById("result-probs");

  const csvSection = document.getElementById("csv-section");
  const csvFileInput = document.getElementById("csv-file-input");
  const csvUploadBtn = document.getElementById("csv-upload-btn");
  const csvResetBtn = document.getElementById("csv-reset-btn");
  const csvProgress = document.getElementById("csv-progress");
  const csvProgressBar = document.getElementById("csv-progress-bar");
  const csvProgressText = document.getElementById("csv-progress-text");

  let selectedFile = null;
  let parsedCsvData = [];
  let detailedResults = [];

  const teacherName = document.getElementById("teacherName");
  if (teacherName) teacherName.textContent = localStorage.getItem("user_name") || "Guru";

  // 3. Perhitungan Otomatis Kolom (Visual Feedback)
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

  // 4. Logika Analisis Manual
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", async () => {
      const b = Number(document.getElementById("nilai_bahasa").value || 0);
      const m = Number(document.getElementById("nilai_mtk").value || 0);
      const i = Number(document.getElementById("nilai_ipa").value || 0);
      const s = Number(document.getElementById("nilai_ips").value || 0);

      const payload = {
        nama_siswa: document.getElementById("nama_siswa").value,
        kelas: document.getElementById("kelas").value,
        nilai_bahasa: b,
        nilai_mtk: m,
        nilai_ipa: i,
        nilai_ips: s,
        rata_rata_umum: (b + m + i + s) / 4,
        indeks_eksakta: (m + i) / 2,
        indeks_non_eksakta: (b + s) / 2,
        daya_visual_gambar: Number(document.getElementById("daya_visual_gambar").value || 3),
        mengingat_suara: Number(document.getElementById("mengingat_suara").value || 3),
        suka_praktik: Number(document.getElementById("suka_praktik").value || 3),
        suka_membaca_mencatat: Number(document.getElementById("suka_membaca_mencatat").value || 3),
        ekskul_motorik: Number(document.getElementById("ekskul_motorik").value || 3),
        ekskul_musik: Number(document.getElementById("ekskul_musik").value || 3),
      };

      try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          renderSingleResult(data, payload.nama_siswa);
        } else {
          const errorData = await res.json();
          alert("Gagal melakukan analisis: " + (errorData.error || "Cek inputan Anda"));
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

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
    resultEl.scrollIntoView({ behavior: 'smooth' });
  }

  // 5. Tab Switching Logic
  document.getElementById("tab-manual").addEventListener("click", () => {
    form.classList.remove("hidden");
    csvSection.classList.add("hidden");
    document.getElementById("tab-manual").classList.add("active", "bg-primary-blue", "text-white");
    document.getElementById("tab-csv").classList.remove("active", "bg-primary-blue", "text-white");
  });

  document.getElementById("tab-csv").addEventListener("click", () => {
    form.classList.add("hidden");
    csvSection.classList.remove("hidden");
    document.getElementById("tab-csv").classList.add("active", "bg-primary-blue", "text-white");
    document.getElementById("tab-manual").classList.remove("active", "bg-primary-blue", "text-white");
  });

  // 6. File Handling (CSV/Excel)
  const csvDropZone = document.getElementById("csv-drop-zone");
  csvDropZone.addEventListener("click", () => csvFileInput.click());
  csvFileInput.addEventListener("change", (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });

  function handleFile(file) {
    selectedFile = file;
    document.getElementById("selected-file-info").classList.remove("hidden");
    document.getElementById("selected-file-name").textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        const headers = jsonData[0].map((h) => String(h).trim().toLowerCase());
        const rows = jsonData.slice(1);
        parsedCsvData = rows.map((row) => {
          const obj = {};
          headers.forEach((h, i) => (obj[h] = row[i]));
          return obj;
        });
        csvUploadBtn.disabled = false;
        previewData(parsedCsvData.slice(0, 5));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function previewData(data) {
    const previewBody = document.getElementById("preview-body");
    previewBody.innerHTML = data.map((row) => `
      <tr>
        <td class="border px-2 py-1">${row["nama siswa"] || row["nama"] || "-"}</td>
        <td class="border px-2 py-1">${row["kelas"] || "-"}</td>
        <td class="border px-2 py-1">${row["nilai_bahasa"] || "-"}</td>
        <td class="border px-2 py-1">${row["nilai_mtk"] || "-"}</td>
      </tr>`).join("");
    document.getElementById("csv-preview").classList.remove("hidden");
  }

  // 7. Logika Analisis Kolektif (CSV Upload)
  csvUploadBtn.addEventListener("click", async () => {
    csvUploadBtn.disabled = true;
    csvProgress.classList.remove("hidden");
    let successCount = 0;
    detailedResults = [];

    for (let i = 0; i < parsedCsvData.length; i++) {
      const row = parsedCsvData[i];
      const b = Number(row["nilai_bahasa"] || row["bahasa"] || 0);
      const m = Number(row["nilai_mtk"] || row["mtk"] || 0);
      const ipa = Number(row["nilai_ipa"] || row["ipa"] || 0);
      const ips = Number(row["nilai_ips"] || row["ips"] || 0);

      const payload = {
        nama_siswa: row["nama siswa"] || row["nama"] || "Siswa",
        kelas: row["kelas"] || "-",
        nilai_bahasa: b, nilai_mtk: m, nilai_ipa: ipa, nilai_ips: ips,
        rata_rata_umum: (b + m + ipa + ips) / 4,
        indeks_eksakta: (m + ipa) / 2,
        indeks_non_eksakta: (b + ips) / 2,
        daya_visual_gambar: Number(row["daya_visual_gambar"] || row["visual"] || 3),
        mengingat_suara: Number(row["mengingat_suara"] || row["auditori"] || 3),
        suka_praktik: Number(row["suka_praktik"] || row["praktik"] || 3),
        suka_membaca_mencatat: Number(row["suka_membaca_mencatat"] || 3),
        ekskul_motorik: Number(row["ekskul_motorik"] || 3),
        ekskul_musik: Number(row["ekskul_musik"] || 3),
      };

      try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          detailedResults.push({ ...payload, ...data });
          successCount++;
        }
      } catch (e) { console.error(e); }

      const pct = Math.round(((i + 1) / parsedCsvData.length) * 100);
      csvProgressBar.style.width = pct + "%";
      csvProgressText.textContent = pct + "%";
    }

    renderBatchResults(detailedResults);
    alert(`Selesai! ${successCount} data berhasil dianalisis.`);
  });

  function renderBatchResults(results) {
    resultEl.hidden = false;
    const body = document.getElementById("detailed-results-body");
    const detailedSection = document.getElementById("detailed-results-section");

    if (body) {
      body.innerHTML = results.map((r) => `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="border border-gray-300 px-4 py-2 font-medium">${r.nama_siswa}</td>
          <td class="border border-gray-300 px-4 py-2 text-center">${r.kelas}</td>
          <td class="border border-gray-300 px-4 py-2 font-bold text-primary-dark">${r.label || r.prediction}</td>
          <td class="border border-gray-300 px-4 py-2 text-sm">${((r.probabilities?.Visual || 0) * 100).toFixed(1)}%</td>
          <td class="border border-gray-300 px-4 py-2 text-sm">${((r.probabilities?.Auditori || 0) * 100).toFixed(1)}%</td>
          <td class="border border-gray-300 px-4 py-2 text-sm">${((r.probabilities?.Kinestetik || 0) * 100).toFixed(1)}%</td>
        </tr>`).join("");
      if (detailedSection) detailedSection.classList.remove("hidden");
      resultEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // 8. Reset & Download
  if (csvResetBtn) {
    csvResetBtn.addEventListener("click", () => {
      parsedCsvData = []; selectedFile = null; csvFileInput.value = "";
      document.getElementById("selected-file-info").classList.add("hidden");
      document.getElementById("csv-preview").classList.add("hidden");
      csvProgress.classList.add("hidden");
      csvUploadBtn.disabled = true;
    });
  }

  document.getElementById("download-results-excel").addEventListener("click", async () => {
    let rawData = detailedResults;
    if (rawData.length === 0) {
      const res = await fetch(`${BACKEND_URL}/api/history`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (res.ok) rawData = await res.json();
    }
    if (rawData.length > 0) {
      const excelData = rawData.map(res => ({
        'Nama Siswa': res.nama_siswa, 'Kelas': res.kelas, 'Tipe Belajar Dominan': res.label || res.prediction,
        'Persentase Visual': ((res.probabilities?.Visual || 0) * 100).toFixed(1) + '%',
        'Persentase Auditori': ((res.probabilities?.Auditori || 0) * 100).toFixed(1) + '%',
        'Persentase Kinestetik': ((res.probabilities?.Kinestetik || 0) * 100).toFixed(1) + '%'
      }));
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hasil Analisis");
      XLSX.writeFile(wb, "Hasil_Klasifikasi_Siswa.xlsx");
    } else {
      alert("Tidak ada data untuk diunduh.");
    }
  });

  // 9. Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });
});