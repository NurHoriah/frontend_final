document.addEventListener("DOMContentLoaded", () => {
  const XLSX = window.XLSX;
  const TOKEN = localStorage.getItem("access_token");

  // --- 1. PROTEKSI HALAMAN & TOKEN CHECK ---
  if (!TOKEN) {
    window.location.replace("login.html");
    return;
  }

  // Fungsi cek jika token sudah kadaluarsa (Payload JWT)
  function isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return Math.floor(Date.now() / 1000) >= payload.exp;
    } catch (e) {
      return true;
    }
  }

  if (isTokenExpired(TOKEN)) {
    localStorage.clear();
    window.location.replace("login.html");
    return;
  }

  // URL API Backend (Otomatis deteksi Local vs Production)
  window.API_URL = window.location.hostname === "localhost" ? "http://localhost:5004" : "https://api.xyz.biz.id";
  const BACKEND_URL = window.API_URL;

  // --- 2. USER INTERFACE (NAMA GURU) ---
  const teacherName = document.getElementById("teacherName");
  if (teacherName) {
    teacherName.textContent = localStorage.getItem("user_name") || "Guru Penguji";
  }

  // DOM Elements - Manual
  const form = document.getElementById("analyzer-form");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultEl = document.getElementById("result");
  const resultLabel = document.getElementById("result-label");
  const resultExplanation = document.getElementById("result-explanation");
  const resultTips = document.getElementById("result-tips");
  const resultProbs = document.getElementById("result-probs");

  // DOM Elements - Collective
  const csvFileInput = document.getElementById("csv-file-input");
  const csvUploadBtn = document.getElementById("csv-upload-btn");
  const csvResetBtn = document.getElementById("csv-reset-btn");
  const csvProgress = document.getElementById("csv-progress");
  const csvProgressBar = document.getElementById("csv-progress-bar");
  const csvProgressText = document.getElementById("csv-progress-text");
  const csvDropZone = document.getElementById("csv-drop-zone");
  const fileStatusText = document.getElementById("file-status-text");
  const selectedFileInfo = document.getElementById("selected-file-info");
  const selectedFileName = document.getElementById("selected-file-name");

  let parsedCsvData = [];
  let detailedResults = []; 

  // --- 3. AUTO HITUNG (RATA-RATA & INDEKS) ---
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

  // --- 4. DOWNLOAD TEMPLATE ---
  const kriteriaHeaders = [
    "nama_siswa", "kelas", "nilai_bahasa", "nilai_mtk", "nilai_ipa", "nilai_ips",
    "daya_visual_gambar", "mengingat_suara", "suka_praktik", "suka_membaca_mencatat",
    "ekskul_motorik", "ekskul_musik", "konsentrasi_belajar"
  ];

  document.getElementById("download-template-csv")?.addEventListener("click", (e) => {
    e.preventDefault();
    const csvContent = kriteriaHeaders.join(",") + "\nSiswa Contoh,6A,80,85,90,75,3,3,3,3,3,3,3";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Template_INKA.csv";
    link.click();
  });

  document.getElementById("download-template-excel")?.addEventListener("click", (e) => {
    e.preventDefault();
    const ws = XLSX.utils.aoa_to_sheet([kriteriaHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_INKA.xlsx");
  });

  // --- 5. FILE HANDLING & PREVIEW ---
  if (csvDropZone) csvDropZone.addEventListener("click", () => csvFileInput.click());

  csvFileInput?.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  function handleFile(file) {
    if (selectedFileName) selectedFileName.textContent = file.name;
    if (selectedFileInfo) selectedFileInfo.classList.remove("hidden");
    if (fileStatusText) fileStatusText.textContent = "File terpilih: " + file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length > 1) {
          const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
          const rows = jsonData.slice(1);
          parsedCsvData = rows.filter(r => r.length > 0).map(row => {
            const obj = {};
            headers.forEach((h, i) => obj[h] = row[i]);
            return obj;
          });

          // Aktifkan tombol analisis setelah data siap
          if (csvUploadBtn) {
            csvUploadBtn.disabled = false;
            csvUploadBtn.classList.remove("opacity-50", "cursor-not-allowed");
          }
          previewData(parsedCsvData.slice(0, 5));
        }
      } catch (err) {
        console.error("Error reading file:", err);
        alert("Gagal membaca file Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function previewData(data) {
    const body = document.getElementById("preview-body");
    if (!body) return;
    body.innerHTML = data.map(row => `
      <tr>
        <td class="border px-2 py-1 text-xs">${row.nama_siswa || row.nama || "-"}</td>
        <td class="border px-2 py-1 text-xs">${row.kelas || "-"}</td>
        <td class="border px-2 py-1 text-xs text-center">${row.nilai_bahasa || 0}</td>
        <td class="border px-2 py-1 text-xs text-center">${row.nilai_mtk || 0}</td>
      </tr>
    `).join("");
    const previewSection = document.getElementById("csv-preview");
    if (previewSection) previewSection.classList.remove("hidden");
  }

  // --- 6. PROSES ANALISIS KOLEKTIF (DB CONNECTED) ---
  csvUploadBtn?.addEventListener("click", async () => {
    if (parsedCsvData.length === 0) return alert("Pilih file dulu!");
    
    csvUploadBtn.disabled = true;
    csvUploadBtn.textContent = "Sedang Memproses...";
    if (csvProgress) csvProgress.classList.remove("hidden");
    detailedResults = []; 

    for (let i = 0; i < parsedCsvData.length; i++) {
      const row = parsedCsvData[i];
      const nb = Number(row.nilai_bahasa || 0);
      const nm = Number(row.nilai_mtk || 0);
      const ni = Number(row.nilai_ipa || 0);
      const ns = Number(row.nilai_ips || 0);

      const payload = {
        nama_siswa: row.nama_siswa || row.nama || "Siswa",
        kelas: row.kelas || "-",
        nilai_bahasa: nb,
        nilai_mtk: nm,
        nilai_ipa: ni,
        nilai_ips: ns,
        rata_rata_umum: (nb + nm + ni + ns) / 4,
        indeks_eksakta: (nm + ni) / 2,
        indeks_non_eksakta: (nb + ns) / 2,
        daya_visual_gambar: Number(row.daya_visual_gambar || 3),
        mengingat_suara: Number(row.mengingat_suara || 3),
        suka_praktik: Number(row.suka_praktik || 3),
        suka_membaca_mencatat: Number(row.suka_membaca_mencatat || 3),
        ekskul_motorik: Number(row.ekskul_motorik || 3),
        ekskul_musik: Number(row.ekskul_musik || 3),
        konsentrasi_belajar: Number(row.konsentrasi_belajar || 3)
      };

      try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "Authorization": TOKEN 
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          detailedResults.push({ ...payload, ...data });
        }
      } catch (err) { console.error("Error pada baris " + i, err); }

      const pct = Math.round(((i + 1) / parsedCsvData.length) * 100);
      if (csvProgressBar) csvProgressBar.style.width = pct + "%";
      if (csvProgressText) csvProgressText.textContent = pct + "%";
    }

    renderBatchResults(detailedResults);
    csvUploadBtn.disabled = false;
    csvUploadBtn.textContent = "Analisis Selesai";
    alert("Analisis Kolektif Selesai & Tersimpan ke Database!");
  });

  function renderBatchResults(results) {
    const body = document.getElementById("detailed-results-body");
    if (!body) return;
    body.innerHTML = results.map(r => `
      <tr>
        <td class="border px-4 py-2 text-sm">${r.nama_siswa}</td>
        <td class="border px-4 py-2 text-sm text-center">${r.kelas}</td>
        <td class="border px-4 py-2 text-sm font-bold text-primary-dark">${r.label || r.prediction}</td>
        <td class="border px-4 py-2 text-center text-xs">${((r.probabilities?.Visual || 0) * 100).toFixed(0)}%</td>
        <td class="border px-4 py-2 text-center text-xs">${((r.probabilities?.Auditori || 0) * 100).toFixed(0)}%</td>
        <td class="border px-4 py-2 text-center text-xs">${((r.probabilities?.Kinestetik || 0) * 100).toFixed(0)}%</td>
      </tr>
    `).join("");
    const section = document.getElementById("detailed-results-section");
    if (section) section.classList.remove("hidden");
    if (resultEl) resultEl.hidden = false;
    if (resultLabel) resultLabel.textContent = results.length + " Siswa Berhasil Dianalisis";
    resultEl.scrollIntoView({ behavior: 'smooth' });
  }

  // --- 7. ANALISIS MANUAL (DB CONNECTED) ---
  analyzeBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const nb = Number(document.getElementById("nilai_bahasa").value);
    const nm = Number(document.getElementById("nilai_mtk").value);
    const ni = Number(document.getElementById("nilai_ipa").value);
    const ns = Number(document.getElementById("nilai_ips").value);

    const payload = {
      nama_siswa: document.getElementById("nama_siswa").value,
      kelas: document.getElementById("kelas").value,
      nilai_bahasa: nb,
      nilai_mtk: nm,
      nilai_ipa: ni,
      nilai_ips: ns,
      rata_rata_umum: (nb + nm + ni + ns) / 4,
      indeks_eksakta: (nm + ni) / 2,
      indeks_non_eksakta: (nb + ns) / 2,
      daya_visual_gambar: Number(document.getElementById("daya_visual_gambar").value),
      mengingat_suara: Number(document.getElementById("mengingat_suara").value),
      suka_praktik: Number(document.getElementById("suka_praktik").value),
      suka_membaca_mencatat: Number(document.getElementById("suka_membaca_mencatat").value),
      ekskul_motorik: Number(document.getElementById("ekskul_motorik").value),
      ekskul_musik: Number(document.getElementById("ekskul_musik").value),
      konsentrasi_belajar: Number(document.getElementById("konsentrasi_belajar").value)
    };

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Memproses...";

    try {
      const res = await fetch(`${BACKEND_URL}/predict`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "Authorization": TOKEN 
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        renderSingleResult(data, payload.nama_siswa);
        alert("Data manual tersimpan ke database!");
      } else {
        alert("Gagal menganalisis. Cek kembali kelengkapan data.");
      }
    } catch (e) { console.error(e); }
    
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Mulai Analisis Karakter";
  });

  function renderSingleResult(data, name) {
    if (resultEl) resultEl.hidden = false;
    if (resultLabel) resultLabel.textContent = data.label || data.prediction;
    if (resultExplanation) resultExplanation.textContent = data.explanation || `Berdasarkan data, ${name} memiliki kecenderungan tipe belajar ${data.label || data.prediction}.`;
    if (resultTips) resultTips.innerHTML = (data.tips || []).map(t => `<li>${t}</li>`).join("");
    
    if (resultProbs) {
      resultProbs.innerHTML = "";
      Object.entries(data.probabilities || {}).forEach(([k, v]) => {
        const s = document.createElement("span");
        s.className = "px-3 py-1 bg-primary-light text-primary-dark rounded-full text-xs font-bold mr-2 mb-2 inline-block";
        s.textContent = `${k}: ${(v * 100).toFixed(1)}%`;
        resultProbs.appendChild(s);
      });
    }
    resultEl?.scrollIntoView({ behavior: 'smooth' });
  }

  // --- 8. UNDUH SEMUA DATA DARI DATABASE (HISTORY GURU) ---
  // Tombol "Unduh Database" disesuaikan dengan ID yang ada di index.html kamu
  document.getElementById("download-results-excel")?.addEventListener("click", async (e) => {
    // Jika tidak ada data di tabel (analisis baru), maka tarik dari database
    if (detailedResults.length === 0) {
      try {
          const response = await fetch(`${BACKEND_URL}/api/download-all?format=excel`, {
              method: "GET",
              headers: { "Authorization": TOKEN }
          });

          if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "Seluruh_Data_Siswa_Saya.xlsx";
              document.body.appendChild(a);
              a.click();
              a.remove();
          } else {
              alert("Gagal menarik data dari database.");
          }
      } catch (error) {
          console.error("Download database error:", error);
      }
    } else {
      // Jika ada data di tabel, lakukan download local seperti biasa
      const exportData = detailedResults.map(r => ({
        "Nama Siswa": r.nama_siswa,
        "Kelas": r.kelas,
        "Hasil": r.label || r.prediction,
        "Visual (%)": ((r.probabilities?.Visual || 0) * 100).toFixed(1),
        "Auditori (%)": ((r.probabilities?.Auditori || 0) * 100).toFixed(1),
        "Kinestetik (%)": ((r.probabilities?.Kinestetik || 0) * 100).toFixed(1)
      }));
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hasil Analisis");
      XLSX.writeFile(wb, "Hasil_Klasifikasi_Kolektif.xlsx");
    }
  });

  // --- 9. TAB SWITCHING & LOGOUT ---
  const btnManual = document.getElementById("tab-manual");
  const btnCsv = document.getElementById("tab-csv");
  const sectionManual = document.getElementById("analyzer-form");
  const sectionCsv = document.getElementById("csv-section");

  btnManual?.addEventListener("click", () => {
    sectionManual?.classList.remove("hidden");
    sectionCsv?.classList.add("hidden");
    btnManual.className = "active bg-primary-blue text-white px-4 py-2 rounded shadow-md cursor-pointer";
    if(btnCsv) btnCsv.className = "px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition cursor-pointer";
  });

  btnCsv?.addEventListener("click", () => {
    sectionManual?.classList.add("hidden");
    sectionCsv?.classList.remove("hidden");
    btnCsv.className = "active bg-primary-blue text-white px-4 py-2 rounded shadow-md cursor-pointer";
    if(btnManual) btnManual.className = "px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition cursor-pointer";
  });

  csvResetBtn?.addEventListener("click", () => {
    location.reload(); 
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });
});