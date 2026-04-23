/**
 * Google Apps Script — append Feature Request rows to the "Feedback" sheet.
 *
 * 1. Open the spreadsheet: https://docs.google.com/spreadsheets/d/1rjIyKAnGpUOuQW-ueOrE6wIPvd7nsj180KWuvH1fk7c/edit
 * 2. Extensions → Apps Script → paste this file → Save.
 * 3. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (or Anyone with Google account)
 * 4. Copy the Web App URL into salt_app/.env.local as GOOGLE_SHEETS_WEBAPP_URL=
 * 5. Restart `npm run dev`.
 *
 * Expected POST JSON from the SALT dev proxy:
 * { "featureRequestSheet": { "dateDisplay", "fullName", "userEmail", "tabWidget", "summary", "priorityStars", "details" } }
 */

var SPREADSHEET_ID = "1rjIyKAnGpUOuQW-ueOrE6wIPvd7nsj180KWuvH1fk7c";
var SHEET_NAME = "Feedback";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var f = body.featureRequestSheet;
    if (!f || typeof f !== "object") {
      return jsonOut({ ok: false, error: "Missing featureRequestSheet" });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonOut({ ok: false, error: "Sheet not found: " + SHEET_NAME });
    }

    var n = Number(f.priorityStars);
    if (n !== 1 && n !== 2 && n !== 5) {
      n = 1;
    }
    var stars = new Array(n + 1).join("\u2605");

    var nextRow = sheet.getLastRow() + 1;

    var colLParts = [];
    if (f.userEmail) {
      colLParts.push("Submitted by (email): " + String(f.userEmail));
    }
    if (f.details) {
      colLParts.push(String(f.details));
    }
    var colL = colLParts.join("\n\n");

    // Columns A–L: # empty, Date, Full Name, Tab (Widget), Description, Request Urgency, Rating, H, I, Status, BI Response, Additional
    var row = [
      "",
      f.dateDisplay || "",
      f.fullName || "",
      f.tabWidget || "",
      f.summary || "",
      stars,
      "",
      "",
      "",
      "Backlog",
      "",
      colL,
    ];

    sheet.getRange(nextRow, 1, nextRow, row.length).setValues([row]);
    return jsonOut({ ok: true, row: nextRow });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
