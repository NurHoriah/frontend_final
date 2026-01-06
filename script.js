document.addEventListener("DOMContentLoaded", () => {
  const XLSX = window.XLSX
  const TOKEN = localStorage.getItem("access_token")

  // --- 1. PROTEKSI HALAMAN & TOKEN CHECK ---
  if (!TOKEN) {
    window.location.replace("login.html")
    return
  }

  // Fungsi cek jika token sudah kadaluarsa (Payload JWT)
  function isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      return Math.floor(Date.now() / 1000) >= payload.exp
    } catch (e) {
      return true
    }
  }

  if (isTokenExpired(TOKEN)) {
    localStorage.clear()
    window.location.replace("login.html")
    return
  }

  // URL API Backend (Otomatis deteksi Local vs Production)
  window.API_URL = window.location.hostname === "localhost" ? "http://localhost:5004" : "https://api.xyz.biz.id"
  const BACKEND_URL = window.API_URL

  // --- 2. USER INTERFACE (NAMA GURU) ---
  const teacherName = document.getElementById("teacherName")
  if (teacherName) {
    teacherName.textContent = localStorage.getItem("user_name") || "Guru Penguji"
  }

  // DOM Elements - Manual
  const form = document.getElementById("analyzer-form")
  const analyzeBtn = document.getElementById("analyzeBtn")
  const resultEl = document.getElementById("result")
  const resultLabel = document.getElementById("result-label")
  const resultExplanation = document.getElementById("result-explanation")
  const resultTips = document.getElementById("result-tips")
  const resultProbs = document.getElementById("result-probs")

  // DOM Elements - Collective CSV/Excel Import
  const csvFileInput = document.getElementById("csv-file-input")
  const csvUploadBtn = document.getElementById("csv-upload-btn")
  const csvResetBtn = document.getElementById("csv-reset-btn")
  const csvProgress = document.getElementById("csv-progress")
  const csvProgressBar = document.getElementById("csv-progress-bar")
  const csvProgressText = document.getElementById("csv-progress-text")
  const csvDropZone = document.getElementById("csv-drop-zone")
  const fileStatusText = document.getElementById("file-status-text")
  const selectedFileInfo = document.getElementById("selected-file-info")
  const selectedFileName = document.getElementById("selected-file-name")
  const csvPreview = document.getElementById("csv-preview")
  const previewBody = document.getElementById("preview-body")
  const previewHeader = document.getElementById("preview-header")
  const detailedResultsSection = document.getElementById("detailed-results-section")
  const detailedResultsBody = document.getElementById("detailed-results-body")

  let parsedCsvData = []
  let detailedResults = []

  // --- 3. AUTO HITUNG (RATA-RATA & INDEKS) ---
  const scoreFields = ["nilai_bahasa", "nilai_mtk", "nilai_ipa", "nilai_ips"]
  scoreFields.forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.addEventListener("input", updateCalculatedFields)
  })

  function updateCalculatedFields() {
    const b = +document.getElementById("nilai_bahasa").value || 0
    const m = +document.getElementById("nilai_mtk").value || 0
    const i = +document.getElementById("nilai_ipa").value || 0
    const s = +document.getElementById("nilai_ips").value || 0

    const avgEl = document.getElementById("rata_rata_umum")
    const eksEl = document.getElementById("indeks_eksakta")
    const nonEksEl = document.getElementById("indeks_non_eksakta")

    if (avgEl) avgEl.value = Math.round((b + m + i + s) / 4)
    if (eksEl) eksEl.value = Math.round((m + i) / 2)
    if (nonEksEl) nonEksEl.value = Math.round((b + s) / 2)
  }

  // --- 4. DOWNLOAD TEMPLATE ---
  const kriteriaHeaders = [
    "nama_siswa",
    "kelas",
    "nilai_bahasa",
    "nilai_mtk",
    "nilai_ipa",
    "nilai_ips",
    "daya_visual_gambar",
    "mengingat_suara",
    "suka_praktik",
    "suka_membaca_mencatat",
    "ekskul_motorik",
    "ekskul_musik",
    "konsentrasi_belajar",
  ]

  document.getElementById("download-template-csv")?.addEventListener("click", (e) => {
    e.preventDefault()
    const csvContent = kriteriaHeaders.join(",") + "\nSiswa Contoh,6A,80,85,90,75,3,3,3,3,3,3,3"
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "Template_INKA.csv"
    link.click()
  })

  document.getElementById("download-template-excel")?.addEventListener("click", (e) => {
    e.preventDefault()
    const ws = XLSX.utils.aoa_to_sheet([kriteriaHeaders])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Template")
    XLSX.writeFile(wb, "Template_INKA.xlsx")
  })

  // --- 5. FILE HANDLING & PREVIEW ---
  if (csvDropZone) {
    csvDropZone.addEventListener("click", () => {
      if (csvFileInput) csvFileInput.click()
    })

    csvDropZone.addEventListener("dragover", (e) => {
      e.preventDefault()
      csvDropZone.classList.add("bg-blue-100")
    })

    csvDropZone.addEventListener("dragleave", () => {
      csvDropZone.classList.remove("bg-blue-100")
    })

    csvDropZone.addEventListener("drop", (e) => {
      e.preventDefault()
      csvDropZone.classList.remove("bg-blue-100")
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0])
      }
    })
  }

  if (csvFileInput) {
    csvFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0])
      }
    })
  }

  function handleFile(file) {
    if (!file) return

    const fileName = file.name.toLowerCase()
    const fileExtension = fileName.substring(fileName.lastIndexOf("."))
    const validExtensions = [".csv", ".xlsx", ".xls"]

    if (!validExtensions.includes(fileExtension)) {
      alert("Format file tidak didukung. Gunakan file .csv, .xlsx, atau .xls")
      return
    }

    if (selectedFileName) {
      selectedFileName.textContent = file.name
    }
    if (selectedFileInfo) {
      selectedFileInfo.classList.remove("hidden")
    }
    if (fileStatusText) {
      fileStatusText.textContent = "File terpilih: " + file.name
    }

    if (fileExtension === ".csv") {
      handleCsvFile(file)
    } else {
      handleExcelFile(file)
    }
  }

  function handleCsvFile(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csv = e.target.result
        const lines = csv.trim().split("\n")

        if (lines.length <= 1) {
          alert("File CSV kosong atau tidak memiliki data.")
          return
        }

        // Parse headers
        const headers = lines[0].split(",").map((h) => String(h).trim().toLowerCase().replace(/\s+/g, "_"))

        const rows = []
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === "") continue

          const values = lines[i].split(",").map((v) => v.trim())
          const obj = {}
          headers.forEach((h, idx) => {
            obj[h] = values[idx] || ""
          })
          rows.push(obj)
        }

        parsedCsvData = rows

        if (parsedCsvData.length > 0) {
          previewData(parsedCsvData.slice(0, 5))
          if (csvUploadBtn) {
            csvUploadBtn.disabled = false
            csvUploadBtn.classList.remove("opacity-50", "cursor-not-allowed")
          }
          console.log("[v0] CSV parsed successfully:", parsedCsvData.length, "rows")
        }
      } catch (err) {
        console.error("[v0] Error reading CSV:", err)
        alert("Gagal membaca file CSV: " + err.message)
      }
    }
    reader.readAsText(file)
  }

  function handleExcelFile(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: "array" })

        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
          alert("File Excel tidak memiliki sheet atau formatnya salah.")
          return
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" })

        if (!jsonData || jsonData.length <= 1) {
          alert("File Excel kosong atau tidak memiliki data.")
          return
        }

        const headers = (jsonData[0] || [])
          .map((h) => String(h).trim().toLowerCase().replace(/\s+/g, "_"))
          .filter((h) => h.length > 0)

        const rows = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || row.length === 0) continue

          const obj = {}
          headers.forEach((h, idx) => {
            obj[h] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : ""
          })

          // Only add non-empty rows
          if (Object.values(obj).some((v) => v !== "")) {
            rows.push(obj)
          }
        }

        parsedCsvData = rows

        if (parsedCsvData.length > 0) {
          previewData(parsedCsvData.slice(0, 5))
          if (csvUploadBtn) {
            csvUploadBtn.disabled = false
            csvUploadBtn.classList.remove("opacity-50", "cursor-not-allowed")
          }
          console.log("[v0] Excel parsed successfully:", parsedCsvData.length, "rows")
        }
      } catch (err) {
        console.error("[v0] Error reading Excel:", err)
        alert("Gagal membaca file Excel: " + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function previewData(data) {
    if (!previewBody) {
      console.warn("[v0] preview-body element not found")
      return
    }

    if (!previewHeader) {
      console.warn("[v0] preview-header element not found")
      return
    }

    previewHeader.innerHTML = ""
    previewBody.innerHTML = ""

    if (data.length === 0) return

    // Get headers from first row
    const headers = Object.keys(data[0])

    // Create header row
    headers.forEach((h) => {
      const th = document.createElement("th")
      th.className = "border px-2 py-1 text-xs font-medium bg-gray-100"
      th.textContent = h.replace(/_/g, " ").toUpperCase()
      previewHeader.appendChild(th)
    })

    // Create data rows
    data.forEach((row) => {
      const tr = document.createElement("tr")
      headers.forEach((h) => {
        const td = document.createElement("td")
        td.className = "border px-2 py-1 text-xs"
        td.textContent = row[h] || "-"
        tr.appendChild(td)
      })
      previewBody.appendChild(tr)
    })

    // Show preview section
    if (csvPreview) {
      csvPreview.classList.remove("hidden")
    }
  }

  // --- 6. PROSES ANALISIS KOLEKTIF (DB CONNECTED) ---
  if (csvUploadBtn) {
    csvUploadBtn.addEventListener("click", async () => {
      if (parsedCsvData.length === 0) {
        alert("Pilih file dulu!")
        return
      }

      csvUploadBtn.disabled = true
      csvUploadBtn.textContent = "Sedang Memproses..."
      if (csvProgress) csvProgress.classList.remove("hidden")

      detailedResults = []
      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < parsedCsvData.length; i++) {
        const row = parsedCsvData[i]

        const nb = Math.max(0, Math.min(100, Number.parseFloat(row.nilai_bahasa || 0)))
        const nm = Math.max(0, Math.min(100, Number.parseFloat(row.nilai_mtk || 0)))
        const ni = Math.max(0, Math.min(100, Number.parseFloat(row.nilai_ipa || 0)))
        const ns = Math.max(0, Math.min(100, Number.parseFloat(row.nilai_ips || 0)))

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
          daya_visual_gambar: Math.max(1, Math.min(5, Number.parseFloat(row.daya_visual_gambar || 3))),
          mengingat_suara: Math.max(1, Math.min(5, Number.parseFloat(row.mengingat_suara || 3))),
          suka_praktik: Math.max(1, Math.min(5, Number.parseFloat(row.suka_praktik || 3))),
          suka_membaca_mencatat: Math.max(1, Math.min(5, Number.parseFloat(row.suka_membaca_mencatat || 3))),
          ekskul_motorik: Math.max(1, Math.min(5, Number.parseFloat(row.ekskul_motorik || 3))),
          ekskul_musik: Math.max(1, Math.min(5, Number.parseFloat(row.ekskul_musik || 3))),
          konsentrasi_belajar: Math.max(1, Math.min(5, Number.parseFloat(row.konsentrasi_belajar || 3))),
        }

        try {
          const res = await fetch(`${BACKEND_URL}/predict`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${TOKEN}`,
            },
            body: JSON.stringify(payload),
          })

          if (res.ok) {
            const data = await res.json()
            detailedResults.push({ ...payload, ...data })
            successCount++
            console.log(`[v0] Row ${i + 1} success:`, data)
          } else {
            const errorText = await res.text()
            console.error(`[v0] Row ${i + 1} failed:`, res.status, errorText)
            errorCount++
          }
        } catch (err) {
          console.error(`[v0] Error on row ${i + 1}:`, err)
          errorCount++
        }

        const pct = Math.round(((i + 1) / parsedCsvData.length) * 100)
        if (csvProgressBar) csvProgressBar.style.width = pct + "%"
        if (csvProgressText) csvProgressText.textContent = pct + "%"
      }

      renderBatchResults(detailedResults)
      csvUploadBtn.disabled = false
      csvUploadBtn.textContent = "Analisis Selesai"
      alert(`Analisis Kolektif Selesai!\nBerhasil: ${successCount}\nGagal: ${errorCount}\nData tersimpan ke Database.`)
    })
  }

  function renderBatchResults(results) {
    if (!detailedResultsBody) {
      console.warn("[v0] detailed-results-body element not found")
      return
    }

    detailedResultsBody.innerHTML = results
      .map(
        (r) => `
      <tr>
        <td class="border px-4 py-2 text-sm">${r.nama_siswa || "-"}</td>
        <td class="border px-4 py-2 text-sm text-center">${r.kelas || "-"}</td>
        <td class="border px-4 py-2 text-sm font-bold text-primary-dark">${r.label || r.prediction || "-"}</td>
        <td class="border px-4 py-2 text-center text-xs">${
          r.probabilities && r.probabilities.Visual ? ((r.probabilities.Visual || 0) * 100).toFixed(0) : "0"
        }%</td>
        <td class="border px-4 py-2 text-center text-xs">${
          r.probabilities && r.probabilities.Auditori ? ((r.probabilities.Auditori || 0) * 100).toFixed(0) : "0"
        }%</td>
        <td class="border px-4 py-2 text-center text-xs">${
          r.probabilities && r.probabilities.Kinestetik ? ((r.probabilities.Kinestetik || 0) * 100).toFixed(0) : "0"
        }%</td>
      </tr>
    `,
      )
      .join("")

    if (detailedResultsSection) {
      detailedResultsSection.classList.remove("hidden")
    }
    if (resultEl) {
      resultEl.hidden = false
    }
    if (resultLabel) {
      resultLabel.textContent = results.length + " Siswa Berhasil Dianalisis"
    }
    resultEl?.scrollIntoView({ behavior: "smooth" })
  }

  // --- 7. ANALISIS MANUAL (DB CONNECTED) ---
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", async (e) => {
      e.preventDefault()

      const nb = Number(document.getElementById("nilai_bahasa").value)
      const nm = Number(document.getElementById("nilai_mtk").value)
      const ni = Number(document.getElementById("nilai_ipa").value)
      const ns = Number(document.getElementById("nilai_ips").value)

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
        konsentrasi_belajar: Number(document.getElementById("konsentrasi_belajar").value),
      }

      analyzeBtn.disabled = true
      analyzeBtn.textContent = "Memproses..."

      try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TOKEN}`,
          },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const data = await res.json()
          renderSingleResult(data, payload.nama_siswa)
          alert("Data manual tersimpan ke database!")
          console.log("[v0] Manual prediction saved:", data)
        } else {
          const errorText = await res.text()
          console.error("[v0] Prediction error:", res.status, errorText)
          alert("Gagal menganalisis. Cek kembali kelengkapan data atau koneksi ke server.")
        }
      } catch (e) {
        console.error("[v0] Fetch error:", e)
        alert("Error: " + e.message)
      }

      analyzeBtn.disabled = false
      analyzeBtn.textContent = "Mulai Analisis Karakter"
    })
  }

  function renderSingleResult(data, name) {
    if (resultEl) resultEl.hidden = false
    if (resultLabel) resultLabel.textContent = data.label || data.prediction
    if (resultExplanation) {
      resultExplanation.textContent =
        data.explanation ||
        `Berdasarkan data, ${name} memiliki kecenderungan tipe belajar ${data.label || data.prediction}.`
    }
    if (resultTips) {
      resultTips.innerHTML = (data.tips || []).map((t) => `<li>${t}</li>`).join("")
    }

    if (resultProbs) {
      resultProbs.innerHTML = ""
      Object.entries(data.probabilities || {}).forEach(([k, v]) => {
        const s = document.createElement("span")
        s.className =
          "px-3 py-1 bg-primary-light text-primary-dark rounded-full text-xs font-bold mr-2 mb-2 inline-block"
        s.textContent = `${k}: ${(v * 100).toFixed(1)}%`
        resultProbs.appendChild(s)
      })
    }
    resultEl?.scrollIntoView({ behavior: "smooth" })
  }

  // --- 8. UNDUH SEMUA DATA DARI DATABASE (HISTORY GURU) ---
  document.getElementById("download-results-excel")?.addEventListener("click", async (e) => {
    e.preventDefault()

    if (detailedResults.length === 0) {
      // Tarik dari database jika tabel kosong
      try {
        const response = await fetch(`${BACKEND_URL}/api/download-all?format=excel`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
          },
        })

        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "Seluruh_Data_Siswa_Saya.xlsx"
          document.body.appendChild(a)
          a.click()
          a.remove()
          window.URL.revokeObjectURL(url)
          console.log("[v0] Database download successful")
        } else {
          const errorText = await response.text()
          console.error("[v0] Download error:", response.status, errorText)
          alert("Gagal menarik data dari database. Status: " + response.status)
        }
      } catch (error) {
        console.error("[v0] Download database error:", error)
        alert("Error: " + error.message)
      }
    } else {
      // Download hasil lokal dari tabel
      const exportData = detailedResults.map((r) => ({
        "Nama Siswa": r.nama_siswa,
        Kelas: r.kelas,
        Hasil: r.label || r.prediction,
        "Visual (%)":
          r.probabilities && r.probabilities.Visual ? ((r.probabilities.Visual || 0) * 100).toFixed(1) : "0",
        "Auditori (%)":
          r.probabilities && r.probabilities.Auditori ? ((r.probabilities.Auditori || 0) * 100).toFixed(1) : "0",
        "Kinestetik (%)":
          r.probabilities && r.probabilities.Kinestetik ? ((r.probabilities.Kinestetik || 0) * 100).toFixed(1) : "0",
      }))

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Hasil Analisis")
      XLSX.writeFile(wb, "Hasil_Klasifikasi_Kolektif.xlsx")
      console.log("[v0] Local file download successful")
    }
  })

  // --- 9. TAB SWITCHING & LOGOUT ---
  const btnManual = document.getElementById("tab-manual")
  const btnCsv = document.getElementById("tab-csv")
  const sectionManual = document.getElementById("analyzer-form")
  const sectionCsv = document.getElementById("csv-section")

  if (btnManual && btnCsv) {
    btnManual.addEventListener("click", () => {
      if (sectionManual) sectionManual.classList.remove("hidden")
      if (sectionCsv) sectionCsv.classList.add("hidden")
      btnManual.className = "tab-btn active bg-primary-blue text-white px-4 py-2 rounded shadow-md cursor-pointer"
      if (btnCsv)
        btnCsv.className = "tab-btn px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition cursor-pointer"
    })

    btnCsv.addEventListener("click", () => {
      if (sectionManual) sectionManual.classList.add("hidden")
      if (sectionCsv) sectionCsv.classList.remove("hidden")
      btnCsv.className = "tab-btn active bg-primary-blue text-white px-4 py-2 rounded shadow-md cursor-pointer"
      if (btnManual)
        btnManual.className = "tab-btn px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition cursor-pointer"
    })
  }

  if (csvResetBtn) {
    csvResetBtn.addEventListener("click", () => {
      location.reload()
    })
  }

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear()
    window.location.href = "login.html"
  })
})
