/**
 * Google Apps Script — append Feature Request rows to the "Feedback" sheet.
 *
 * 1. Set SPREADSHEET_ID to the ID from your sheet’s URL (…/d/THIS_PART/edit).
 * 2. Extensions → Apps Script → paste → Save → Deploy → Web app (Execute as: Me, Who has access: Anyone).
 * 3. Copy the /exec URL into GOOGLE_SHEETS_WEBAPP_URL (Netlify + .env.local).
 *
 * Layout (must match your tab): row HEADER_ROW = column headers; data starts HEADER_ROW+1.
 * Writes columns B–L: #, Date, Full Name, Tab, Description, Request Urgency, Dashboard Rating, (spacer), Status, BI Response, Additional.
 *
 * Expected POST JSON:
 * { "featureRequestSheet": { "dateDisplay", "fullName", "userEmail", "tabWidget", "summary", "priorityStars", "details" } }
 */

/** From the spreadsheet URL: https://docs.google.com/spreadsheets/d/<THIS>/edit */
var SPREADSHEET_ID = "1rjIyKAnGpUOuQW-ueOrE6wIPvd7nsj180KWuvH1fk7c";

var SHEET_NAME = "Feedback";

/** Row that contains #, Date, Full Name, … (the table header row). */
var HEADER_ROW = 4;

/** Must match “Request Urgency” data validation options on the sheet (edit if your list differs). */
var URGENCY_FOR_1_STAR = "Nice to have";
var URGENCY_FOR_2_STARS = "Should have";
var URGENCY_FOR_5_STARS = "Must have";

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
    var urgencyLabel = n === 5 ? URGENCY_FOR_5_STARS : n === 2 ? URGENCY_FOR_2_STARS : URGENCY_FOR_1_STAR;

    var dataStart = HEADER_ROW + 1;
    var lastRow = sheet.getLastRow();
    var nextRow = Math.max(lastRow + 1, dataStart);
    var serial = nextSerialInColumnB(sheet, dataStart, lastRow);

    var colLParts = [];
    if (f.userEmail) {
      colLParts.push("Submitted by (email): " + String(f.userEmail));
    }
    if (f.details) {
      colLParts.push(String(f.details));
    }
    var colL = colLParts.join("\n\n");

    // Columns B–L (11 cells): #, Date, Full Name, Tab, Description, Request Urgency, Dashboard Rating, spacer, Status, BI Response, Additional
    var row = [
      serial,
      f.dateDisplay || "",
      f.fullName || "",
      f.tabWidget || "",
      f.summary || "",
      urgencyLabel,
      "",
      "",
      "Backlog",
      "",
      colL,
    ];

    sheet.getRange(nextRow, 2, nextRow, 12).setValues([row]);
    return jsonOut({ ok: true, row: nextRow, colStart: 2 });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** Next # in column B (integer), based on existing numeric values in the data block. */
function nextSerialInColumnB(sheet, dataStartRow, lastRow) {
  if (lastRow < dataStartRow) {
    return 1;
  }
  var vals = sheet.getRange(dataStartRow, 2, lastRow, 2).getValues();
  var max = 0;
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i][0];
    var num = parseInt(v, 10);
    if (!isNaN(num) && num > max) {
      max = num;
    }
  }
  return max + 1;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
