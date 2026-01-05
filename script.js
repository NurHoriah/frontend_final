document.addEventListener("DOMContentLoaded", () => {
  const XLSX = window.XLSX;
  const TOKEN = localStorage.getItem("access_token");

  // Proteksi Halaman: Jika tidak ada token, tendang ke login
  if (!TOKEN) {
    window.location.replace("login.html");
    return;
  }

  // URL Backend Setup (Otomatis deteksi mode)
  window.API_URL = window.location.hostname === "localhost" ? "http://localhost:5004" : "https://api.xyz.biz.id";
  const BACKEND_URL = window.API_URL;

  // DOM Elements
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

  let parsedCsvData = [];
  let detailedResults = [];

  // Tampilkan Nama Guru di Dashboard
  const teacherName = document.getElementById("teacherName");
  if (teacherName) teacherName.textContent = localStorage.getItem("user_name") || "Guru";

  // --- LOGIKA 1: Perhitungan Otomatis Rata-rata & Indeks ---
  const scoreFields = ["nilai_bahasa", "nilai_mtk", "nilai_ipa", "nilai_ips"];
  scoreFields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => {
      const b = parseFloat(document.getElementById("nilai_bahasa").value) || 0;
      const m = parseFloat(document.getElementById("nilai_mtk").value) || 0;
      const i = parseFloat(document.getElementById("nilai_ipa").value) || 0;
      const s = parseFloat(document.getElementById("nilai_ips").value) || 0;

      // Update field hasil (pembulatan bulat sesuai logika sidang Anda)
      if(document.getElementById("rata_rata_umum")) document.getElementById("rata_rata_umum").value = Math.round((b + m + i + s) / 4);
      if(document.getElementById("indeks_eksakta")) document.getElementById("indeks_eksakta").value = Math.round((m + i) / 2);
      if(document.getElementById("indeks_non_eksakta")) document.getElementById("indeks_non_eksakta").value = Math.round((b + s) / 2);
    });
  });

  // --- LOGIKA 2: Analisis Input Manual (FIX ERROR 422) ---
  if (analyzeBtn) {
    analyzeBtn.onclick = async (e) => {
      e.preventDefault();
      const b = Number(document.getElementById("nilai_bahasa").value) || 0;
      const m = Number(document.getElementById("nilai_mtk").value) || 0;
      const i = Number(document.getElementById("nilai_ipa").value) || 0;
      const s = Number(document.getElementById("nilai_ips").value) || 0;

      const payload = {
        nama_siswa: document.getElementById("nama_siswa").value || "Siswa",
        kelas: document.getElementById("kelas").value || "-",
        nilai_bahasa: b, nilai_mtk: m, nilai_ipa: i, nilai_ips: s,
        rata_rata_umum: parseFloat(document.getElementById("rata_rata_umum").value) || (b + m + i + s) / 4,
        indeks_eksakta: parseFloat(document.getElementById("indeks_eksakta").value) || (m + i) / 2,
        indeks_non_eksakta: parseFloat(document.getElementById("indeks_non_eksakta").value) || (b + s) / 2,
        daya_visual_gambar: Number(document.getElementById("daya_visual_gambar").value) || 3,
        mengingat_suara: Number(document.getElementById("mengingat_suara").value) || 3,
        suka_praktik: Number(document.getElementById("suka_praktik").value) || 3,
        suka_membaca_mencatat: Number(document.getElementById("suka_membaca_mencatat").value) || 3,
        ekskul_motorik: Number(document.getElementById("ekskul_motorik").value) || 3,
        ekskul_musik: Number(document.getElementById("ekskul_musik").value) || 3
      };

      try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) renderSingleResult(data, payload.nama_siswa);
        else alert("Gagal melakukan analisis: " + (data.error || "Cek input (422)"));
      } catch (err) { alert("Terjadi kesalahan koneksi ke server."); }
    };
  }

  function renderSingleResult(data, name) {
    resultEl.hidden = false;
    resultLabel.textContent = data.label || data.prediction;
    resultExplanation.textContent = data.explanation || `Siswa ${name} memiliki tipe belajar ${data.label}.`;
    resultTips.innerHTML = (data.tips || []).map((t) => `<li>${t}</li>`).join("");
    resultProbs.innerHTML = "";
    if (data.probabilities) {
      Object.entries(data.probabilities).forEach(([key, val]) => {
        const span = document.createElement("span");
        span.className = "px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs mr-2 mb-2 inline-block";
        span.textContent = `${key}: ${(val * 100).toFixed(1)}%`;
        resultProbs.appendChild(span);
      });
    }
    resultEl.scrollIntoView({ behavior: 'smooth' });
  }

  // --- LOGIKA 3: Tab Switching (Manual vs CSV) ---
  const tabManual = document.getElementById("tab-manual");
  const tabCsv = document.getElementById("tab-csv");
  if (tabManual && tabCsv) {
    tabManual.onclick = () => {
      form.classList.remove("hidden"); csvSection.classList.add("hidden");
      tabManual.className = "active bg-primary-blue text-white px-4 py-2 rounded shadow-md";
      tabCsv.className = "px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition";
    };
    tabCsv.onclick = () => {
      form.classList.add("hidden"); csvSection.classList.remove("hidden");
      tabCsv.className = "active bg-primary-blue text-white px-4 py-2 rounded shadow-md";
      tabManual.className = "px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition";
    };
  }

  // --- LOGIKA 4: Handle Upload File & Preview ---
  if (csvDropZone) {
    csvDropZone.onclick = () => csvFileInput.click();
    csvFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById("selected-file-info").classList.remove("hidden");
      document.getElementById("selected-file-name").textContent = file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        parsedCsvData = json;
        csvUploadBtn.disabled = false;
        document.getElementById("preview-body").innerHTML = json.slice(0, 5).map(row => `
          <tr>
            <td class="border px-2 py-1 text-sm">${row.nama_siswa || row.nama || "-"}</td>
            <td class="border px-2 py-1 text-sm text-center">${row.kelas || "-"}</td>
            <td class="border px-2 py-1 text-sm text-center">${row.nilai_bahasa || 0}</td>
            <td class="border px-2 py-1 text-sm text-center">${row.nilai_mtk || 0}</td>
          </tr>
        `).join("");
        document.getElementById("csv-preview").classList.remove("hidden");
      };
      reader.readAsArrayBuffer(file);
    };
  }

  // --- LOGIKA 5: Proses Batch Upload (Kolektif) ---
  if (csvUploadBtn) {
    csvUploadBtn.onclick = async () => {
      csvUploadBtn.disabled = true;
      csvProgress.classList.remove("hidden");
      detailedResults = [];
      for (let i = 0; i < parsedCsvData.length; i++) {
        const row = parsedCsvData[i];
        const nb = Number(row.nilai_bahasa || 0), nm = Number(row.nilai_mtk || 0);
        const ni = Number(row.nilai_ipa || 0), ns = Number(row.nilai_ips || 0);
        const payload = {
          nama_siswa: row.nama_siswa || "Siswa", kelas: row.kelas || "-",
          nilai_bahasa: nb, nilai_mtk: nm, nilai_ipa: ni, nilai_ips: ns,
          rata_rata_umum: (nb + nm + ni + ns) / 4,
          indeks_eksakta: (nm + ni) / 2, indeks_non_eksakta: (nb + ns) / 2,
          daya_visual_gambar: Number(row.daya_visual_gambar || 3),
          mengingat_suara: Number(row.mengingat_suara || 3),
          suka_praktik: Number(row.suka_praktik || 3),
          suka_membaca_mencatat: Number(row.suka_membaca_mencatat || 3),
          ekskul_motorik: Number(row.ekskul_motorik || 3),
          ekskul_musik: Number(row.ekskul_musik || 3)
        };
        try {
          const res = await fetch(`${BACKEND_URL}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const resData = await res.json();
            detailedResults.push({ ...payload, ...resData });
          }
        } catch (e) { console.error(e); }
        const pct = Math.round(((i + 1) / parsedCsvData.length) * 100);
        csvProgressBar.style.width = pct + "%";
        csvProgressText.textContent = pct + "%";
      }
      renderBatchResults(detailedResults);
      alert("Analisis Kolektif Berhasil Selesai!");
    };
  }

  function renderBatchResults(results) {
    resultEl.hidden = false;
    document.getElementById("detailed-results-section").classList.remove("hidden");
    document.getElementById("detailed-results-body").innerHTML = results.map(r => `
      <tr class="hover:bg-gray-50 text-sm">
        <td class="border px-4 py-2">${r.nama_siswa}</td>
        <td class="border px-4 py-2 text-center">${r.kelas}</td>
        <td class="border px-4 py-2 font-bold text-blue-600">${r.label || r.prediction}</td>
        <td class="border px-4 py-2 text-xs text-center">${((r.probabilities?.Visual || 0)*100).toFixed(1)}%</td>
        <td class="border px-4 py-2 text-xs text-center">${((r.probabilities?.Auditori || 0)*100).toFixed(1)}%</td>
        <td class="border px-4 py-2 text-xs text-center">${((r.probabilities?.Kinestetik || 0)*100).toFixed(1)}%</td>
      </tr>
    `).join("");
    resultEl.scrollIntoView({ behavior: 'smooth' });
  }

  // --- LOGIKA 6: Download Template ---
  const downloadTemplate = (isExcel) => {
    const headers = ["nama_siswa", "kelas", "nilai_bahasa", "nilai_mtk", "nilai_ipa", "nilai_ips", "daya_visual_gambar", "mengingat_suara", "suka_praktik", "suka_membaca_mencatat", "ekskul_motorik", "ekskul_musik"];
    const ws = XLSX.utils.aoa_to_sheet([headers, ["Ahmad", "4B", 85, 90, 80, 85, 5, 4, 3, 5, 4, 2]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `Template_Siswa.${isExcel ? 'xlsx' : 'csv'}`);
  };
  document.getElementById("download-template-csv")?.addEventListener("click", (e) => { e.preventDefault(); downloadTemplate(false); });
  document.getElementById("download-template-excel")?.addEventListener("click", (e) => { e.preventDefault(); downloadTemplate(true); });

  // --- LOGIKA 7: Download Hasil Analisis ---
  document.getElementById("download-results-excel")?.addEventListener("click", () => {
    if (detailedResults.length === 0) return alert("Belum ada data untuk diunduh.");
    const exportData = detailedResults.map(r => ({
      Nama: r.nama_siswa, Kelas: r.kelas, Prediksi: r.label,
      Visual: (r.probabilities?.Visual || 0), Auditori: (r.probabilities?.Auditori || 0), Kinestetik: (r.probabilities?.Kinestetik || 0)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hasil");
    XLSX.writeFile(wb, "Hasil_Analisis_Kolektif.xlsx");
  });

  // --- LOGIKA 8: Logout & Reset ---
  document.getElementById("logoutBtn")?.onclick = () => { localStorage.clear(); window.location.href = "login.html"; };
  document.getElementById("resetBtn")?.onclick = () => window.location.reload();
  if (csvResetBtn) csvResetBtn.onclick = () => window.location.reload();
});