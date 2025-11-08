  // ---------- DEPENDENCIAS PRINCIPALES ----------
  const { app, BrowserWindow, ipcMain, dialog } = require("electron");
  const path = require("node:path");
  const fs = require("fs");
  const db = require("./database");
  const PDFDocument = require("pdfkit");
  const ExcelJS = require("exceljs");
  const cashRegister = require("./cashRegister");

  // Deshabilitar la caché de disco para prevenir errores de "Acceso denegado"
  app.commandLine.appendSwitch('disable-http-cache');

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

      // Proveedores
      ipcMain.handle("get-suppliers", () => db.getSuppliers());
      ipcMain.handle("get-supplier-by-id", (event, id) => db.getSupplierById(id));
      ipcMain.handle("save-supplier", (event, data) => db.saveSupplier(data));
      ipcMain.handle("update-supplier", (event, data) => db.updateSupplier(data));
      ipcMain.handle("delete-supplier", (event, id) => db.deleteSupplier(id));

      ipcMain.handle("get-suppliers-count", () => db.getSuppliersCount());

      // Ventas
      ipcMain.handle("create-sale", (event, data) => db.createSale(data));
      ipcMain.handle("get-sales", () => db.getSales());
      ipcMain.handle("get-sale-by-id", (event, id) => db.getSaleById(id));
      ipcMain.handle("get-sale-items", (event, id) => db.getSaleItems(id));
      ipcMain.handle("delete-sale", (event, id) => db.deleteSale(id));
      ipcMain.handle("delete-sale-item", (event, id) => db.deleteSaleItem(id));
      ipcMain.handle("get-last-invoice-number", () => db.getLastInvoiceNumber());
      ipcMain.handle("set-invoice-number", (event, { id, invoiceNumber }) => db.setInvoiceNumber(id, invoiceNumber));

      // Caja registradora
      ipcMain.handle("open-cash-register", (event, openingBalance) => {
        return cashRegister.openCashRegister(openingBalance);
        });

      ipcMain.handle("get-active-cash-session", () => {
        return cashRegister.getActiveSession();
        });

      ipcMain.handle("add-cash-movement", (event, { sessionId, type, amount, description }) => {
        return cashRegister.addCashMovement(sessionId, type, amount, description);
        });

      ipcMain.handle("close-cash-register", (event, realClosingBalance) => {
          return cashRegister.closeCashRegister(realClosingBalance);
        });

      ipcMain.handle("get-cash-register-sessions", () => {
        return cashRegister.getCashRegisterSessions();
        });

      ipcMain.handle("get-cash-movements", (event, sessionId) => {
          return cashRegister.getCashMovements(sessionId);
        });
      
      // Gestión de Créditos
      ipcMain.handle("get-credits", async (event, searchTerm) => db.getCredits(searchTerm));
      ipcMain.handle("add-credit-payment", async (event, saleId, amount) => db.addCreditPayment(saleId, amount));
      ipcMain.handle("mark-credit-as-paid", async (event, saleId) => db.markCreditAsPaid(saleId));

      // Ordenes de Compra
      ipcMain.handle("create-purchase-order", (event, data) => db.createPurchaseOrder(data));
      ipcMain.handle("get-purchase-orders", () => db.getPurchaseOrders());
      ipcMain.handle("get-purchase-order-by-id", (event, id) => db.getPurchaseOrderById(id));
      ipcMain.handle("update-purchase-order", (event, data) => db.updatePurchaseOrder(data));
      ipcMain.handle("delete-purchase-order", (event, id) => db.deletePurchaseOrder(id));
      ipcMain.handle("export-purchase-order-pdf", (event, id) => exportPurchaseOrderPDF(id));
      ipcMain.handle("get-purchase-orders-count", () => db.getPurchaseOrders().length);
      ipcMain.handle("receive-purchase-order", (event, id) => db.receivePurchaseOrder(id));

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
        
        ipcMain.handle("get-inventory", async () => {
                try {
                    const products = db.getProducts();
                    const totalInventoryValue = products.reduce((acc, p) => acc + (Number(p.stock) * Number(p.sale_price)), 0);
                    return { products, totalInventoryValue };
                } catch (err) {
                    console.error("Error al obtener el inventario:", err);
                    return { products: [], totalInventoryValue: 0 };
                }
            });

        ipcMain.handle("get-low-stock-products", async () => {
            try {
                const products = db.getProducts();
                const lowStock = products.filter(p => p.min_stock >= 0 && p.stock <= p.min_stock);
                return lowStock;
            } catch (err) {
                return [];
            }
        });

        // ---------- Exportar productos con bajo stock a PDF ----------
        ipcMain.handle("export-low-stock-pdf", async () => {
          try {
            const company = db.getCompanySettings() || {};
            const products = db.getProducts();
            const lowStockProducts = products.filter(p => p.min_stock >= 0 && p.stock <= p.min_stock);

            if (lowStockProducts.length === 0) {
              return { success: false, message: "No hay productos con stock bajo para exportar." };
            }

            const { filePath, canceled } = await dialog.showSaveDialog({
              title: "Guardar Reporte de Stock Mínimo",
              defaultPath: "reporte_stock_minimo.pdf",
              filters: [{ name: "PDF", extensions: ["pdf"] }],
            });

            if (canceled || !filePath) return { success: false, message: "Exportación cancelada." };

            const doc = new PDFDocument({ margin: 40, size: "A4" });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            renderPdfHeader(doc, company, "Reporte de Productos con Stock Mínimo");

            const tableTop = doc.y + 10;
            const tableLeft = 40;
            const tableWidth = 515;

            doc.y = tableTop;
            doc.fontSize(11).font("Helvetica-Bold");
            doc.text("Código", 40, doc.y, { width: 80 });
            doc.text("Nombre", 120, doc.y, { width: 250 });
            doc.text("Stock Actual", 370, doc.y, { width: 80, align: "right" });
            doc.text("Stock Mínimo", 450, doc.y, { width: 80, align: "right" });
            doc.moveDown(0.5);
            const headerY = doc.y;
            doc.moveTo(tableLeft, headerY).lineTo(tableLeft + tableWidth, headerY).stroke();

            doc.font("Helvetica").fontSize(10);
            let y = doc.y + 5;

            for (const p of lowStockProducts) {
                const rowHeight = doc.heightOfString(p.name || "", { width: 250 }) + 8;
                if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                    y = doc.page.margins.top;
                }
                doc.text(p.code || "", 40, y, { width: 80 });
                doc.text(p.name || "", 120, y, { width: 250 });
                doc.text(String(p.stock || 0), 370, y, { width: 80, align: "right" });
                doc.text(String(p.min_stock || 0), 450, y, { width: 80, align: "right" });
                y += rowHeight;
            }

            doc.end();
            await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); });

            return { success: true, filePath };
          } catch (err) {
            console.error("Error al exportar PDF de bajo stock:", err);
            return { success: false, message: "Error al exportar PDF: " + (err.message || String(err)) };
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

              renderPdfHeader(doc, companyInfo, "Reporte de Ventas");

              let y = doc.y + 10;
              const startY = y;

              // Títulos de las columnas (EN NEGRITA)
              doc.fontSize(11).font("Helvetica-Bold");
              doc.text("Fecha", 40, y, { width: 60 });
              doc.text("# Factura", 100, y, { width: 80 });
              doc.text("Nombre Producto", 180, y, { width: 170 });
              doc.text("Cantidad", 350, y, { width: 50, align: "right" });
              doc.text("Valor Unidad", 400, y, { width: 70, align: "right" });
              doc.text("Subtotal", 490, y, { width: 60, align: "right" });
              y += 18;

              // Línea divisoria debajo de los títulos
              doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();
              doc.font("Helvetica").fontSize(9);
              y += 10;

              // Totales acumulados para resumen final
              let totalGeneral = 0;
              let totalCash = 0;
              let totalTransfer = 0;
              let totalCredit = 0;

              // Escribir los datos de las ventas
              for (const sale of salesArray) {
                const invoiceNumber = sale.invoice_number || "-";
                const saleDate = sale.sale_date ? sale.sale_date.split(" ")[0] : "-";
                const saleTotal = sale.total_amount || 0;

                for (const item of sale.items) {
                  // Verificar salto de página
                  if (y > doc.page.height - doc.page.margins.bottom - 80) {
                    doc.addPage();
                    y = startY;
                    doc.fontSize(10).font("Helvetica-Bold");
                    doc.text("Fecha", 40, y, { width: 60 });
                    doc.text("# Factura", 100, y, { width: 80 });
                    doc.text("Nombre Producto", 180, y, { width: 170 });
                    doc.text("Cantidad", 350, y, { width: 50, align: "right" });
                    doc.text("Valor Unidad", 400, y, { width: 70, align: "right" });
                    doc.text("Subtotal", 490, y, { width: 60, align: "right" });
                    y += 18;
                    doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();
                    doc.font("Helvetica").fontSize(9);
                    y += 10;
                  }

                  const productHeight = doc.heightOfString(item.product_name, { width: 170 });

                  doc.text(saleDate, 40, y, { width: 60 });
                  doc.text(invoiceNumber, 100, y, { width: 80 });
                  doc.text(item.product_name, 180, y, { width: 170 });
                  doc.text(String(item.quantity), 350, y, { width: 50, align: "right" });
                  doc.text(formatCOP(item.price), 400, y, { width: 70, align: "right" });
                  doc.text(formatCOP(item.subtotal), 490, y, { width: 60, align: "right" });

                  y += productHeight + 5;
                }

                // Agregar el total de la venta
                doc.font("Helvetica-Bold").text("Total de venta:", 350, y, { width: 130, align: "right" });
                doc.text(formatCOP(saleTotal), 490, y, { width: 60, align: "right" });

                y += 15;

                // 🔹 Mostrar detalle de métodos de pago
                doc.font("Helvetica").fontSize(9);
                doc.text(`Efectivo: ${formatCOP(sale.cash_payment || 0)}`, 350, y, { width: 200 });
                y += 12;
                doc.text(`Transferencia: ${formatCOP(sale.transfer_payment || 0)}`, 350, y, { width: 200 });
                y += 12;
                if (sale.sale_type === "credit" && sale.outstanding_balance > 0) {
                  doc.text(`Crédito: ${formatCOP(sale.outstanding_balance)}`, 350, y, { width: 200 });
                  y += 12;
                }

                y += 10; // Espacio entre ventas

                // Acumular totales
                totalGeneral += saleTotal;
                totalCash += sale.cash_payment || 0;
                totalTransfer += sale.transfer_payment || 0;
                totalCredit += sale.outstanding_balance || 0;
              }

              // 🔹 Totales generales al final
              doc.moveDown(1.5);
              doc.font("Helvetica-Bold").fontSize(12).text("Resumen de Métodos de Pago", 40, doc.y);

              doc.font("Helvetica").fontSize(11);
              doc.text(`Total en efectivo: ${formatCOP(totalCash)}`);
              doc.text(`Total en transferencias: ${formatCOP(totalTransfer)}`);
              doc.text(`Total en créditos: ${formatCOP(totalCredit)}`);
              doc.moveDown(0.5);
              doc.font("Helvetica-Bold").text(`Total General: ${formatCOP(totalGeneral)}`);

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

      // Exportar proveedores a PDF
      ipcMain.handle("export-suppliers-pdf", async () => {
        try {
            const suppliers = db.getSuppliers() || [];
            const company = db.getCompanySettings() || {};

            const { filePath, canceled } = await dialog.showSaveDialog({
                title: "Guardar Lista de Proveedores en PDF",
                defaultPath: "proveedores.pdf",
                filters: [{ name: "PDF", extensions: ["pdf"] }],
            });
            if (canceled || !filePath) return { success: false, message: "Exportación cancelada." };

            const doc = new PDFDocument({ margin: 40, size: "A4" });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            renderPdfHeader(doc, company, "Lista de Proveedores");

            let y = doc.y + 10;
            doc.fontSize(11).font("Helvetica-Bold");
            doc.text("Nombre", 40, y, { width: 150 });
            doc.text("NIT", 200, y, { width: 100 });
            doc.text("Dirección", 310, y, { width: 120 });
            doc.text("Teléfono", 440, y, { width: 100 });
            y += 18;
            doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

            doc.font("Helvetica").fontSize(10);
            for (const s of suppliers) {
                const rowHeight = Math.max(
                    doc.heightOfString(s.name || "", { width: 150 }),
                    doc.heightOfString(s.address || "", { width: 120 })
                ) + 5;

                if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                    y = 40;
                }
                doc.text(s.name || "", 40, y, { width: 150 });
                doc.text(s.nit || "", 200, y, { width: 100 });
                doc.text(s.address || "", 310, y, { width: 120 });
                doc.text(s.phone || "", 440, y, { width: 100 });
                y += rowHeight;
            }

            doc.end();
            await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); });

            return { success: true, message: "Lista de proveedores exportada a PDF.", filePath };
        } catch (err) {
            return { success: false, message: "Error al exportar proveedores a PDF: " + (err.message || String(err)) };
        }
    });

    // Exportar proveedores a Excel
    ipcMain.handle("export-suppliers-excel", async () => {
        try {
            const suppliers = db.getSuppliers() || [];
            const { filePath, canceled } = await dialog.showSaveDialog({
                title: "Guardar Lista de Proveedores en Excel",
                defaultPath: "proveedores.xlsx",
                filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
            });
            if (canceled || !filePath) return { success: false, message: "Exportación cancelada." };

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Proveedores");
            worksheet.columns = [
                { header: "Nombre", key: "name", width: 30 }, { header: "NIT", key: "nit", width: 20 },
                { header: "Dirección", key: "address", width: 30 }, { header: "Email", key: "email", width: 25 },
                { header: "Teléfono", key: "phone", width: 20 },
            ];
            worksheet.addRows(suppliers);
            await workbook.xlsx.writeFile(filePath);
            return { success: true, message: "Lista de proveedores exportada a Excel.", filePath };
        } catch (err) {
            return { success: false, message: "Error al exportar proveedores a Excel: " + (err.message || String(err)) };
        }
    });

  // ---------------- IMPRESIÓN ----------------
  // Vista previa de factura
            ipcMain.handle("preview-invoice", async (event, { content }) => {
              let previewWin = new BrowserWindow({
                width: 800, 
                height: 800,
                show: false,
                webPreferences: {
                    preload: path.join(__dirname, "preload.js"),
                    contextIsolation: true,
                    nodeIntegration: false,
                },
              });

              previewWin.on('closed', () => {
                previewWin = null;
              });

              await previewWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(content));
              previewWin.show();
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
                const printWin = new BrowserWindow({
                  width: 800,
                  height: 600,
                  show: true, // 👈 ahora también se muestra la vista previa
                  webPreferences: {
                    preload: path.join(__dirname, "preload.js"),
                    contextIsolation: true,
                    nodeIntegration: false,
                  },
                });

                await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent));

                printWin.webContents.on("did-finish-load", () => {
                  const options = {
                    silent: false, // 👈 false = muestra diálogo de impresora
                    printBackground: true,
                    deviceName: printer || undefined,
                  };

                  // Definir tamaño
                  if (paperSize === "80mm") {
                    options.pageSize = { width: 80000, height: 300000 };
                  } else if (paperSize === "57mm") {
                    options.pageSize = { width: 58000, height: 300000 };
                  } else if (paperSize === "A4") {
                    options.pageSize = "A4";
                  } else if (paperSize === "Letter") {
                    options.pageSize = "Letter";
                  } else if (paperSize === "Legal") {
                    options.pageSize = "Legal";
                  }

                  printWin.webContents.print(options, (success, failureReason) => {
                    if (!success) {
                      console.error("Falló la impresión:", failureReason);
                    }
                  });
                });

                return { success: true, message: "Factura lista para imprimir." };
              } catch (err) {
                console.error("Error al imprimir:", err);
                return { success: false, message: err.message };
              }
            });


      // Exportación de PDF descarga factura
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
          doc.text("#", 40, y, { width: 25 });
          doc.text("Nombre", 75, y, { width: 245 });
          doc.text("Precio", 320, y, { width: 80, align: "right" });
          doc.text("Cant.", 410, y, { width: 50, align: "right" });
          doc.text("Subtotal", 470, y, { width: 80, align: "right" });
          y += 18;
          doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

          doc.font("Helvetica").fontSize(10);
          let idx = 1;
          for (const it of items) {
            const nextY = y + doc.heightOfString(it.product_name || "-", { width: 245 }) + 5;
            if (nextY > 700) {
              doc.addPage();
              y = 40;
              doc.fontSize(11).font("Helvetica-Bold");
              doc.text("#", 40, y, { width: 25 });
              doc.text("Nombre", 75, y, { width: 245 });
              doc.text("Precio", 320, y, { width: 80, align: "right" });
              doc.text("Cant.", 410, y, { width: 50, align: "right" });
              doc.text("Subtotal", 470, y, { width: 80, align: "right" });
              y += 18;
              doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();
              doc.font("Helvetica").fontSize(10);
              y += 10;
            }

            const productHeight = doc.heightOfString(it.product_name || "-", { width: 245 });
            doc.text(String(idx), 40, y, { width: 25 });
            doc.text(it.product_name || "-", 75, y, { width: 245 });
            doc.text(formatCOP(it.price), 320, y, { width: 80, align: "right" });
            doc.text(String(it.quantity), 410, y, { width: 50, align: "right" });
            doc.text(formatCOP(it.subtotal), 470, y, { width: 80, align: "right" });
            y += productHeight + 5;
            idx++;
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

          // 📌 NUEVO: Detalle de pagos
          doc.moveDown(2);
          doc.fontSize(11).font("Helvetica").text(`Efectivo: ${formatCOP(sale.cash_payment || 0)}`, 400, doc.y + 6);
          doc.text(`Transferencia: ${formatCOP(sale.transfer_payment || 0)}`, 400, doc.y + 22);

          const totalPaid = (sale.cash_payment || 0) + (sale.transfer_payment || 0);
          const change = totalPaid - total;
          if (change > 0) {
            doc.text(`Cambio entregado: ${formatCOP(change)}`, 400, doc.y + 38);
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
        
      // Exportación cotizaciones pdf
      ipcMain.handle("export-quote-pdf", async (event, { id, quote_number, includeIva = false } = {}) => {
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
            doc.text("#", 40, y, { width: 25 });
            doc.text("Nombre", 75, y, { width: 255 });
            doc.text("Precio", 330, y, { align: "right", width: 80 });
            doc.text("Cant.", 420, y, { align: "right", width: 50 });
            doc.text("Subtotal", 480, y, { align: "right", width: 70 });
            y += 18;
            doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

            doc.font("Helvetica").fontSize(9);
            let idx = 1;
            for (const it of items) {
                const productText = it.product_name || "-";;
                const productHeight = doc.heightOfString(productText, { width: 255 });
                const lineHeight = Math.max(20, productHeight + 25);

                if (y + lineHeight > doc.page.height - doc.page.margins.bottom - 40) {
                    doc.addPage();
                    y = 40;
                    doc.fontSize(11).font("Helvetica-Bold");
                    doc.text("#", 40, y, { width: 25 });
                    doc.text("Nombre", 75, y, { width: 255 });
                    doc.text("Precio", 330, y, { align: "right", width: 80 });
                    doc.text("Cant.", 420, y, { align: "right", width: 50 });
                    doc.text("Subtotal", 480, y, { align: "right", width: 70 });
                    y += 18;
                    doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();
                    doc.font("Helvetica").fontSize(9);
                    y += 10;
                }

                const currentY = y;
                doc.text(String(idx), 40, currentY, { width: 25 });
                doc.text(productText, 75, currentY, { width: 255 });
                doc.text(formatCOP(it.price), 330, currentY, { align: "right", width: 80 });
                doc.text(String(it.quantity), 420, currentY, { align: "right", width: 50 });
                doc.text(formatCOP(it.subtotal), 480, currentY, { align: "right", width: 70 });
                y += lineHeight;
                idx++;
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
                    const totalInventoryValue = products.reduce((acc, p) => acc + (Number(p.stock) * Number(p.sale_price)), 0);

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
                    doc.text("Nombre", 110, y, { width: 160 });
                    doc.text("Categoría", 280, y, { width: 100 });
                    doc.text("Costo", 390, y, { width: 60, align: "right" });
                    doc.text("Venta", 460, y, { width: 60, align: "right" });
                    doc.text("Stock", 530, y, { width: 40, align: "right" });
                    y += 18;
                    doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

                    doc.font("Helvetica").fontSize(10);
                    for (const p of products) {
                        doc.text(p.code || "", 40, y, { width: 60 });
                        doc.text(p.name || "", 110, y, { width: 160 });
                        doc.text(p.category || "", 280, y, { width: 100 });
                        doc.text(formatCOP(p.purchase_price || 0), 390, y, { width: 60, align: "right" });
                        doc.text(formatCOP(p.sale_price || 0), 460, y, { width: 60, align: "right" });
                        doc.text(String(p.stock || 0), 530, y, { width: 40, align: "right" });
                        y += 28;
                        if (y > 700) { doc.addPage(); y = 40; }
                    }

                    // --- Agregar el valor total del inventario al PDF ---
                    doc.moveDown(2);
                    doc.font("Helvetica-Bold").fontSize(12);
                    doc.text("Valor Total del Inventario (Precio Venta):", 40, doc.y, { align: "right" });
                    doc.font("Helvetica").fontSize(12).text(formatCOP(totalInventoryValue), { align: "right" });

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
            const totalInventoryValue = products.reduce((acc, p) => acc + (Number(p.stock) * Number(p.sale_price)), 0);

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

            // --- Agregar el valor total del inventario al Excel ---
            worksheet.addRow({}); // Fila vacía para separación
            const totalRow = worksheet.addRow({
                name: "VALOR TOTAL DEL INVENTARIO (PRECIO VENTA)",
                sale_price: totalInventoryValue
            });

            // Aplicar formato en negrita a la fila del total
            totalRow.font = { bold: true };
            totalRow.getCell('B').font = { bold: true };
            totalRow.getCell('E').font = { bold: true };

            // Aplicar formato de moneda a la celda del total
            totalRow.getCell('E').numFmt = `"_(\"$\"* #,##0_);_(\"$\"* (#,##0);_(\"$\"* \"-\"??_);_(@_)"`;

            await workbook.xlsx.writeFile(filePath);
            return { success: true, filePath };
        } catch (err) {
            return { success: false, message: "Error al exportar inventario Excel: " + (err.message || String(err)) };
        }
    });
  }

  async function exportPurchaseOrderPDF(orderId) {
    try {
      const order = db.getPurchaseOrderById(orderId);
      if (!order) return { success: false, message: "Orden de compra no encontrada" };
      
      const company = db.getCompanySettings() || {};

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "Guardar Orden de Compra en PDF",
        defaultPath: `Orden-Compra-${order.po_number || order.id}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (canceled || !filePath) return { success: false, message: "Exportación cancelada" };

      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      renderPdfHeader(doc, company, `Orden de Compra #${order.po_number || order.id}`);

      // Datos del proveedor
      doc.fontSize(11).font("Helvetica-Bold").text("Proveedor:", 40, doc.y + 10);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Nombre: ${order.supplier_name || ""}`);
      doc.text(`Dirección: ${order.supplier_address || ""}`);
      doc.text(`Teléfono: ${order.supplier_phone || ""}`);
      doc.moveDown(1);

      let y = doc.y + 10;
      doc.fontSize(11).font("Helvetica-Bold");
      doc.text("Producto", 40, y, { width: 280 });
      doc.text("Cant.", 320, y, { align: "right", width: 70 });
      doc.text("Precio Unit.", 390, y, { align: "right", width: 85 });
      doc.text("Subtotal", 475, y, { align: "right", width: 80 });
      y += 18;
      doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

      doc.font("Helvetica").fontSize(10);
      for (const it of order.items) {
        const productHeight = doc.heightOfString(it.product_name || "-", { width: 280 });
        if (y + productHeight > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
          y = 40;
        }
        doc.text(it.product_name || "-", 40, y, { width: 280 });
        doc.text(String(it.quantity), 320, y, { align: "right", width: 70 });
        doc.text(formatCOP(it.price), 390, y, { align: "right", width: 85 });
        doc.text(formatCOP(it.subtotal), 475, y, { align: "right", width: 80 });
        y += productHeight + 5;
      }

      doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(order.total_amount)}`, 400, y + 20, { align: "right" });

      doc.end();
      await new Promise((res, rej) => {
        stream.on("finish", res);
        stream.on("error", rej);
      });

      return { success: true, message: "Orden de Compra exportada a PDF.", filePath };
    } catch (err) {
      console.error("Error exporting Purchase Order PDF:", err);
      return { success: false, message: "Error al exportar la Orden de Compra: " + (err.message || String(err)) };
    }
  }