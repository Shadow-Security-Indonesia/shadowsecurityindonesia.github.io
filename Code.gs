/**
 * Shadow Security Indonesia — penerima formulir order
 * Menyimpan setiap pesanan ke Google Sheets (di Google Drive) dan
 * mengirim email notifikasi ke admin.
 *
 * CARA PASANG (ringkas):
 * 1. Buat Google Sheets baru, beri nama "Order Shadow Security IDN".
 * 2. Menu Extensions > Apps Script, hapus isi bawaan, tempel kode ini.
 * 3. Ganti ADMIN_EMAIL di bawah dengan email admin.
 * 4. Klik Deploy > New deployment > jenis "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Izinkan akses saat diminta, lalu salin URL Web App.
 * 6. Tempel URL itu ke CONFIG.APPS_SCRIPT_URL di index.html.
 *
 * Catatan: setiap kali kode ini diubah, buat "New deployment" / versi baru
 * agar perubahan berlaku.
 */

const ADMIN_EMAIL = "admin@contoh.com";   // ganti dengan email admin
const SHEET_NAME  = "Orderan";

const HEADERS = ["Waktu", "Nama / Nickname", "Kota", "Layanan", "WhatsApp / Telegram", "Keluhan", "Halaman", "Status"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const p = (e && e.parameter) ? e.parameter : {};

    // Validasi dasar di sisi server
    const data = {
      nama:    clean(p.nama, 60),
      kota:    clean(p.kota, 60),
      layanan: clean(p.layanan, 80),
      kontak:  clean(p.kontak, 60),
      keluhan: clean(p.keluhan, 2000),
      halaman: clean(p.halaman, 300)
    };
    if (!data.nama || !data.kota || !data.layanan || !data.kontak || data.keluhan.length < 10) {
      return json({ ok: false, error: "Data tidak lengkap" });
    }

    // 1) Simpan ke Google Sheets (tersimpan di Google Drive Anda)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(SHEET_NAME);
      sh.appendRow(HEADERS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    }
    sh.appendRow([
      new Date(),
      safeCell(data.nama),
      safeCell(data.kota),
      safeCell(data.layanan),
      safeCell(data.kontak),
      safeCell(data.keluhan),
      safeCell(data.halaman),
      "Baru"
    ]);

    // 2) Kirim email notifikasi ke admin
    const subject = "Orderan baru: " + data.layanan + " — " + data.nama + " (" + data.kota + ")";
    const html =
      "<h2 style='margin:0 0 12px'>Orderan baru masuk</h2>" +
      "<table cellpadding='6' style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px'>" +
      row("Nama / Nickname", data.nama) +
      row("Kota", data.kota) +
      row("Layanan", data.layanan) +
      row("WhatsApp / Telegram", data.kontak) +
      row("Keluhan", data.keluhan) +
      "</table>" +
      "<p style='font-family:Arial,sans-serif;font-size:13px;color:#555'>Rekap lengkap ada di Google Sheets: " +
      ss.getUrl() + "</p>";

    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: subject,
      htmlBody: html,
      body: "Orderan baru dari " + data.nama + " (" + data.kota + ")\nLayanan: " + data.layanan +
            "\nKontak: " + data.kontak + "\n\n" + data.keluhan
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Agar membuka URL di browser tidak menampilkan error
function doGet() {
  return ContentService.createTextOutput("Endpoint formulir aktif.");
}

/* ---------- helper ---------- */
function clean(v, max) {
  return String(v || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

// Cegah formula injection di Sheets (sel yang diawali = + - @ dianggap rumus)
function safeCell(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function row(label, value) {
  return "<tr><td style='border:1px solid #ddd;font-weight:bold;vertical-align:top'>" + esc(label) +
         "</td><td style='border:1px solid #ddd;white-space:pre-wrap'>" + esc(value) + "</td></tr>";
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
