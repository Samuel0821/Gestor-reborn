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

  app.whenReady().then(() => {
      createWindow();
      registerIpcHandlers();
  });

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

  // ---------- REGISTRAR MANEJADORES IPC ----------
  function registerIpcHandlers() {
      // Clientes
      ipcMain.handle("get-clients", () => db.getClients());
      ipcMain.handle("get-client-by-id", (event, id) => db.getClientById(id));
      ipcMain.handle("save-client", (event, data) => db.saveClient(data));
      ipcMain.handle("update-client", (event, data) => db.updateClient(data));
      ipcMain.handle("delete-client", (event, id) => db.deleteClient(id));

      // Productos
      ipcMain.handle("get-products", () => db.getProducts());
      ipcMain.handle("get-product-by-id", (event, id) => db.getProductById(id));
      ipcMain.handle("add-product", (event, data) => db.addProduct(data));
      ipcMain.handle("update-product", (event, data) => db.updateProduct(data));
      ipcMain.handle("delete-product", (event, id) => db.deleteProduct(id));
      ipcMain.handle("get-categories", () => db.getCategories());
      ipcMain.handle("add-category", (event, name) => db.addCategory(name));
      ipcMain.handle("update-category", (event, id, name) => db.updateCategory(id, name));
      ipcMain.handle("delete-category", (event, id) => db.deleteCategory(id));

      // Ventas
      ipcMain.handle("create-sale", (event, data) => db.createSale(data));
      ipcMain.handle("get-sales", () => db.getSales());
      ipcMain.handle("get-sale-by-id", (event, id) => db.getSaleById(id));
      ipcMain.handle("get-sale-items", (event, id) => db.getSaleItems(id));
      ipcMain.handle("delete-sale", (event, id) => db.deleteSale(id));
      ipcMain.handle("delete-sale-item", (event, id) => db.deleteSaleItem(id));
      ipcMain.handle("get-last-invoice-number", () => db.getLastInvoiceNumber());
      ipcMain.handle("set-invoice-number", (event, { id, invoiceNumber }) => db.setInvoiceNumber(id, invoiceNumber));
      
      // Gestión de Créditos
      ipcMain.handle("get-credits", async (event, searchTerm) => db.getCredits(searchTerm));
      ipcMain.handle("add-credit-payment", async (event, saleId, amount) => db.addCreditPayment(saleId, amount));
      ipcMain.handle("mark-credit-as-paid", async (event, saleId) => db.markCreditAsPaid(saleId));

      // Cotizaciones
      ipcMain.handle("create-quote", (event, data) => db.createQuote(data));
      ipcMain.handle("get-quotes", () => db.getQuotes());
      ipcMain.handle("get-quote-by-id", (event, id) => db.getQuoteById(id));
      ipcMain.handle("get-quote-items", (event, id) => db.getQuoteItems(id));
      ipcMain.handle("delete-quote", (event, id) => db.deleteQuote(id));
      ipcMain.handle("get-last-quote-number", () => db.getLastQuoteNumber());
      ipcMain.handle("set-quote-number", (event, { id, quoteNumber }) => db.setQuoteNumber(id, quoteNumber));

      // --- Aprobar cotización y convertir en venta ---
      ipcMain.handle("approve-quote", async (event, quoteId) => {
        try {
          // 1. Obtener la cotización
          const quote = db.getQuoteById(quoteId);
          if (!quote) return { success: false, message: "Cotización no encontrada" };

          // 2. Obtener los ítems de la cotización
          const items = db.getQuoteItems(quoteId) || [];
          if (items.length === 0) return { success: false, message: "La cotización no tiene ítems" };

          // 3. Crear venta a partir de la cotización
          const saleData = {
            client_id: quote.client_id || null,
            items: items.map(it => ({
              product_id: it.product_id,
              product_name: it.product_name,
              product_code: it.product_code,
              quantity: it.quantity,
              price: it.price,
              subtotal: it.subtotal,
            })),
          };
          const sale = db.createSale(saleData);

          // 4. Marcar cotización como aprobada
          db.updateQuote({ id: quoteId, status: "approved" });

          return { success: true, message: "Cotización aprobada y convertida en venta correctamente", saleId: sale.id };
        } catch (err) {
          console.error("Error approving quote:", err);
          return { success: false, message: err.message || "Error al aprobar la cotización" };
        }
      });
      
      // Configuración y Dashboard
      ipcMain.handle("get-company-settings", () => db.getCompanySettings());
      ipcMain.handle("update-company-settings", (event, settings) => db.updateCompanySettings(settings));
      ipcMain.handle("get-dashboard-data", () => db.getDashboardData());
      ipcMain.handle("reset-database", () => db.resetDatabase());
      ipcMain.handle("select-file", async (event, options) => {
          const result = await dialog.showOpenDialog(options);
          return result.canceled ? null : result.filePaths[0];
      });

      // Reportes e Inventario
        ipcMain.handle("get-sales-report", (event, params) => db.getSalesReport(params));
        ipcMain.handle("get-inventory", () => db.getInventory());
        ipcMain.handle("get-low-stock-products", async () => {
            try {
                const products = db.getProducts();
                const lowStock = products.filter(p => p.min_stock >= 0 && p.stock <= p.min_stock);
                return lowStock;
            } catch (err) {
                return [];
            }
        });

        // ---------- Exportar reporte de ventas a PDF ----------
        ipcMain.handle("export-sales-report-pdf", async (event, { salesReport, companyInfo, filename }) => {
            try {
                const salesArray = Array.isArray(salesReport) ? salesReport : [];
                if (!salesArray.length) {
                    return { success: false, message: "No hay datos para exportar." };
                }

                const { filePath, canceled } = await dialog.showSaveDialog({
                    defaultPath: filename || "reporte_ventas.pdf",
                    filters: [{ name: "PDF", extensions: ["pdf"] }],
                });
                if (canceled || !filePath) return { success: false, message: "Exportación cancelada." };

                const doc = new PDFDocument({ margin: 40, size: "A4" });
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);

                // Encabezado del PDF
                renderPdfHeader(doc, companyInfo, "Reporte de Venta");

                let y = doc.y + 10;
                const startY = y; 

                // Títulos de las columnas de la tabla
                doc.fontSize(10).font("Helvetica-Bold");
                doc.text("# Factura", 40, y, { width: 60 });
                doc.text("Fecha", 100, y, { width: 80 });
                doc.text("Nombre Producto", 190, y, { width: 150 });
                doc.text("Cantidad", 340, y, { width: 50, align: "right" });
                doc.text("Valor Unidad", 400, y, { width: 70, align: "right" });
                doc.text("Subtotal", 490, y, { width: 60, align: "right" });
                y += 18;
                
                // Línea divisoria debajo de los títulos
                doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();
                doc.font("Helvetica").fontSize(9);
                y += 10;

                // Escribir los datos de las ventas (cada ítem como una fila)
                for (const sale of salesArray) {
                    const invoiceNumber = sale.invoice_number || "-";
                    const saleDate = sale.sale_date ? sale.sale_date.split(' ')[0] : "-";
                    
                    for (const item of sale.items) {
                        // Verificar salto de página antes de cada fila de ítem
                        if (y > doc.page.height - doc.page.margins.bottom - 40) {
                            doc.addPage();
                            y = startY;
                            doc.fontSize(10).font("Helvetica-Bold");
                            doc.text("# Factura", 40, y, { width: 60 });
                            doc.text("Fecha", 100, y, { width: 80 });
                            doc.text("Nombre Producto", 190, y, { width: 150 });
                            doc.text("Cantidad", 340, y, { width: 50, align: "right" });
                            doc.text("Valor Unidad", 400, y, { width: 70, align: "right" });
                            doc.text("Subtotal", 490, y, { width: 60, align: "right" });
                            y += 18;
                            doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();
                            doc.font("Helvetica").fontSize(9);
                            y += 10;
                        }

                        doc.text(invoiceNumber, 40, y, { width: 60 });
                        doc.text(saleDate, 100, y, { width: 80 });
                        doc.text(item.product_name, 190, y, { width: 150 });
                        doc.text(String(item.quantity), 340, y, { width: 50, align: "right" });
                        // Aquí se ha corregido para mostrar el precio unitario correctamente
                        doc.text(formatCOP(item.price), 400, y, { width: 70, align: "right" });
                        doc.text(formatCOP(item.subtotal), 490, y, { width: 60, align: "right" });
                        y += 15;
                    }
                    y += 5;
                }

                // Separar el Total General en una nueva línea y alinearlo a la derecha
                doc.moveDown(1);
                doc.font("Helvetica-Bold").fontSize(12);
                const totalGeneral = salesArray.reduce((acc, s) => acc + (s.total_amount || 0), 0);
                doc.text("Total General:", 380, doc.y, { align: "right" });
                doc.text(formatCOP(totalGeneral), 490, doc.y, { width: 60, align: "right" });

                doc.end();
                await new Promise((res, rej) => {
                    stream.on("finish", res);
                    stream.on("error", rej);
                });

                return { success: true, filePath };
            } catch (err) {
                console.error("Error exportando PDF:", err);
                return { success: false, message: "Error al exportar PDF: " + (err.message || String(err)) };
            }
        });

  // ---------------- IMPRESIÓN ----------------
  // Vista previa de factura
            ipcMain.handle("preview-invoice", async (event, { content }) => {
              const previewWin = new BrowserWindow({
                width: 800,
                height: 600,
                webPreferences: {
                  preload: path.join(__dirname, "preload.js"),
                  contextIsolation: true,
                  nodeIntegration: false,
                },
              });

              await previewWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(content));
            });

            // Obtener lista de impresoras
            ipcMain.handle("get-printers", async () => {
              try {
                const win = BrowserWindow.getAllWindows()[0];
                if (!win) return [];
                const printers = await win.webContents.getPrintersAsync();
                return printers.map((p) => ({
                  name: p.name,
                  isDefault: p.isDefault,
                }));
              } catch (err) {
                console.error("Error al obtener impresoras:", err);
                return [];
              }
            });

            // --- Obtener logo de la empresa en base64 ---
            ipcMain.handle("get-company-logo", async () => {
              try {
                const settings = db.getCompanySettings() || {};
                if (settings.logo_path && fs.existsSync(settings.logo_path)) {
                  const imageBuffer = fs.readFileSync(settings.logo_path);
                  const ext = path.extname(settings.logo_path).substring(1); // ejemplo: png, jpg
                  return `data:image/${ext};base64,${imageBuffer.toString("base64")}`;
                }
                return null;
              } catch (err) {
                console.error("Error al cargar logo:", err);
                return null;
              }
            });

            // Imprimir factura
            ipcMain.handle("print-invoice", async (event, { printer, paperSize, htmlContent }) => {
                try {
                  const printWin = new BrowserWindow({ show: false });
                  await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent));

                  const options = {
                    silent: false, // 👈 ponlo en true si quieres que imprima directo sin diálogo
                    printBackground: true,
                    deviceName: printer || undefined,
                  };

                  // Definir tamaño
                  if (paperSize === "80mm") {
                    options.pageSize = { width: 80000, height: 300000 };
                  } else if (paperSize === "58mm") {
                    options.pageSize = { width: 58000, height: 300000 };
                  } else if (paperSize === "A4") {
                    options.pageSize = "A4";
                  } else if (paperSize === "Letter") {
                    options.pageSize = "Letter";
                  } else if (paperSize === "Legal") {
                    options.pageSize = "Legal";
                  }

                  return new Promise((resolve) => {
                    printWin.webContents.print(options, (success, failureReason) => {
                      printWin.close();
                      if (!success) {
                        console.error("Falló la impresión:", failureReason);
                        resolve({ success: false, message: failureReason });
                      } else {
                        resolve({ success: true, message: "Factura enviada a la impresora." });
                      }
                    });
                  });
                } catch (err) {
                  console.error("Error al imprimir:", err);
                  return { success: false, message: err.message };
                }
              });


      // Exportación de PDF
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
  }