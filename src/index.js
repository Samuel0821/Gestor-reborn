  // ---------- DEPENDENCIAS PRINCIPALES ----------
  const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
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
      icon: path.join(__dirname, "logo", "gestorfx_logof.ico"), // <-- El ícono va aquí
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Eliminar la barra de menú por defecto (Archivo, Vista, etc.)
    //mainWindow.setMenu(null);

    // Siempre iniciar en login.html
    mainWindow.loadFile(path.join(__dirname, "views", "login.html"));

    // Manejar enlaces externos para que se abran en el navegador
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

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


  function renderPdfHeader(doc, company = {}, title = "", docNumber = "", date = "") {
    const xLeft = 50;
    const xRight = 300; 
    let y = 50;

    if (company.logo_path && fs.existsSync(company.logo_path)) {
      try {
        doc.image(company.logo_path, xLeft, y, { width: 60 });
      } catch (e) {}
    }

    const textX = xLeft + 70;
    doc.font("Helvetica-Bold").fontSize(12).text(company.company_name || "", textX, y);
    doc.font("Helvetica").fontSize(9).text(`NIT: ${company.company_id_card_or_nit || ""}`, textX, y + 15);
    doc.text(company.company_address || "", textX, y + 27);
    doc.text(`Tel: ${company.company_phone || ""} ${company.company_email ? "| " + company.company_email : ""}`, textX, y + 39);

    let yHeaderRight = 50;
    doc.font("Helvetica-Bold").fontSize(14).text(title, xRight, yHeaderRight, { align: "right", width: 250 });
    if (docNumber) {
      doc.fontSize(12).text(docNumber, xRight, yHeaderRight + 20, { align: "right", width: 250 });
    }
    if (date) {
      doc.font("Helvetica").fontSize(9).text(`Fecha: ${date}`, xRight, yHeaderRight + 40, { align: "right", width: 250 });
    }

    doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, 110).lineTo(550, 110).stroke();
    doc.y = 125;
  }

  function drawTableHeaders(doc, y, headers) {
    // headers = [{text, x, width, align}]
    doc.rect(50, y, 500, 20).fillColor("#f0f0f0").fill();
    doc.fillColor("#000000");
    doc.font("Helvetica-Bold").fontSize(9);
    
    headers.forEach(h => {
        doc.text(h.text, h.x, y + 6, { width: h.width, align: h.align || 'left' });
    });
    
    return y + 25;
  }

  // Función auxiliar para convertir números a letras (Pesos Colombianos)
  function numeroALetras(num) {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const diez = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function convertGroup(n) {
        let output = '';
        if (n === 100) return 'CIEN ';
        if (n >= 100) { output += centenas[Math.floor(n / 100)] + ' '; n %= 100; }
        if (n >= 10 && n <= 19) { output += diez[n - 10] + ' '; return output; }
        if (n >= 20) { output += decenas[Math.floor(n / 10)] + ' '; n %= 10; if (n > 0) output = output.trim() + ' Y '; }
        if (n > 0) output += unidades[n] + ' ';
        return output;
    }

    let integerPart = Math.floor(num);
    if (integerPart === 0) return 'CERO PESOS';
    
    let str = '';
    if (integerPart >= 1000000) {
        const millions = Math.floor(integerPart / 1000000);
        str += (millions === 1 ? 'UN MILLON ' : convertGroup(millions) + ' MILLONES ');
        integerPart %= 1000000;
    }
    if (integerPart >= 1000) {
        const thousands = Math.floor(integerPart / 1000);
        str += (thousands === 1 ? 'MIL ' : convertGroup(thousands) + ' MIL ');
        integerPart %= 1000;
    }
    if (integerPart > 0) str += convertGroup(integerPart);
    
    return str.trim() + ' PESOS COLOMBIANOS';
  }

  // ---------- REGISTRAR MANEJADORES IPC ----------

  function drawLine(doc, y) {
    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
  }

  const loginAttempts = new Map();

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
      ipcMain.handle("get-sales", (event, limit, offset, clientId) => db.getSales(limit, offset, clientId));
      ipcMain.handle("get-sale-by-id", (event, id) => db.getSaleById(id));
      ipcMain.handle("get-sale-items", (event, id) => db.getSaleItems(id));
      ipcMain.handle("delete-sale", (event, id) => db.deleteSale(id));
      ipcMain.handle("update-sale", (event, data) => db.updateSale(data));

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
      ipcMain.handle("add-credit-payment", async (event, saleId, amount, method, reference) => db.addCreditPayment(saleId, amount, method, reference));
      ipcMain.handle("mark-credit-as-paid", async (event, saleId, method, reference) => db.markCreditAsPaid(saleId, method, reference));

      // Ordenes de Compra
      ipcMain.handle("create-purchase-order", (event, data) => db.createPurchaseOrder(data));
      ipcMain.handle("get-purchase-orders", () => db.getPurchaseOrders());
      ipcMain.handle("get-purchase-order-by-id", (event, id) => db.getPurchaseOrderById(id));
      ipcMain.handle("update-purchase-order", (event, data) => db.updatePurchaseOrder(data));
      ipcMain.handle("delete-purchase-order", (event, id) => db.deletePurchaseOrder(id));

      ipcMain.handle("export-purchase-order-pdf", (event, id) => exportPurchaseOrderPDF(id));
      ipcMain.handle("get-purchase-orders-count", () => db.getPurchaseOrders().length);
      ipcMain.handle("receive-purchase-order", (event, id) => db.receivePurchaseOrder(id));
      
      // --- GESTIÓN DE PAGOS A PROVEEDORES ---
      ipcMain.handle("update-purchase-invoice-number", (event, { id, invoiceNumber }) => db.updatePurchaseInvoiceNumber(id, invoiceNumber));
      ipcMain.handle("add-purchase-payment", (event, data) => db.addPurchasePayment(data));
      ipcMain.handle("get-purchase-payments", (event, orderId) => db.getPurchasePayments(orderId));
      ipcMain.handle("get-retentions-report", (event, filters) => db.getRetentionsReport(filters));
      ipcMain.handle("get-due-purchase-orders", () => db.getDuePurchaseOrders());

      // Cotizaciones
      ipcMain.handle("create-quote", (event, data) => db.createQuote(data));
      ipcMain.handle("get-quotes", (event, clientId) => db.getQuotes(clientId));
      ipcMain.handle("get-quote-by-id", (event, id) => db.getQuoteById(id));
      ipcMain.handle("get-quote-items", (event, id) => db.getQuoteItems(id));
      ipcMain.handle("delete-quote", (event, id) => db.deleteQuote(id));
      ipcMain.handle("get-last-quote-number", () => db.getLastQuoteNumber());
      ipcMain.handle("set-quote-number", (event, { id, quoteNumber }) => db.setQuoteNumber(id, quoteNumber));
      ipcMain.handle("create-sale-from-quote", (event, data) => db.createSaleFromQuote(data));
      ipcMain.handle("update-quote-details", (event, data) => db.updateQuoteDetails(data));

      // Servicios
      ipcMain.handle("get-services", () => db.getServices());
      ipcMain.handle("get-service-by-id", (event, id) => db.getServiceById(id));
      ipcMain.handle("create-service", (event, data) => db.createService(data));
      ipcMain.handle("update-service", (event, data) => db.updateService(data));
      ipcMain.handle("delete-service", (event, id) => db.deleteService(id));

      // Usuarios
      ipcMain.handle("login", async (event, creds) => {
        const { username, password } = creds;
        const now = Date.now();
        
        // Rate Limiting: Protección contra fuerza bruta
        const attempt = loginAttempts.get(username) || { count: 0, lockUntil: 0 };

        if (attempt.lockUntil > now) {
          const seconds = Math.ceil((attempt.lockUntil - now) / 1000);
          return { success: false, message: `Demasiados intentos. Espere ${seconds}s.` };
        }

        const res = db.login(username, password);

        if (res.success) {
          loginAttempts.delete(username); // Resetear intentos al entrar
        } else {
          attempt.count++;
          if (attempt.count >= 3) {
            attempt.lockUntil = now + 30000; // Bloqueo de 30s tras 3 fallos
            attempt.count = 0;
            loginAttempts.set(username, attempt);
            return { success: false, message: "Demasiados intentos. Bloqueado por 30s." };
          }
          loginAttempts.set(username, attempt);
        }
        return res;
      });

      ipcMain.handle("get-users", () => db.getUsers());
      ipcMain.handle("create-user", (event, data) => db.createUser(data));
      ipcMain.handle("update-user", (event, data) => db.updateUser(data));
      ipcMain.handle("delete-user", (event, id) => db.deleteUser(id));

      // Soporte Técnico
      ipcMain.handle("send-support-ticket", async (event, { subject, message }) => {
        try {
          const userEmail = "contacto.grisalistech@gmail.com";
          const fullSubject = `Soporte GestorFX: ${subject}`;
          const fullBody = `${message}\n\n---\nEnviado desde GestorFX`;
          const mailtoLink = `mailto:${userEmail}?subject=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(fullBody)}`;
          
          await shell.openExternal(mailtoLink);
          return { success: true };
        } catch (error) {
          return { success: false, message: error.message };
        }
      });

      // Gastos
      ipcMain.handle('get-expenses', async (event, startDate, endDate) => db.getExpenses(startDate, endDate));
      ipcMain.handle('get-expense-by-id', async (event, id) => db.getExpenseById(id));
      ipcMain.handle('save-expense', async (event, expense) => db.saveExpense(expense));
      ipcMain.handle('delete-expense', async (event, id) => db.deleteExpense(id));
      
      ipcMain.handle('export-expense-pdf', async (event, id) => {
        try {
            const expense = db.getExpenseById(id);
            if (!expense) return { success: false, message: "Gasto no encontrado" };
            
            const company = db.getCompanySettings() || {};
            
            const { filePath, canceled } = await dialog.showSaveDialog({
                title: "Guardar Comprobante de Egreso",
                defaultPath: `Egreso-${String(id).padStart(3, '0')}.pdf`,
                filters: [{ name: "PDF", extensions: ["pdf"] }],
            });
            
            if (canceled || !filePath) return { success: false, message: "Exportación cancelada" };
            
            const doc = new PDFDocument({ margin: 50, size: "A4" });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);
            
            renderPdfHeader(doc, company, "COMPROBANTE DE EGRESO", `No. ${String(id).padStart(4, '0')}`, expense.date);
            
            doc.fontSize(10).font("Helvetica");
            const labelX = 50;
            const valueX = 150;
            let y = doc.y + 10;
            
            const drawField = (label, value, color = "black") => {
                doc.font("Helvetica-Bold").fillColor("black").text(label, labelX, y);
                doc.font("Helvetica").fillColor(color).text(value, valueX, y, { width: 350 });
                y += 20;
            };

            drawField("Categoría:", expense.category || "General");
            drawField("Descripción:", expense.description || "-");
            drawField("Monto:", formatCOP(expense.amount), "red");
            if (expense.created_at) drawField("Fecha Registro:", expense.created_at);

            y += 10;
            drawLine(doc, y);

            // Espacio para firma
            y += 80;
            doc.moveTo(50, y).lineTo(250, y).stroke();
            doc.fillColor("black").text("Firma Autorizado", 50, y + 5);
            
            doc.end();
            await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); });
            
            return { success: true, filePath };
        } catch (err) {
            return { success: false, message: "Error al exportar PDF: " + err.message };
        }
      });
      
      ipcMain.handle('export-expenses-report-pdf', async (event, { startDate, endDate }) => {
        try {
            const expenses = db.getExpenses(startDate, endDate);
            const company = db.getCompanySettings() || {};
            
            if (!expenses || expenses.length === 0) {
                return { success: false, message: "No hay egresos para exportar en este rango de fechas." };
            }

            const { filePath, canceled } = await dialog.showSaveDialog({
                title: "Guardar Reporte de Egresos",
                defaultPath: `Reporte_Egresos_${startDate}_${endDate}.pdf`,
                filters: [{ name: "PDF", extensions: ["pdf"] }],
            });
            
            if (canceled || !filePath) return { success: false, message: "Exportación cancelada" };
            
            const doc = new PDFDocument({ margin: 50, size: "A4" });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);
            
            renderPdfHeader(doc, company, "REPORTE DE EGRESOS", "", `${startDate} al ${endDate}`);

            let y = doc.y + 10;
            const col1 = 50;
            const col2 = 130;
            const col3 = 330;
            const col4 = 450;

            y = drawTableHeaders(doc, y, [
                { text: "Fecha", x: col1, width: 70 },
                { text: "Descripción", x: col2, width: 190 },
                { text: "Categoría", x: col3, width: 110 },
                { text: "Monto", x: col4, width: 100, align: "right" }
            ]);

            doc.font("Helvetica").fontSize(9);
            
            let total = 0;

            for (const exp of expenses) {
                if (y > 700) {
                    doc.addPage();
                    y = 40;
                    // Repetir encabezado si se desea, o continuar
                }
                doc.fillColor("black").text(exp.date, col1, y);
                doc.text(exp.description, col2, y, { width: 190 });
                doc.text(exp.category, col3, y, { width: 110 });
                doc.text(formatCOP(exp.amount), col4, y, { align: "right", width: 100 });
                
                total += exp.amount;
                y += 20;
            }

            y += 5;
            drawLine(doc, y);
            y += 10;
            doc.fontSize(12).font("Helvetica-Bold");
            doc.text("TOTAL EGRESOS:", 300, y);
            doc.fillColor("red").text(formatCOP(total), col4, y, { align: "right", width: 100 });
            
            doc.end();
            await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); });
            
            return { success: true, filePath };
        } catch (err) {
            return { success: false, message: "Error al exportar PDF: " + err.message };
        }
      });

      // Auditoría
      ipcMain.handle("get-audit-logs", (event, { startDate, endDate }) => db.getAuditLogs(startDate, endDate));
      ipcMain.handle("log-action", (event, { userName, action, details }) => db.logAction(userName, action, details));

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
      ipcMain.handle("get-sales-last-days", (event, days) => db.getSalesLastDays(days));
      ipcMain.handle("reset-database", () => db.resetDatabase());
      
      // --- DASHBOARD AVANZADO (NUEVO) ---
      ipcMain.handle("get-advanced-dashboard-stats", async (event, { startDate, endDate } = {}) => {
        try {
          const now = new Date();
          // Si no llegan fechas, usar mes actual por defecto
          const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
          const today = now.toISOString().slice(0, 10);
          
          // 1. Ventas Hoy
          const salesToday = db.db.prepare("SELECT SUM(total_amount) as total FROM sales WHERE date(sale_date) = ?").get(today);
          
          // 2. Ventas Ayer (Para variación)
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const salesYesterday = db.db.prepare("SELECT SUM(total_amount) as total FROM sales WHERE date(sale_date) = ?").get(yesterday.toISOString().slice(0, 10));

          // 3. Top 5 Productos (Mes Actual)
          const topProducts = db.db.prepare(`
            SELECT p.name, SUM(si.quantity) as qty 
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.id
            WHERE date(s.sale_date) BETWEEN ? AND ?
            GROUP BY p.id
            ORDER BY qty DESC
            LIMIT 5
          `).all(start, end);

          // 4. Métodos de Pago (Mes Actual)
          const paymentMethods = db.db.prepare(`
            SELECT 
              SUM(cash_payment) as cash, 
              SUM(transfer_payment) as transfer,
              (SELECT SUM(outstanding_balance) FROM sales WHERE sale_type = 'credit' AND date(sale_date) BETWEEN ? AND ?) as credit
            FROM sales 
            WHERE date(sale_date) BETWEEN ? AND ?
          `).get(start, end, start, end);

          // 5. Resumen Financiero Mensual
          const income = db.db.prepare("SELECT SUM(total_amount) as total FROM sales WHERE date(sale_date) BETWEEN ? AND ?").get(start, end).total || 0;
          const expenses = db.db.prepare("SELECT SUM(amount) as total FROM expenses WHERE date BETWEEN ? AND ?").get(start, end).total || 0;
          
          // Calcular Costo de Ventas (Para Utilidad Bruta)
          const soldItems = db.db.prepare(`
            SELECT si.quantity, si.conversion_factor, si.variant_id, 
                   p.purchase_price as base_cost, pv.purchase_price as variant_cost
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_variants pv ON si.variant_id = pv.id
            WHERE date(s.sale_date) BETWEEN ? AND ?
          `).all(start, end);

          let totalCost = 0;
          for (const item of soldItems) {
             // Prioridad: Costo variante > Costo base * factor
             let cost = (item.variant_cost && item.variant_cost > 0) 
                     ? item.variant_cost 
                     : (item.base_cost || 0) * (item.conversion_factor || 1);
             totalCost += cost * item.quantity;
          }
          
          // 6. Conteo de Alertas
          const lowStockCount = db.db.prepare("SELECT COUNT(*) as count FROM products WHERE stock <= min_stock").get().count;
          const pendingOrdersCount = db.db.prepare("SELECT COUNT(*) as count FROM purchase_orders WHERE status = 'pending'").get().count;
          const debtorsCount = db.db.prepare("SELECT COUNT(DISTINCT client_id) as count FROM sales WHERE sale_type = 'credit' AND outstanding_balance > 0").get().count;
          
          // Alerta de Cuentas por Pagar (Vencidas o próximas 7 días)
          const payableAlertsCount = db.db.prepare(`
            SELECT COUNT(*) as count 
            FROM purchase_orders 
            WHERE payment_status != 'paid' 
            AND due_date IS NOT NULL 
            AND due_date <= date('now', '+7 days')
          `).get().count;

          // 7. NUEVAS TARJETAS (SNAPSHOTS)
          const totalProducts = db.db.prepare("SELECT COUNT(*) as c FROM products").get().c;
          const inventoryValue = db.db.prepare("SELECT SUM(stock * purchase_price) as v FROM products").get().v || 0;
          const totalClients = db.db.prepare("SELECT COUNT(*) as c FROM clients").get().c;
          const totalSuppliers = db.db.prepare("SELECT COUNT(*) as c FROM suppliers").get().c;
          const totalQuotes = db.db.prepare("SELECT COUNT(*) as c FROM quotes").get().c;
          const totalPOs = db.db.prepare("SELECT COUNT(*) as c FROM purchase_orders").get().c;
          const pendingPOPayments = db.db.prepare("SELECT SUM(outstanding_balance) as v FROM purchase_orders WHERE payment_status != 'paid'").get().v || 0;

          return {
            salesToday: salesToday.total || 0,
            salesYesterday: salesYesterday.total || 0,
            topProducts,
            paymentMethods: {
              cash: paymentMethods.cash || 0,
              transfer: paymentMethods.transfer || 0,
              credit: paymentMethods.credit || 0
            },
            financials: {
              income,
              expenses,
              netProfit: income - totalCost // Ahora muestra Utilidad Bruta (Ventas - Costos)
            },
            alerts: {
              lowStock: lowStockCount,
              pendingOrders: pendingOrdersCount,
              debtors: debtorsCount,
              payable: payableAlertsCount
            },
            general: {
              totalProducts,
              inventoryValue,
              totalClients,
              totalSuppliers,
              totalQuotes,
              totalPOs,
              pendingPOPayments
            }
          };
        } catch (err) {
          console.error("Error en dashboard avanzado:", err);
          return null;
        }
      });

      ipcMain.handle("get-recent-activity", async () => {
        try {
          // Si existe tabla audit_logs, usarla. Si no, simular con últimas ventas y compras.
          // Asumiremos que audit_logs existe por el contexto previo, si no, fallback a ventas.
          const logs = db.db.prepare(`
            SELECT 'venta' as type, 'Venta realizada #' || invoice_number as description, sale_date as date FROM sales ORDER BY id DESC LIMIT 5
          `).all();
          
          // Mezclar con compras recientes
          const orders = db.db.prepare(`
            SELECT 'compra' as type, 'Orden de compra #' || id as description, order_date as date FROM purchase_orders ORDER BY id DESC LIMIT 5
          `).all();

          return [...logs, ...orders].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
        } catch (err) { return []; }
      });

      ipcMain.handle("select-file", async (event, options) => {
          const result = await dialog.showOpenDialog(options);
          return result.canceled ? null : result.filePaths[0];
      });

      // Reportes e Inventario
        ipcMain.handle("get-sales-report", (event, params) => db.getSalesReport(params));

        
        ipcMain.handle("get-inventory", async () => {
                try {
                    const products = db.getProducts();
                    const totalInventoryValue = products.reduce((acc, p) => acc + (Number(p.stock) * Number(p.purchase_price || 0)), 0);
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
                doc.text(p.name || "", 140, y, { width: 250 });
                doc.text(String(p.stock || 0), 400, y, { width: 70, align: "right" });
                doc.text(String(p.min_stock || 0), 480, y, { width: 70, align: "right" });
                y += rowHeight + 5;
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

          ipcMain.handle("export-sales-report-pdf", async (event, { salesReport, companyInfo, filename, financialSummary, paymentMethodsSummary }) => {
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

              const doc = new PDFDocument({ margin: 50, size: "A4" });
              const stream = fs.createWriteStream(filePath);
              doc.pipe(stream);

              renderPdfHeader(doc, companyInfo, "REPORTE DE VENTAS", "", new Date().toLocaleDateString());

              let y = doc.y + 10;
              const startY = y;

              y = drawTableHeaders(doc, y, [
                  { text: "Fecha", x: 50, width: 60 },
                  { text: "# Factura", x: 110, width: 70 },
                  { text: "Producto", x: 190, width: 170 },
                  { text: "Cant.", x: 370, width: 40, align: "right" },
                  { text: "Precio", x: 420, width: 60, align: "right" },
                  { text: "Subtotal", x: 490, width: 60, align: "right" }
              ]);

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
                
                // Calcular efectivo real para esta venta
                const tendered = sale.cash_payment || 0;
                const transfer = sale.transfer_payment || 0;
                const change = Math.max(0, (tendered + transfer) - saleTotal);
                const realCash = Math.max(0, tendered - change);

                for (const item of sale.items) {
                  // Verificar salto de página
                  if (y > doc.page.height - doc.page.margins.bottom - 80) {
                    doc.addPage();
                    y = startY;
                    y = drawTableHeaders(doc, y, [
                        { text: "Fecha", x: 50, width: 60 },
                        { text: "# Factura", x: 110, width: 70 },
                        { text: "Producto", x: 190, width: 170 },
                        { text: "Cant.", x: 370, width: 40, align: "right" },
                        { text: "Precio", x: 420, width: 60, align: "right" },
                        { text: "Subtotal", x: 490, width: 60, align: "right" }
                    ]);
                    doc.font("Helvetica").fontSize(9);
                  }

                  const productHeight = doc.heightOfString(item.product_name, { width: 170 });

                  doc.text(saleDate, 50, y, { width: 60 });
                  doc.text(invoiceNumber, 110, y, { width: 70 });
                  doc.text(item.product_name, 190, y, { width: 170 });
                  doc.text(String(item.quantity), 370, y, { width: 40, align: "right" });
                  doc.text(formatCOP(item.price), 420, y, { width: 60, align: "right" });
                  doc.text(formatCOP(item.subtotal), 490, y, { width: 60, align: "right" });

                  y += productHeight + 5;
                }

                // Agregar el total de la venta
                doc.font("Helvetica-Bold").text("Total de venta:", 350, y, { width: 130, align: "right" });
                doc.text(formatCOP(saleTotal), 490, y, { width: 60, align: "right" });

                y += 15;

                // 🔹 Mostrar detalle de métodos de pago
                doc.font("Helvetica").fontSize(9);
                doc.text(`Efectivo: ${formatCOP(realCash)}`, 350, y, { width: 200 });
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
                totalCash += realCash;
                totalTransfer += sale.transfer_payment || 0;
                totalCredit += sale.outstanding_balance || 0;
              }

              // 🔹 Totales generales al final
              doc.moveDown(1.5);
              
              // Sección de Balance Financiero
              if (financialSummary) {
                doc.font("Helvetica-Bold").fontSize(12).text("Balance Financiero", 50, doc.y);
                doc.font("Helvetica").fontSize(10);
                doc.text(`(+) Total Ventas: ${formatCOP(financialSummary.totalSales)}`);
                doc.text(`(-) Costo Mercancía: ${formatCOP(financialSummary.totalCost)}`);
                doc.text(`(=) Utilidad Bruta: ${formatCOP(financialSummary.grossProfit)}`);
                doc.fillColor("red").text(`(-) Total Gastos: ${formatCOP(financialSummary.totalExpenses)}`);
                doc.fillColor("black").font("Helvetica-Bold").text(`(=) UTILIDAD NETA REAL: ${formatCOP(financialSummary.netProfit)}`);
                doc.moveDown(1);
              }

              // Sección de Métodos de Pago
              doc.font("Helvetica-Bold").fontSize(12).text("Resumen de Métodos de Pago", 50, doc.y);
              doc.font("Helvetica").fontSize(10);
              doc.text(`Total en Efectivo: ${formatCOP(totalCash)}`);
              doc.text(`Total en Créditos: ${formatCOP(totalCredit)}`);
              
              if (paymentMethodsSummary && paymentMethodsSummary.transfersByBank) {
                doc.moveDown(0.5);
                doc.font("Helvetica-Bold").text("Detalle Transferencias por Banco:");
                doc.font("Helvetica");
                for (const [bank, amount] of Object.entries(paymentMethodsSummary.transfersByBank)) {
                   doc.text(`- ${bank || 'Sin referencia'}: ${formatCOP(amount)}`);
                }
                doc.font("Helvetica-Bold").text(`Total Transferencias: ${formatCOP(totalTransfer)}`);
              } else {
                doc.text(`Total en Transferencias: ${formatCOP(totalTransfer)}`);
              }

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

            const doc = new PDFDocument({ margin: 50, size: "A4" });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            renderPdfHeader(doc, company, "LISTA DE PROVEEDORES", "", new Date().toLocaleDateString());

            let y = doc.y + 10;
            y = drawTableHeaders(doc, y, [
                { text: "Nombre", x: 50, width: 150 },
                { text: "NIT", x: 210, width: 100 },
                { text: "Dirección", x: 320, width: 120 },
                { text: "Teléfono", x: 450, width: 100 }
            ]);

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
                doc.text(s.name || "", 50, y, { width: 150 });
                doc.text(s.nit || "", 210, y, { width: 100 });
                doc.text(s.address || "", 320, y, { width: 120 });
                doc.text(s.phone || "", 450, y, { width: 100 });
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

          const doc = new PDFDocument({ margin: 50, size: "A4" });
          const stream = fs.createWriteStream(filePath);
          doc.pipe(stream);

          renderPdfHeader(doc, company, "FACTURA DE VENTA", sale.invoice_number || `No. ${String(id).padStart(3, "0")}`, sale.sale_date);

          if (client) {
            doc.fontSize(11).font("Helvetica-Bold").text("Cliente:", 50, doc.y + 10);
            doc.font("Helvetica").fontSize(10);
            doc.text(`Nombre: ${client.name || ""}`);
            doc.text(`NIT/Cédula: ${client.id_card_or_nit || ""}`);
            doc.text(`Dirección: ${client.address || ""}`);
            doc.text(`Email: ${client.email || ""}`);
            doc.text(`Teléfono: ${client.phone || ""}`);
            doc.moveDown(1);
          } else {
            doc.fontSize(11).font("Helvetica-Bold").text("Cliente:", 50, doc.y + 10);
            doc.font("Helvetica").fontSize(10);
            doc.text("Consumidor final");
            doc.moveDown(1);
          }

          let y = doc.y + 10;
          y = drawTableHeaders(doc, y, [
              { text: "#", x: 50, width: 25 },
              { text: "Nombre", x: 80, width: 240 },
              { text: "Precio", x: 330, width: 80, align: "right" },
              { text: "Cant.", x: 420, width: 50, align: "right" },
              { text: "Subtotal", x: 480, width: 70, align: "right" }
          ]);

          doc.font("Helvetica").fontSize(10);
          let idx = 1;
          for (const it of items) {
            const nextY = y + doc.heightOfString(it.product_name || "-", { width: 245 }) + 5;
            if (nextY > 700) {
              doc.addPage();
              y = 40;
              y = drawTableHeaders(doc, y, [
                  { text: "#", x: 50, width: 25 },
                  { text: "Nombre", x: 80, width: 240 },
                  { text: "Precio", x: 330, width: 80, align: "right" },
                  { text: "Cant.", x: 420, width: 50, align: "right" },
                  { text: "Subtotal", x: 480, width: 70, align: "right" }
              ]);
              doc.font("Helvetica").fontSize(10);
            }

            const productHeight = doc.heightOfString(it.product_name || "-", { width: 245 });
            doc.text(String(idx), 50, y, { width: 25 });
            doc.text(it.product_name || "-", 80, y, { width: 240 });
            doc.text(formatCOP(it.price), 330, y, { width: 80, align: "right" });
            doc.text(String(it.quantity), 420, y, { width: 50, align: "right" });
            doc.text(formatCOP(it.subtotal), 480, y, { width: 70, align: "right" });
            y += productHeight + 5;
            idx++;
          }

          const subtotal = items.reduce((acc, it) => acc + (Number(it.subtotal) || Number(it.price) * Number(it.quantity) || 0), 0);
          const iva = includeIva ? Math.round(subtotal * 0.19) : 0;
          const total = subtotal + iva;

          doc.moveDown(1);
          if (includeIva) {
            doc.fontSize(10).text(`Subtotal: ${formatCOP(subtotal)}`, 400, y + 6, { align: "right", width: 150 });
            doc.text(`IVA (19%): ${formatCOP(iva)}`, 400, y + 22, { align: "right", width: 150 });
            doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 42, { align: "right", width: 150 });
          } else {
            doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 10, { align: "right", width: 150 });
          }

          // 📌 NUEVO: Detalle de pagos
          doc.moveDown(2);
          
          // Obtener referencia de transferencia si existe
          let transferRef = "";
          try {
             const payments = db.db.prepare("SELECT * FROM sale_payments WHERE sale_id = ?").all(id);
             const tPayment = payments.find(p => p.method === "transfer");
             if (tPayment && tPayment.reference) transferRef = tPayment.reference;
          } catch(e) {}

          const cash = sale.cash_payment || 0;
          const transfer = sale.transfer_payment || 0;
          const isCredit = sale.sale_type === "credit";
          
          doc.fontSize(11).font("Helvetica");
          let currentY = doc.y;

          if (isCredit) {
              doc.text(`Crédito: ${formatCOP(sale.total_amount)}`, 400, currentY + 6, { align: "right", width: 150 });
          } else {
              if (cash > 0 && transfer > 0) {
                  doc.text(`Pago en efectivo: ${formatCOP(cash)}`, 400, currentY + 6, { align: "right", width: 150 });
                  doc.text(`Transferencia ${transferRef ? `(${transferRef})` : ""}: ${formatCOP(transfer)}`, 400, currentY + 22, { align: "right", width: 150 });
                  currentY += 16; // Ajuste para la siguiente línea si es mixto
              } else if (cash > 0) {
                  doc.text(`Pago en efectivo: ${formatCOP(cash)}`, 400, currentY + 6, { align: "right", width: 150 });
              } else if (transfer > 0) {
                  doc.text(`Transferencia ${transferRef ? `(${transferRef})` : ""}: ${formatCOP(transfer)}`, 400, currentY + 6, { align: "right", width: 150 });
              }
          }

          const totalPaid = cash + transfer;
          const change = totalPaid - total;
          
          if (change > 0 && !isCredit) {
            let offset = 22;
            if (cash > 0 && transfer > 0) offset = 38;
            doc.text(`Cambio entregado: ${formatCOP(change)}`, 400, doc.y + offset, { align: "right", width: 150 });
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
        
      // Exportar Recibo de Caja PDF
      ipcMain.handle("export-sale-receipt-pdf", async (event, { id, receivedBy }) => {
        try {
          const sale = db.getSaleById(id);
          if (!sale) return { success: false, message: "Venta no encontrada" };
          
          // Asignar consecutivo si no tiene
          const receiptNumber = db.assignReceiptNumber(id);
          
          const company = db.getCompanySettings() || {};
          const client = sale.client_id ? db.getClientById(sale.client_id) : null;
          const clientName = client ? client.name : "Consumidor Final";

          const { filePath, canceled } = await dialog.showSaveDialog({
            defaultPath: `Recibo-${receiptNumber}.pdf`,
            filters: [{ name: "PDF", extensions: ["pdf"] }],
          });
          if (canceled || !filePath) return { success: false, message: "Exportación cancelada" };

          const doc = new PDFDocument({ margin: 50, size: "A4" });
          const stream = fs.createWriteStream(filePath);
          doc.pipe(stream);

          // Variables de posición
          let y = 50; // Posición vertical inicial
          const xLeft = 50;
          const xCol1 = 160; // Columna de datos
          const xRight = 350; // Columna derecha (Encabezado recibo)

          /* ================= ENCABEZADO ================= */
          
          // Logo (Si existe)
          if (company.logo_path && fs.existsSync(company.logo_path)) {
            try {
              doc.image(company.logo_path, xLeft, y, { width: 60 });
            } catch(e) {}
          }

          // Datos de la Empresa (Lado Izquierdo - al lado del logo)
          const textX = xLeft + 70;
          doc.font("Helvetica-Bold").fontSize(12).text(company.company_name || "", textX, y);
          doc.font("Helvetica").fontSize(9).text(`NIT: ${company.company_id_card_or_nit || ""}`, textX, y + 15);
          doc.text(company.company_address || "Dirección Principal", textX, y + 27);
          doc.text(`Tel: ${company.company_phone || ""} ${company.company_email ? "| " + company.company_email : ""}`, textX, y + 39);

          // Datos del Recibo (Lado Derecho)
          let yHeaderRight = 50; 
          doc.font("Helvetica-Bold").fontSize(14).text(`RECIBO DE CAJA`, xRight, yHeaderRight, { align: "right", width: 200 });
          doc.fontSize(12).text(`No. ${receiptNumber}`, xRight, yHeaderRight + 20, { align: "right", width: 200 });
          
          doc.font("Helvetica").fontSize(9);
          doc.text(`Fecha: ${sale.sale_date}`, xRight, yHeaderRight + 40, { align: "right", width: 200 });
          doc.text(`Página: 1 de 1`, xRight, yHeaderRight + 52, { align: "right", width: 200 });

          y = 110; 
          drawLine(doc, y);

          /* ================= INFORMACIÓN GENERAL ================= */
          y += 15;
          const lineHeight = 16;

          // Fila 1: Recibimos de
          doc.font("Helvetica-Bold").fontSize(10).text("Recibimos de:", xLeft, y);
          doc.font("Helvetica").text(clientName, xCol1, y);
          
          // Fila 2: NIT / CC
          y += lineHeight;
          doc.font("Helvetica-Bold").text("NIT / CC:", xLeft, y);
          doc.font("Helvetica").text(client ? (client.id_card_or_nit || "—") : "—", xCol1, y);

          y += 8;
          drawLine(doc, y + 10);
          y += 20;

          // Fila 3: Concepto
          doc.font("Helvetica-Bold").text("Concepto:", xLeft, y);
          doc.font("Helvetica").text(`Pago de Factura de Venta No. ${sale.invoice_number || sale.id}`, xCol1, y);

          // Fila 4: Caja
          y += lineHeight;
          doc.font("Helvetica-Bold").text("Caja:", xLeft, y);
          doc.font("Helvetica").text("Caja Principal", xCol1, y);

          // Fila 5: Factura Referencia
          y += lineHeight;
          doc.font("Helvetica-Bold").text("Factura:", xLeft, y);
          doc.font("Helvetica").text(sale.invoice_number || `POS-${sale.id}`, xCol1, y);

          y += 8;
          drawLine(doc, y + 10);

          /* ================= TABLA DE DETALLE ================= */
          y += 25;
          
          doc.font("Helvetica-Bold").fontSize(10).text("DETALLE DE PAGO", xLeft, y);
          y += 15;
          
          // Encabezados
          doc.rect(xLeft, y, 500, 20).fillColor("#f0f0f0").fill();
          doc.fillColor("#000000");

          const colY = y + 6;
          const col1 = 60;  // Fecha
          const col2 = 160; // Medio
          const col3 = 300; // Documento
          const col4 = 540; // Valor (Right aligned anchor)

          doc.font("Helvetica-Bold").fontSize(9);
          doc.text("Fecha", col1, colY);
          doc.text("Medio", col2, colY);
          doc.text("Documento", col3, colY);
          doc.text("Valor", col4 - 100, colY, { width: 100, align: "right" });

          y += 20; 

          // Usar paid_amount para reflejar el valor real ingresado (sin cambio)
          const totalPaid = sale.paid_amount || 0;
          
          let paymentMethod = "Efectivo";
          if (sale.cash_payment > 0 && sale.transfer_payment > 0) paymentMethod = "Mixto";
          else if (sale.transfer_payment > 0) paymentMethod = "Transferencia";

          doc.font("Helvetica").fontSize(9);
          doc.text(sale.sale_date.split(" ")[0], col1, y + 5);
          doc.text(paymentMethod, col2, y + 5);
          doc.text("-", col3, y + 5);
          doc.text(formatCOP(totalPaid), col4 - 100, y + 5, { width: 100, align: "right" });

          y += 25;
          drawLine(doc, y);

          /* ================= TOTALES ================= */
          y += 15;

          doc.font("Helvetica-Bold").fontSize(11);
          doc.text("TOTAL RECIBIDO:", 300, y);
          doc.text(formatCOP(totalPaid), col4 - 100, y, { width: 100, align: "right" });

          y += 20;
          doc.font("Helvetica-Oblique").fontSize(9);
          const totalLetras = numeroALetras(totalPaid);
          doc.text(`En letras: ${totalLetras}`, xLeft, y);

          y += 10;
          drawLine(doc, y + 10);

          /* ================= OBSERVACIONES ================= */
          y += 25;
          doc.font("Helvetica-Bold").fontSize(9).text("Observaciones:", xLeft, y);
          doc.font("Helvetica").text(sale.notes || "Sin observaciones adicionales.", xLeft, y + 12);

          /* ================= FIRMAS ================= */
          y = y + 80; 
          
          doc.moveTo(xLeft, y).lineTo(220, y).stroke();
          doc.moveTo(330, y).lineTo(500, y).stroke();

          y += 5;
          doc.font("Helvetica").fontSize(8);
          
          doc.text("Revisado por:", xLeft, y);
          doc.text(receivedBy || "Administrador", xLeft, y + 10, { width: 170, align: "center" });

          doc.text("Firma y Sello", 330, y);
          doc.text("Empresa / Cajero", 330, y + 10, { width: 170, align: "center" });

          doc.end();
          await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); });
          return { success: true, message: "Recibo de caja generado correctamente", filePath };
        } catch (err) {
          return { success: false, message: "Error al generar recibo: " + err.message };
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

            const doc = new PDFDocument({ margin: 50, size: "A4" });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            renderPdfHeader(doc, company, "COTIZACIÓN", quote.quote_number || `No. ${String(id).padStart(3, "0")}`, quote.quote_date ? quote.quote_date.split(" ")[0] : "");

            if (client) {
                doc.fontSize(11).font("Helvetica-Bold").text("Cliente:", 50, doc.y + 10);
                doc.font("Helvetica").fontSize(10);
                doc.text(`Nombre: ${client.name || ""}`);
                doc.text(`NIT/Cédula: ${client.id_card_or_nit || ""}`);
                doc.text(`Dirección: ${client.address || ""}`);
                doc.text(`Email: ${client.email || ""}`);
                doc.text(`Teléfono: ${client.phone || ""}`);
                doc.moveDown(1);
            }

            let y = doc.y + 10;
            y = drawTableHeaders(doc, y, [
                { text: "#", x: 50, width: 25 },
                { text: "Nombre", x: 80, width: 250 },
                { text: "Precio", x: 340, width: 80, align: "right" },
                { text: "Cant.", x: 430, width: 50, align: "right" },
                { text: "Subtotal", x: 490, width: 70, align: "right" }
            ]);
            doc.font("Helvetica").fontSize(9);
            let idx = 1;
            for (const it of items) {
                const productText = it.product_name || "-";;
                const productHeight = doc.heightOfString(productText, { width: 255 });
                const lineHeight = Math.max(20, productHeight + 25);

                if (y + lineHeight > doc.page.height - doc.page.margins.bottom - 40) {
                    doc.addPage();
                    y = 40;
                    y = drawTableHeaders(doc, y, [
                        { text: "#", x: 50, width: 25 },
                        { text: "Nombre", x: 80, width: 250 },
                        { text: "Precio", x: 340, width: 80, align: "right" },
                        { text: "Cant.", x: 430, width: 50, align: "right" },
                        { text: "Subtotal", x: 490, width: 70, align: "right" }
                    ]);
                    doc.font("Helvetica").fontSize(9);
                }

                const currentY = y;
                doc.text(String(idx), 50, currentY, { width: 25 });
                doc.text(productText, 80, currentY, { width: 250 });
                doc.text(formatCOP(it.price), 340, currentY, { align: "right", width: 80 });
                doc.text(String(it.quantity), 430, currentY, { align: "right", width: 50 });
                doc.text(formatCOP(it.subtotal), 490, currentY, { align: "right", width: 70 });
                y += lineHeight;
                idx++;
            }

            const subtotal = items.reduce((acc, it) => acc + (Number(it.subtotal) || Number(it.price) * Number(it.quantity) || 0), 0);
            const iva = includeIva ? Math.round(subtotal * 0.19) : 0;
            const total = subtotal + iva;

            doc.moveDown(1);
            if (includeIva) {
                doc.fontSize(10).text(`Subtotal: ${formatCOP(subtotal)}`, 400, y + 6, { align: "right", width: 150 });
                doc.text(`IVA (19%): ${formatCOP(iva)}`, 400, y + 22, { align: "right", width: 150 });
                doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 42, { align: "right", width: 150 });
            } else {
                doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 10, { align: "right", width: 150 });
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
                    const totalInventoryValue = products.reduce((acc, p) => acc + (Number(p.stock) * Number(p.purchase_price || 0)), 0);

                    const { filePath, canceled } = await dialog.showSaveDialog({
                        title: "Guardar reporte PDF",
                        defaultPath: "inventario.pdf",
                        filters: [{ name: "PDF", extensions: ["pdf"] }],
                    });
                    if (canceled || !filePath) return { success: false, message: "No se seleccionó archivo" };

                    const doc = new PDFDocument({ margin: 50, size: "A4" });
                    const stream = fs.createWriteStream(filePath);
                    doc.pipe(stream);

                    renderPdfHeader(doc, company, "REPORTE DE INVENTARIO", "", new Date().toLocaleDateString());

                    let y = doc.y + 10;
                    y = drawTableHeaders(doc, y, [
                        { text: "Código", x: 50, width: 60 },
                        { text: "Nombre", x: 120, width: 160 },
                        { text: "Categoría", x: 290, width: 100 },
                        { text: "Venta", x: 400, width: 80, align: "right" },
                        { text: "Stock", x: 490, width: 60, align: "right" }
                    ]);

                    doc.font("Helvetica").fontSize(10);
                    for (const p of products) {
                        doc.text(p.code || "", 50, y, { width: 60 });
                        doc.text(p.name || "", 120, y, { width: 160 });
                        doc.text(p.category || "", 290, y, { width: 100 });
                        doc.text(formatCOP(p.sale_price || 0), 400, y, { width: 80, align: "right" });
                        doc.text(String(p.stock || 0), 490, y, { width: 60, align: "right" });
                        y += 28;
                        if (y > 700) { doc.addPage(); y = 40; }
                    }

                    // --- Agregar el valor total del inventario al PDF ---
                    doc.moveDown(2);
                    doc.font("Helvetica-Bold").fontSize(12);
                    doc.text("Valor Total del Inventario (Costo):", 50, doc.y, { align: "right", width: 300 });
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
            const totalInventoryValue = products.reduce((acc, p) => acc + (Number(p.stock) * Number(p.purchase_price || 0)), 0);

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
                name: "VALOR TOTAL DEL INVENTARIO (COSTO)",
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

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      renderPdfHeader(doc, company, "ORDEN DE COMPRA", order.po_number || `No. ${order.id}`, order.order_date ? order.order_date.split(" ")[0] : "");

      // Datos del proveedor
      doc.fontSize(11).font("Helvetica-Bold").text("Proveedor:", 50, doc.y + 10);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Nombre: ${order.supplier_name || ""}`);
      doc.text(`Dirección: ${order.supplier_address || ""}`);
      doc.text(`Teléfono: ${order.supplier_phone || ""}`);
      doc.moveDown(1);

      // Notas de la orden
      if (order.notes) {
        doc.fontSize(10).font("Helvetica-Oblique").text(`Nota: ${order.notes}`, 50, doc.y, { width: 500 });
        doc.moveDown(1);
      }

      let y = doc.y + 10;
      y = drawTableHeaders(doc, y, [
          { text: "Producto", x: 50, width: 280 },
          { text: "Cant.", x: 340, width: 60, align: "right" },
          { text: "Precio Unit.", x: 410, width: 70, align: "right" },
          { text: "Subtotal", x: 490, width: 70, align: "right" }
      ]);

      doc.font("Helvetica").fontSize(10);
      for (const it of order.items) {
        const productHeight = doc.heightOfString(it.product_name || "-", { width: 280 });
        if (y + productHeight > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
          y = 40;
        }
        doc.text(it.product_name || "-", 50, y, { width: 280 });
        doc.text(String(it.quantity), 340, y, { align: "right", width: 60 });
        doc.text(formatCOP(it.price), 410, y, { align: "right", width: 70 });
        doc.text(formatCOP(it.subtotal), 490, y, { align: "right", width: 70 });
        y += productHeight + 5;
      }

      if (order.include_iva) {
        const total = order.total_amount;
        const subtotal = total / 1.19;
        const iva = total - subtotal;

        doc.font("Helvetica").fontSize(10);
        doc.text(`Subtotal: ${formatCOP(subtotal)}`, 400, y + 10, { align: "right", width: 160 });
        doc.text(`IVA (19%): ${formatCOP(iva)}`, 400, y + 25, { align: "right", width: 160 });
        doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(total)}`, 400, y + 40, { align: "right", width: 160 });
      } else {
        doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(order.total_amount)}`, 400, y + 20, { align: "right", width: 160 });
      }

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