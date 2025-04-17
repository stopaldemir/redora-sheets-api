const express    = require('express');
const ExcelJS    = require('exceljs');
const { generateStructuredJSON } = require('../services/gpt');
const fs         = require('fs');
const path       = require('path');
const { nanoid } = require('nanoid');

const router     = express.Router();
const OUTPUT_DIR = path.resolve(__dirname, '../../output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

router.post('/', async (req, res) => {
  const { prompt } = req.body;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Eksik veya geçersiz parametre: prompt' });
  }

  try {
    const payload = await generateStructuredJSON(prompt);
    if (!Array.isArray(payload.sheets) || !payload.sheets.length) {
      throw new Error('Geçerli sheet tanımı bulunamadı');
    }

    const workbook = new ExcelJS.Workbook();

    payload.sheets.forEach(sheetDef => {
      const name       = sheetDef.name || `Sheet-${nanoid(4)}`;
      const sheet      = workbook.addWorksheet(name);
      const headers    = Array.isArray(sheetDef.headers) ? sheetDef.headers : [];
      const rows       = Array.isArray(sheetDef.rows) ? sheetDef.rows : [];
      const style      = sheetDef.headerStyle || {};
      const colWidths  = sheetDef.columnWidths || [];

      const headerRow = sheet.addRow(headers);
      headerRow.eachCell(cell => {
        if (style.bold)                  cell.font = { ...(cell.font || {}), bold: true };
        if (style.fontColor)             cell.font = { ...(cell.font || {}), color: { argb: style.fontColor } };
        if (style.fillColor)             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fillColor } };
        if (style.border)                cell.border = style.border;
        if (style.alignment)             cell.alignment = style.alignment;
      });
      rows.forEach(row => {
        const formatted = row.map(val => {
          if (typeof val === 'string' && val.startsWith('=')) {
            return { formula: val.slice(1) };
          }
          return val;
        });
        sheet.addRow(formatted);
      });

      if (colWidths.length) {
        sheet.columns.forEach((col, idx) => {
          col.width = colWidths[idx] || col.width;
        });
      }
    });

    const fileName = `sheet-${Date.now()}-${nanoid(6)}.xlsx`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath, fileName, err => {
      if (err) console.error('Download error:', err);
      setTimeout(() => {
        fs.unlink(filePath, unlinkErr => {
          if (unlinkErr) console.error('Cleanup error:', unlinkErr);
        });
      }, 15000);
    });

  } catch (error) {
    console.error('🚨 Route /api/generate hata:', error);
    res.status(500).json({
      error:   'Oluşturma sırasında hata oluştu',
      details: error.message
    });
  }
});

module.exports = router;
