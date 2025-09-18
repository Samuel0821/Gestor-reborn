// ---------- DEPENDENCIAS PRINCIPALES ----------
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("fs");
const db = require("./database");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// ---------- CREAR VENTANA PRINCIPAL ----------
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Siempre iniciar en login.html
  mainWindow.loadFile(path.join(__dirname, "views", "login.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // Limpiar estado de login al cerrar la app
  try {
    const { session } = require('electron');
    session.defaultSession.webRequest.onCompleted({ urls: ['*://*/*'] }, () => {
      mainWindow.webContents.executeJavaScript('localStorage.removeItem("logueado");');
    });
  } catch (e) {}
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------- HELPERS ----------
function formatCOP(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(Math.round(num));
}

function renderPdfHeader(doc, company = {}, title = "") {
  const headerTop = 40;
  if (company.logo_path && fs.existsSync(company.logo_path)) {
    try {
      doc.image(company.logo_path, 40, headerTop, { width: 80 });
    } catch (e) {
      // ignore image errors
    }
  }

  doc.fontSize(16).font("Helvetica-Bold").text(company.company_name || "", 140, headerTop, { align: "left" });
  doc.fontSize(10).font("Helvetica").text(`NIT: ${company.company_id_card_or_nit || ""}`, 140, headerTop + 20);
  doc.text(company.company_address || "", 140, headerTop + 35);
  doc.text(`${company.company_email || ""} - Tel: ${company.company_phone || ""}`, 140, headerTop + 50);

  const afterHeaderY = headerTop + 80;
  doc.moveTo(40, afterHeaderY).lineTo(555, afterHeaderY).stroke();
  doc.y = afterHeaderY + 10;
  doc.fontSize(14).font("Helvetica-Bold").text(title, { align: "center" });
  doc.moveDown();
}

// ---------- IPC: COMPANY ----------
ipcMain.handle("get-low-stock-products", async () => {
  try {
  const products = db.getProducts();
  const lowStock = products.filter(p => p.min_stock >= 0 && p.stock <= p.min_stock);
  return lowStock;
  } catch (err) {
    return [];
  }
});
ipcMain.handle("get-company-settings", async () => db.getCompanySettings());
ipcMain.handle("save-company-settings", async (event, data) => {
  const result = db.saveCompanySettings(data);
  if (result && result.success) {
    const updated = db.getCompanySettings();
    return { success: true, message: result.message, company: updated };
  }
  return result;
});

// ---------- IPC: EXPORT INVOICE (PDF) ----------
ipcMain.handle("export-invoice-pdf", async (event, { id, includeIva = false } = {}) => {
  try {
    const sale = db.getSaleById(id);
    if (!sale) return { success: false, message: "Venta no encontrada" };
    const items = db.getSaleItems(id) || [];
    const company = db.getCompanySettings() || {};
    const client = sale.client_id ? db.getClientById(sale.client_id) : null;

    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `Factura-${sale.invoice_number || String(id).padStart(3, "0")}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return { success: false, message: "Exportación cancelada" };

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    renderPdfHeader(doc, company, `Factura ${sale.invoice_number || String(id).padStart(3, "0")}`);

    // Cliente
    if (client) {
      doc.fontSize(11).font("Helvetica-Bold").text("Cliente:", 40, doc.y + 10);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Nombre: ${client.name || ""}`);
      doc.text(`NIT/Cédula: ${client.id_card_or_nit || ""}`);
      doc.text(`Dirección: ${client.address || ""}`);
      doc.text(`Email: ${client.email || ""}`);
      doc.text(`Teléfono: ${client.phone || ""}`);
      doc.moveDown(1);
    }

    // Tabla
    let y = doc.y + 10;
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("#", 40, y, { width: 20 });
    doc.text("Código", 60, y, { width: 60 });
    doc.text("Nombre", 120, y, { width: 180 });
    doc.text("Precio", 320, y, { width: 70, align: "right" });
    doc.text("Cant.", 400, y, { width: 50, align: "right" });
    doc.text("Subtotal", 460, y, { width: 80, align: "right" });
    y += 18;
    doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

    doc.font("Helvetica").fontSize(10);
    let idx = 1;
    for (const it of items) {
      doc.text(String(idx), 40, y, { width: 20 });
      doc.text(it.product_code || "-", 60, y, { width: 60 });
      doc.text(it.product_name || "-", 120, y, { width: 180 });
      doc.text(formatCOP(it.price), 320, y, { width: 70, align: "right" });
      doc.text(String(it.quantity), 400, y, { width: 50, align: "right" });
      doc.text(formatCOP(it.subtotal), 460, y, { width: 80, align: "right" });
      y += 18;
      idx++;
      if (y > 700) { doc.addPage(); y = 40; }
    }

    // Totales
    const subtotal = items.reduce((acc, it) => acc + (Number(it.subtotal) || Number(it.price) * Number(it.quantity) || 0), 0);
    const iva = includeIva ? Math.round(subtotal * 0.19) : 0;
    const total = subtotal + iva;

    doc.moveDown(1);
    if (includeIva) {
      doc.fontSize(10).text(`Subtotal: ${formatCOP(subtotal)}`, 400, y + 6);
      doc.text(`IVA (19%): ${formatCOP(iva)}`, 400, y + 22);
      doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 42);
    } else {
      doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 10);
    }

    doc.end();

    await new Promise((res, rej) => {
      stream.on("finish", res);
      stream.on("error", rej);
    });

    return { success: true, message: "Factura exportada en PDF correctamente", filePath };
  } catch (err) {
    let msg = "Error al exportar factura PDF: ";
    if (err && (err.code === "EBUSY" || err.code === "ELOCKED")) {
      msg += "El archivo está abierto o bloqueado. Por favor ciérralo antes de exportar.";
    } else {
      msg += err && err.message ? err.message : String(err);
    }
    return { success: false, message: msg };
  }
});

// ---------- IPC: QUOTES ----------
ipcMain.handle("delete-quote", async (event, id) => {
  try {
    const res = db.deleteQuote(id);
    return res;
  } catch (err) {
    return { success: false, message: String(err) };
  }
});
ipcMain.handle("approve-quote", async (event, quoteId) => {
  try {
    const quote = db.getQuoteById(quoteId);
    if (!quote) return { success: false, message: "Cotización no encontrada" };
    const items = db.getQuoteItems(quoteId);
    if (!items.length) return { success: false, message: "La cotización no tiene productos" };
    // Crear venta
    const saleData = {
      client_id: quote.client_id,
      items: items.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        product_code: it.product_code,
        quantity: it.quantity,
        price: it.price,
        subtotal: it.subtotal
      }))
    };
    const saleRes = db.createSale(saleData);
    if (!saleRes.success) return { success: false, message: saleRes.message };
    return { success: true, message: "Cotización aprobada y convertida en venta. Ya puedes generar la factura.", saleId: saleRes.id };
  } catch (err) {
    return { success: false, message: String(err) };
  }
});
ipcMain.handle("get-quotes", async () => db.getQuotes());
ipcMain.handle("create-quote", async (event, quoteData) => db.createQuote(quoteData));

ipcMain.handle("export-quote-pdf", async (event, { id, includeIva = false } = {}) => {
  try {
    let quote = null;
    let quoteId = id;
    if (typeof id !== "undefined" && id !== null) {
      quote = db.getQuoteById(id);
    } else if (typeof quote_number !== "undefined" && quote_number !== null) {
      quote = db.getQuotes().find(q => q.quote_number === quote_number);
      if (quote) quoteId = quote.id;
    } else {
      return { success: false, message: "Error: Debes enviar el id o el quote_number de la cotización." };
    }
    if (!quote) return { success: false, message: "Cotización no encontrada" };
    const items = db.getQuoteItems(quoteId) || [];
    const company = db.getCompanySettings() || {};
    const client = quote.client_id ? db.getClientById(quote.client_id) : null;

    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `Cotizacion-${quote.quote_number || String(id).padStart(3, "0")}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return { success: false, message: "Exportación cancelada" };

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    renderPdfHeader(doc, company, `Cotización ${quote.quote_number || String(id).padStart(3, "0")}`);

    // Cliente
    if (client) {
      doc.fontSize(11).font("Helvetica-Bold").text("Cliente:", 40, doc.y + 10);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Nombre: ${client.name || ""}`);
      doc.text(`NIT/Cédula: ${client.id_card_or_nit || ""}`);
      doc.text(`Dirección: ${client.address || ""}`);
      doc.text(`Email: ${client.email || ""}`);
      doc.text(`Teléfono: ${client.phone || ""}`);
      doc.moveDown(1);
    }

    // Tabla
    let y = doc.y + 10;
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("#", 40, y, { width: 20 });
    doc.text("Código", 60, y, { width: 60 });
    doc.text("Nombre", 120, y, { width: 180 });
    doc.text("Precio", 320, y, { width: 70, align: "right" });
    doc.text("Cant.", 400, y, { width: 50, align: "right" });
    doc.text("Subtotal", 460, y, { width: 80, align: "right" });
    y += 18;
    doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

    doc.font("Helvetica").fontSize(10);
    let idx = 1;
    for (const it of items) {
      doc.text(String(idx), 40, y, { width: 20 });
      doc.text(it.product_code || "-", 60, y, { width: 60 });
      doc.text(it.product_name || "-", 120, y, { width: 180 });
      doc.text(formatCOP(it.price), 320, y, { width: 70, align: "right" });
      doc.text(String(it.quantity), 400, y, { width: 50, align: "right" });
      doc.text(formatCOP(it.subtotal), 460, y, { width: 80, align: "right" });
      y += 18;
      idx++;
      if (y > 700) { doc.addPage(); y = 40; }
    }

    const subtotal = items.reduce((acc, it) => acc + (Number(it.subtotal) || Number(it.price) * Number(it.quantity) || 0), 0);
    const iva = includeIva ? Math.round(subtotal * 0.19) : 0;
    const total = subtotal + iva;

    doc.moveDown(1);
    if (includeIva) {
      doc.fontSize(10).text(`Subtotal: ${formatCOP(subtotal)}`, 400, y + 6);
      doc.text(`IVA (19%): ${formatCOP(iva)}`, 400, y + 22);
      doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 42);
    } else {
      doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 10);
    }

    doc.end();
    await new Promise((res, rej) => {
      stream.on("finish", res);
      stream.on("error", rej);
    });

    return { success: true, message: "Cotización exportada en PDF correctamente", filePath };
  } catch (err) {
    let msg = "Error al exportar cotización PDF: ";
    if (err && (err.code === "EBUSY" || err.code === "ELOCKED")) {
      msg += "El archivo está abierto o bloqueado. Por favor ciérralo antes de exportar.";
    } else {
      msg += err && err.message ? err.message : String(err);
    }
    return { success: false, message: msg };
  }
});

// ---------- IPC: INVENTARIO (PDF / EXCEL) ----------
ipcMain.handle("export-inventory-pdf", async () => {
  try {
    const products = db.getProducts() || [];
    const company = db.getCompanySettings() || {};

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Guardar reporte PDF",
      defaultPath: "inventario.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return { success: false, message: "No se seleccionó archivo" };

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    renderPdfHeader(doc, company, "Reporte de Inventario");

    let y = doc.y + 10;
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("Código", 40, y, { width: 60 });
    doc.text("Nombre", 110, y, { width: 140 });
    doc.text("Categoría", 260, y, { width: 80 });
    doc.text("Costo", 350, y, { width: 60, align: "right" });
    doc.text("Venta", 420, y, { width: 60, align: "right" });
    doc.text("Stock", 490, y, { width: 40, align: "right" });
    y += 18;
    doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

    doc.font("Helvetica").fontSize(10);
    for (const p of products) {
      doc.text(p.code || "", 40, y, { width: 60 });
      doc.text(p.name || "", 110, y, { width: 140 });
      doc.text(p.category || "", 260, y, { width: 80 });
      doc.text(formatCOP(p.purchase_price || 0), 350, y, { width: 60, align: "right" });
      doc.text(formatCOP(p.sale_price || 0), 420, y, { width: 60, align: "right" });
      doc.text(String(p.stock || 0), 490, y, { width: 40, align: "right" });
      y += 16;
      if (y > 700) { doc.addPage(); y = 40; }
    }

    doc.end();
    await new Promise((res, rej) => {
      stream.on("finish", res);
      stream.on("error", rej);
    });

    return { success: true, filePath };
  } catch (err) {
    return { success: false, message: "Error al exportar inventario: " + (err.message || String(err)) };
  }
});

ipcMain.handle("export-inventory-excel", async () => {
  try {
    const products = db.getProducts() || [];

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Guardar reporte Excel",
      defaultPath: "inventario.xlsx",
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });
    if (canceled || !filePath) return { success: false, message: "No se seleccionó archivo" };

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventario");
    worksheet.columns = [
      { header: "Código", key: "code", width: 15 },
      { header: "Nombre", key: "name", width: 30 },
      { header: "Categoría", key: "category", width: 20 },
      { header: "Precio costo", key: "purchase_price", width: 15 },
      { header: "Precio venta", key: "sale_price", width: 15 },
      { header: "Stock", key: "stock", width: 10 },
    ];

    products.forEach(p => {
      worksheet.addRow({
        code: p.code || "",
        name: p.name || "",
        category: p.category || "",
        purchase_price: p.purchase_price || 0,
        sale_price: p.sale_price || 0,
        stock: p.stock || 0,
      });
    });

    await workbook.xlsx.writeFile(filePath);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, message: "Error al exportar inventario Excel: " + (err.message || String(err)) };
  }
});

// ---------- IPC: VENTAS / CLIENTES / PRODUCTOS / DASHBOARD ----------
ipcMain.handle("get-sales", async () => db.getSales());
ipcMain.handle("create-sale", async (event, saleData) => db.createSale(saleData));
ipcMain.handle("delete-sale", async (event, id) => db.deleteSale(id));

ipcMain.handle("get-clients", async () => db.getClients());
ipcMain.handle("get-client-by-id", async (event, id) => db.getClientById(id));
ipcMain.handle("save-client", async (event, client) => db.saveClient(client));
ipcMain.handle("update-client", async (event, client) => db.updateClient(client));
ipcMain.handle("delete-client", async (event, id) => db.deleteClient(id));

ipcMain.handle("add-product", async (event, product) => db.addProduct(product));
ipcMain.handle("get-products", async () => db.getProducts());
ipcMain.handle("get-product-by-id", async (event, id) => db.getProductById(id));
ipcMain.handle("update-product", async (event, product) => db.updateProduct(product));
ipcMain.handle("delete-product", async (event, id) => db.deleteProduct(id));

ipcMain.handle("get-dashboard-data", async () => db.getDashboardData());

// ---------- IPC: REPORTE DE VENTAS ----------
ipcMain.handle("get-sales-report", async (event, { startDate, endDate } = {}) => {
  try {
    if (typeof db.getSalesReport === "function") {
      return db.getSalesReport(startDate, endDate);
    } else {
      // fallback: construir manualmente
      const sales = (db.getSales() || []).filter(s => {
        if (!startDate || !endDate) return true;
        return s.sale_date >= startDate && s.sale_date <= endDate;
      });
      for (const s of sales) {
        s.items = db.getSaleItems(s.id) || [];
      }
      const totalGeneral = sales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
      return { sales, totalGeneral };
    }
  } catch (err) {
    return { sales: [], totalGeneral: 0, error: String(err) };
  }
});
