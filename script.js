// ===============================
// SCRIPT.JS FINAL - STABIL & AMAN
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  // ===============================
  // PROTEKSI HALAMAN (WAJIB LOGIN)
  // ===============================
  const TOKEN = localStorage.getItem("access_token")

  if (!TOKEN) {
    console.warn("Token tidak ditemukan, redirect ke login")
    window.location.replace("login.html")
    return
  }

  // ===============================
  // KONFIGURASI API (pakai environment variable)
  // ===============================
  const BACKEND_URL = window.location.hostname === "localhost" ? "http://localhost:5004" : "https://api.xyz.biz.id" // Ganti dengan domain Cloudflare kamu

  console.log("[INFO] Using API URL:", BACKEND_URL)

  // ===============================
  // ===============================
  function isTokenExpired() {
    const token = localStorage.getItem("access_token")
    if (!token) return true

    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      const exp = payload.exp * 1000 // Convert ke milliseconds
      return Date.now() >= exp
    } catch (e) {
      return true
    }
  }

  // Redirect jika token expired
  if (isTokenExpired()) {
    console.warn("Token expired, redirect ke login")
    localStorage.removeItem("access_token")
    window.location.replace("login.html")
    return
  }

  // Check token setiap 5 menit
  setInterval(() => {
    if (isTokenExpired()) {
      console.warn("Token will expire soon")
      localStorage.removeItem("access_token")
      window.location.replace("login.html")
    }
  }, 300000)

  // ===============================
  // FIELD NUMERIK
  // ===============================
  const fields = [
    "nilai_bahasa",
    "nilai_mtk",
    "nilai_ipa",
    "nilai_ips",
    "rata_rata_umum",
    "indeks_eksakta",
    "indeks_non_eksakta",
    "daya_visual_gambar",
    "mengingat_suara",
    "suka_praktik",
    "suka_membaca_mencatat",
    "ekskul_motorik",
    "ekskul_musik",
  ]

  // ===============================
  // AMBIL ELEMEN DOM
  // ===============================
  const form = document.getElementById("analyzer-form")
  const analyzeBtn = document.getElementById("analyzeBtn")
  const resetBtn = document.getElementById("resetBtn")
  const resultEl = document.getElementById("result")
  const resultLabel = document.getElementById("result-label")
  const resultExplanation = document.getElementById("result-explanation")
  const resultTips = document.getElementById("result-tips")
  const resultProbs = document.getElementById("result-probs")

  // ===============================
  // AUTO HITUNG RATA-RATA & INDEKS
  // ===============================
  ;["nilai_bahasa", "nilai_mtk", "nilai_ipa", "nilai_ips"].forEach((id) => {
    const el = document.getElementById(id)
    if (el) el.addEventListener("input", updateCalculatedFields)
  })

  function updateCalculatedFields() {
    const b = +document.getElementById("nilai_bahasa").value || 0
    const m = +document.getElementById("nilai_mtk").value || 0
    const i = +document.getElementById("nilai_ipa").value || 0
    const s = +document.getElementById("nilai_ips").value || 0

    document.getElementById("rata_rata_umum").value = Math.round((b + m + i + s) / 4)
    document.getElementById("indeks_eksakta").value = Math.round((m + i) / 2)
    document.getElementById("indeks_non_eksakta").value = Math.round((b + s) / 2)
  }

  // ===============================
  // BUAT PAYLOAD
  // ===============================
  function getPayload() {
    const payload = {
      nama_siswa: document.getElementById("nama_siswa").value || "",
      kelas: document.getElementById("kelas").value || "",
    }

    for (const k of fields) {
      const el = document.getElementById(k)
      payload[k] = el && el.value !== "" ? Number(el.value) : 0
    }

    return payload
  }

  // ===============================
  // TAMPILKAN HASIL
  // ===============================
  function renderResult(data) {
    const nama = document.getElementById("nama_siswa").value || "Siswa"
    const kelas = document.getElementById("kelas").value || "-"

    const label = data.label || data.prediction || "-" // fallback aman
    resultLabel.textContent = `${label} (${nama} - Kelas ${kelas})`

    resultExplanation.textContent = data.explanation || ""

    resultTips.innerHTML = ""
    ;(data.tips || []).forEach((t) => {
      const li = document.createElement("li")
      li.textContent = t
      resultTips.appendChild(li)
    })

    resultProbs.innerHTML = ""
    if (data.probabilities) {
      ;["Visual", "Auditori", "Kinestetik"].forEach((k) => {
        const v = data.probabilities[k] ?? 0
        const pill = document.createElement("span")
        pill.className = "pill"
        pill.textContent = `${k}: ${(v * 100).toFixed(1)}%`
        resultProbs.appendChild(pill)
      })
    }

    resultEl.hidden = false
  }

  // ===============================
  // BACKUP PERHITUNGAN (LOCAL)
  // ===============================
  function localCompute(payload) {
    const norm = (v) => Math.max(0, Math.min(100, v)) / 100

    const visual =
      0.25 * norm(payload.daya_visual_gambar) +
      0.2 * norm(payload.suka_membaca_mencatat) +
      0.1 * norm(payload.nilai_ips) +
      0.05 * norm(payload.nilai_bahasa) +
      0.15 * norm(payload.indeks_non_eksakta)

    const auditori =
      0.35 * norm(payload.mengingat_suara) + 0.2 * norm(payload.ekskul_musik) + 0.1 * norm(payload.nilai_bahasa)

    const kinestetik =
      0.3 * norm(payload.suka_praktik) +
      0.2 * norm(payload.ekskul_motorik) +
      0.1 * norm(payload.nilai_mtk) +
      0.1 * norm(payload.nilai_ipa) +
      0.15 * norm(payload.indeks_eksakta)

    const sum = visual + auditori + kinestetik || 1
    const probs = {
      Visual: visual / sum,
      Auditori: auditori / sum,
      Kinestetik: kinestetik / sum,
    }

    const best = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0]

    return {
      label: best,
      probabilities: probs,
      explanation: {
        Visual: "Siswa visual belajar efektif dengan gambar dan catatan.",
        Auditori: "Siswa auditori menyerap informasi lewat suara.",
        Kinestetik: "Siswa kinestetik optimal dengan praktik langsung.",
      }[best],
      tips: {
        Visual: ["Gunakan mind map", "Diagram & warna"],
        Auditori: ["Diskusi", "Rekaman suara"],
        Kinestetik: ["Praktik langsung", "Aktivitas fisik"],
      }[best],
    }
  }

  // ===============================
  // KLIK ANALISIS
  // ===============================
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", async () => {
      const payload = getPayload()

      try {
        const resp = await fetch(`${BACKEND_URL}/predict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify(payload),
        })

        if (!resp.ok) throw new Error("Backend error")

        const data = await resp.json()
        renderResult(data)
      } catch (e) {
        console.warn("Backend error, fallback ke lokal", e)
        renderResult(localCompute(payload))
      }
    })
  }

  // ===============================
  // RESET
  // ===============================
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset()
      resultEl.hidden = true
    })
  }
})
