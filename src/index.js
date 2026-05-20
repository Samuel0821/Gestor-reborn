  // ---------- DEPENDENCIAS PRINCIPALES ----------
  const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
  const path = require("node:path");
  
  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  if (require('electron-squirrel-startup')) app.quit();
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

      width: 1300, // Aumentar un poco el ancho para el nuevo módulo
      height: 800,
      icon: path.join(__dirname, "logo", "gestorfx_logof.ico"), // <-- El ícono va aquí
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Eliminar la barra de menú por defecto (Archivo, Vista, etc.)
    mainWindow.setMenu(null);

    // Siempre iniciar en login.html
    mainWindow.loadFile(path.join(__dirname, "views", "login.html"));

    // Push current cash session to renderer once the page finishes loading
    mainWindow.webContents.on('did-finish-load', () => {
      try {
        const s = cashRegister.getActiveSession();
        if (s && mainWindow) mainWindow.webContents.send('cash-data-updated', { sessionId: s.id });
      } catch (e) { /* ignore */ }
    });

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

  function renderPdfHeader(doc, company = {}, title = "", docNumber = "", dateTimeStr = "") {
    const xLeft = 50;
    const xRight = 300; 
    let y = 50;

    let datePart = '';
    let timePart = '';
    if (dateTimeStr) {
      const parts = dateTimeStr.split(' ');
      datePart = parts[0];
      timePart = parts.length > 1 ? parts[1] : '';
    }


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
    if (datePart) {
      doc.font("Helvetica").fontSize(9).text(`Fecha: ${datePart}`, xRight, yHeaderRight + 40, { align: "right", width: 250 });
      if (timePart) {
        doc.text(`Hora: ${timePart}`, xRight, yHeaderRight + 52, { align: "right", width: 250 });
      }
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
      // Autenticación
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
      ipcMain.handle("get-sales", (event, limit, offset, clientId, searchTerm, statusFilter) => db.getSales(limit, offset, clientId, searchTerm, statusFilter));
      ipcMain.handle("get-sale-by-id", (event, id) => db.getSaleById(id));
      ipcMain.handle("get-sale-items", (event, id) => db.getSaleItems(id));
      ipcMain.handle("annul-sale", (event, id) => {
        const res = db.annulSale(id);
        try { if (mainWindow) {
          const s = cashRegister.getActiveSession();
          mainWindow.webContents.send('cash-data-updated', { type: 'sale_annulled', id, sessionId: s ? s.id : null });
        } } catch(e){}
        return res;
      }); // Registrar manejador para anular
      ipcMain.handle("delete-sale", (event, id) => {
        const res = db.deleteSale(id);
        try { if (mainWindow) {
          const s = cashRegister.getActiveSession();
          mainWindow.webContents.send('cash-data-updated', { type: 'sale_deleted', id, sessionId: s ? s.id : null });
        } } catch(e){}
        return res;
      });
      ipcMain.handle("update-sale", (event, data) => db.updateSale(data));

      ipcMain.handle("delete-sale-item", (event, id) => db.deleteSaleItem(id));
      ipcMain.handle("get-last-invoice-number", () => db.getLastInvoiceNumber());
      ipcMain.handle("set-invoice-number", (event, { id, invoiceNumber }) => db.setInvoiceNumber(id, invoiceNumber));

      // Caja registradora
      ipcMain.handle("open-cash-register", (event, { openingBalance, userId, userName, openingNotes }) => cashRegister.openCashRegister(openingBalance, userId, userName, openingNotes));
      ipcMain.handle("get-active-cash-session", () => cashRegister.getActiveSession());
      ipcMain.handle("add-cash-movement-manual", (event, { sessionId, type, sub_type, amount, description }) => cashRegister.addCashMovement(sessionId, type, sub_type, amount, description));
      ipcMain.handle("close-cash-register", (event, { realClosingBalance, closedByUserId, closedByUserName, closingNotes }) => cashRegister.closeCashRegister(realClosingBalance, closedByUserId, closedByUserName, closingNotes));
      ipcMain.handle("get-cash-register-sessions", () => cashRegister.getCashRegisterSessions());
      ipcMain.handle("get-cash-movements", (event, sessionId) => cashRegister.getCashMovements(sessionId));
      ipcMain.handle("get-cash-movements-detailed", (event, sessionId) => cashRegister.getCashMovementsDetailed(sessionId));
      ipcMain.handle("get-sales-for-session", (event, sessionId) => cashRegister.getSalesForSession(sessionId));
      ipcMain.handle("get-expenses-for-session", (event, sessionId) => cashRegister.getExpensesForSession(sessionId));
      ipcMain.handle("get-purchase-payments-for-session", (event, sessionId) => cashRegister.getPurchasePaymentsForSession(sessionId));
      ipcMain.handle("get-service-payments-for-session", (event, sessionId) => cashRegister.getServicePaymentsForSession(sessionId));
      ipcMain.handle("get-credit-payments-for-session", (event, sessionId) => cashRegister.getCreditPaymentsForSession(sessionId));
      ipcMain.handle("save-reconciliation-details", (event, { sessionId, denominations }) => cashRegister.saveReconciliationDetails(sessionId, denominations));
      ipcMain.handle("get-reconciliation-details", (event, sessionId) => cashRegister.getReconciliationDetails(sessionId));
      ipcMain.handle("export-cash-register-report-pdf", async (event, sessionId) => exportCashRegisterReportPDF(sessionId));
      
      // Gestión de Créditos

      ipcMain.handle("get-credits", async (event, searchTerm, onlyPending, limit, offset) => db.getCredits(searchTerm, onlyPending, limit, offset));
      ipcMain.handle("add-credit-payment", async (event, saleId, amount, method, reference) => {
        const res = db.addCreditPayment(saleId, amount, method, reference);
        try { if (mainWindow) {
          const s = cashRegister.getActiveSession();
          mainWindow.webContents.send('cash-data-updated', { type: 'credit_payment_added', saleId, amount, method, sessionId: s ? s.id : null });
        } } catch(e){}
        return res;
      });
      ipcMain.handle("mark-credit-as-paid", async (event, saleId, method, reference) => {
        const res = db.markCreditAsPaid(saleId, method, reference);
        try { if (mainWindow) {
          const s = cashRegister.getActiveSession();
          mainWindow.webContents.send('cash-data-updated', { type: 'credit_marked_paid', saleId, sessionId: s ? s.id : null });
        } } catch(e){}
        return res;
      });
      ipcMain.handle("get-sale-payments", (event, saleId) => db.getSalePayments(saleId));
      
      ipcMain.handle("export-payment-receipt-pdf", async (event, { paymentId, type }) => {
        try {
          const company = db.getCompanySettings() || {};
          let payment, parentData, client, headerTitle, conceptLabel, conceptText, additionalDetails = {};

          if (type === 'credit') {
            const creditDetails = db.getSalePaymentDetailsForPdf(paymentId);
            if (!creditDetails) return { success: false, message: "Detalles del abono no encontrados" };

            payment = creditDetails.payment;
            parentData = creditDetails.sale;
            client = { name: creditDetails.client_name };
            
            additionalDetails = {
                balanceBefore: creditDetails.balanceBefore,
                balanceAfter: creditDetails.balanceAfter
            };

            headerTitle = "RECIBO DE CAJA (ABONO)";
            conceptLabel = "Recibimos de:";
            conceptText = `Abono a Factura No. ${parentData.invoice_number || parentData.id}`;
          } else if (type === 'service') {
            const serviceDetails = db.getServicePaymentDetailsForPdf(paymentId);
            if (!serviceDetails) return { success: false, message: "Detalles del abono no encontrados" };

            payment = serviceDetails.payment;
            parentData = serviceDetails.service;
            client = { name: serviceDetails.client_name };
            
            additionalDetails = {
                balanceBefore: serviceDetails.balanceBefore,
                balanceAfter: serviceDetails.balanceAfter,
                totalCost: serviceDetails.totalCost
            };

            headerTitle = "RECIBO DE CAJA (ABONO)";
            conceptLabel = "Recibimos de:";
            conceptText = `Abono a Servicio: ${parentData.name} (ID: ${parentData.id})`;
          } else if (type === 'purchase') {
            const paymentDetails = db.getPurchasePaymentDetailsForPdf(paymentId);
            if (!paymentDetails) return { success: false, message: "Detalles de pago de compra no encontrados." };
            
            payment = paymentDetails.payment;
            parentData = paymentDetails.order; // Esto es la purchase_order
            client = { name: paymentDetails.supplier_name }; // El "cliente" es el proveedor

            additionalDetails = {
              total_po_amount: paymentDetails.real_total,
              balance_before_payment: paymentDetails.balance_before_payment,
              outstanding_balance_after_payment: paymentDetails.outstanding_balance_after_payment,
              payment_notes: payment.notes,
              retention_amount: payment.retention_amount,
              retention_type: payment.retention_type
            };
            headerTitle = "COMPROBANTE DE EGRESO";
            conceptLabel = "Proveedor:";
            conceptText = `Pago a Factura Prov. No. ${parentData.supplier_invoice_number || 'S/N'} - OC #${parentData.po_number || parentData.id}`;
          }

          const { filePath, canceled } = await dialog.showSaveDialog({
            title: type === 'purchase' ? "Guardar Comprobante de Egreso" : "Guardar Recibo de Caja",
            defaultPath: `${type === 'purchase' ? 'Egreso' : 'Recibo'}-${type}-${paymentId}.pdf`,
            filters: [{ name: "PDF", extensions: ["pdf"] }],
          });
          if (canceled || !filePath) return { success: false };

          const doc = new PDFDocument({ margin: 50, size: "A4" });
          const stream = fs.createWriteStream(filePath);
          doc.pipe(stream);

          renderPdfHeader(doc, company, headerTitle, `No. ${paymentId}`, payment.created_at);

          let currentY = doc.y + 10;
          doc.fontSize(10).font("Helvetica-Bold").text(conceptLabel, 50, currentY);
          doc.font("Helvetica").text(client ? client.name : "Consumidor Final", 150, currentY);
          currentY += 18;
          
          doc.font("Helvetica-Bold").text("Concepto:", 50, currentY);
          doc.font("Helvetica").text(conceptText, 150, currentY);
          currentY += 18;

          doc.font("Helvetica-Bold").text("Medio de Pago:", 50, currentY);
          doc.font("Helvetica").text(`${payment.method} ${payment.reference ? `(Ref: ${payment.reference})` : ''}`, 150, currentY);
          currentY += 30;

          doc.rect(50, currentY, 500, 25).fillColor("#f0f0f0").fill();
          const amountLabel = type === 'purchase' ? "VALOR PAGADO:" : "VALOR RECIBIDO:";
          doc.fillColor("black").font("Helvetica-Bold").text(amountLabel, 60, currentY + 8);
          doc.fontSize(12).text(formatCOP(payment.amount), 400, currentY + 7, { align: "right", width: 140 });
          
          doc.y = currentY + 35; // Avanzar el cursor después de la caja

          // Detalles financieros para recibos de crédito o servicio
          if (type === 'credit' || type === 'service') {
            doc.moveDown(1);
            doc.fontSize(10).font("Helvetica");
            let summaryY = doc.y;
            
            const labelTotal = type === 'credit' ? 'Total de la Factura:' : 'Costo Total Servicio:';
            const totalAmount = type === 'credit' ? parentData.total_amount : additionalDetails.totalCost;

            doc.font("Helvetica-Bold").text(labelTotal, 50, summaryY);
            doc.font("Helvetica").text(formatCOP(totalAmount), 180, summaryY);
            
            doc.text(`Saldo anterior:`, 340, summaryY);
            doc.text(formatCOP(additionalDetails.balanceBefore), 450, summaryY, { align: "right", width: 90 });
            summaryY += 15;
            
            doc.font("Helvetica-Bold").text(`Abono:`, 340, summaryY);
            doc.text(formatCOP(payment.amount), 450, summaryY, { align: "right", width: 90 });
            summaryY += 13;
            
            doc.strokeColor("#000").lineWidth(0.5).moveTo(340, summaryY).lineTo(540, summaryY).stroke();
            summaryY += 5;
            
            doc.font("Helvetica-Bold").text(`Saldo pendiente:`, 340, summaryY);
            doc.text(formatCOP(additionalDetails.balanceAfter), 450, summaryY, { align: "right", width: 90 });
            
            // Mostrar fecha de vencimiento y días restantes si es un crédito
            if (type === 'credit' && parentData.due_date && additionalDetails.balanceAfter > 0) {
                summaryY += 20;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const due = new Date(parentData.due_date);
                due.setHours(0, 0, 0, 0);
                const diffTime = due - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let daysText = diffDays < 0 ? `(Vencido hace ${Math.abs(diffDays)} días)` : 
                               diffDays === 0 ? `(Vence hoy)` : `(Faltan ${diffDays} días para vencer)`;
                
                doc.fontSize(9).font("Helvetica-Bold").text(`Vencimiento factura: ${parentData.due_date} ${daysText}`, 50, summaryY);
            }

            doc.y = summaryY + 20; 
          }

          // Detalles adicionales para pagos de compra
          if (type === 'purchase') {
            doc.fontSize(10).font("Helvetica-Bold").text("Detalles del Pago a Proveedor:", 50, doc.y + 15);
            doc.font("Helvetica").fontSize(9);
            let currentDetailY = doc.y + 15;

            // Columna izquierda de detalles
            doc.text(`Proveedor: ${client.name}`, 50, currentDetailY);
            doc.text(`Orden de Compra #: ${parentData.po_number || parentData.id}`, 50, currentDetailY + 12);
            doc.text(`Factura Proveedor #: ${parentData.supplier_invoice_number || 'N/A'}`, 50, currentDetailY + 24);
            doc.font("Helvetica-Bold").text(`Total Factura: ${formatCOP(additionalDetails.total_po_amount)}`, 50, currentDetailY + 36);
            
            // Columna derecha de detalles financieros
            doc.font("Helvetica").text(`Saldo Anterior: ${formatCOP(additionalDetails.balance_before_payment)}`, 300, currentDetailY);
            doc.text(`Retención: ${additionalDetails.retention_amount > 0 ? formatCOP(additionalDetails.retention_amount) : '$0'}`, 300, currentDetailY + 12);
            doc.font("Helvetica-Bold").text(`Monto Pagado: ${formatCOP(payment.amount)}`, 300, currentDetailY + 24);
            doc.text(`Saldo Pendiente: ${formatCOP(additionalDetails.outstanding_balance_after_payment)}`, 300, currentDetailY + 36);

            doc.y = currentDetailY + 50; // Ajustar la posición Y para el siguiente contenido

            if (additionalDetails.payment_notes) {
              doc.moveDown(0.5); // Pequeño espacio
              doc.font("Helvetica-Bold").text("Notas del Pago:", 50, doc.y); // Etiqueta
              doc.font("Helvetica").text(additionalDetails.payment_notes, 50, doc.y + 12, { width: 500 }); // Contenido
            }
            doc.moveDown(2); // Espacio adicional después de los detalles
          }

          // Valor en letras siempre al final del monto principal
          doc.fontSize(9).font("Helvetica-Oblique").text(`Valor en Letras: ${numeroALetras(payment.amount)}`, 50, doc.y + 10);
          doc.y += 25; 


          // Espacio para firmas
          doc.moveDown(3);
          const signatureY = doc.y;
          doc.strokeColor("#000").lineWidth(1);
          
          doc.moveTo(50, signatureY).lineTo(200, signatureY).stroke();
          doc.fontSize(8).font("Helvetica").text("Firma Cliente / Recibido", 50, signatureY + 5, { width: 150, align: "center" });
          
          doc.moveTo(350, signatureY).lineTo(500, signatureY).stroke();
          doc.text("Sello y Firma Autorizada", 350, signatureY + 5, { width: 150, align: "center" });

          // Nota al pie
          if (type === 'service' || type === 'credit') {
            doc.moveDown(4);
            doc.fontSize(7).font("Helvetica-Oblique").fillColor("#666");
            doc.text(`Este documento es un comprobante de abono y no constituye una factura de venta definitiva. Generado por ${company.company_name || 'GestorFX'}.`, 50, doc.page.height - 60, { align: "center", width: 500 });
          }

          doc.end();
          return { success: true, filePath };
        } catch (err) {
          return { success: false, message: err.message };
        }
      });

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
      ipcMain.handle("update-purchase-invoice-number", (event, { id, invoiceNumber, discountAmount }) => db.updatePurchaseInvoiceNumber(id, invoiceNumber, discountAmount)); // No cambia
      ipcMain.handle("add-purchase-payment", (event, data) => {
        const res = db.addPurchasePayment(data);
        try { if (mainWindow) {
          const s = cashRegister.getActiveSession();
          mainWindow.webContents.send('cash-data-updated', { type: 'purchase_payment_added', data, sessionId: s ? s.id : null });
        } } catch(e){}
        return res;
      });
      ipcMain.handle("get-purchase-payments", (event, orderId) => db.getPurchasePayments(orderId));
      ipcMain.handle("get-retentions-report", (event, filters) => db.getRetentionsReport(filters));
      ipcMain.handle("get-due-purchase-orders", () => db.getDuePurchaseOrders());

      // Cotizaciones
      ipcMain.handle("create-quote", (event, data) => db.createQuote(data));
      ipcMain.handle("get-quotes", (event, clientId, searchTerm) => db.getQuotes(clientId, searchTerm));
      ipcMain.handle("get-quote-by-id", (event, id) => db.getQuoteById(id));
      ipcMain.handle("get-quote-items", (event, id) => db.getQuoteItems(id));
      ipcMain.handle("delete-quote", (event, id) => db.deleteQuote(id));
      ipcMain.handle("get-last-quote-number", () => db.getLastQuoteNumber());
      ipcMain.handle("set-quote-number", (event, { id, quoteNumber }) => db.setQuoteNumber(id, quoteNumber));
      ipcMain.handle("create-sale-from-quote", (event, data) => db.createSaleFromQuote(data));
      ipcMain.handle("update-quote-details", (event, data) => db.updateQuoteDetails(data));

      // Servicios
      ipcMain.handle("get-services", (event, limit, offset, status, executionStatus) => db.getServices(limit, offset, status, executionStatus));
      ipcMain.handle("get-service-by-id", (event, id) => db.getServiceById(id));
      ipcMain.handle("create-service", (event, data) => db.createService(data));
      ipcMain.handle("update-service", (event, data) => db.updateService(data));
      ipcMain.handle("delete-service", (event, id) => db.deleteService(id));
      ipcMain.handle("update-service-status", (event, { id, status }) => db.updateServiceStatus(id, status));
      ipcMain.handle("cancel-service", (event, id) => db.cancelService(id));
      ipcMain.handle("add-service-payment", (event, { serviceId, amount, method, reference }) => {
        const res = db.addServicePayment(serviceId, amount, method, reference);
        try { if (mainWindow) {
          const s = cashRegister.getActiveSession();
          mainWindow.webContents.send('cash-data-updated', { type: 'service_payment_added', serviceId, amount, method, sessionId: s ? s.id : null });
        } } catch(e){}
        return res;
      });
      ipcMain.handle("get-service-payments", (event, serviceId) => db.getServicePayments(serviceId));
      ipcMain.handle("mark-service-performed", (event, id) => db.markServicePerformed(id));
      ipcMain.handle("get-pending-scheduled-services", () => db.getPendingScheduledServices());
      ipcMain.handle("get-open-services-list", () => db.getOpenServicesList());

      // Usuarios
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
      ipcMain.handle('save-expense', async (event, expense) => {
        const res = db.saveExpense(expense);
        try { if (mainWindow) {
          const s = cashRegister.getActiveSession();
          mainWindow.webContents.send('cash-data-updated', { type: 'expense_saved', id: res && res.id ? res.id : null, sessionId: s ? s.id : null });
        } } catch(e){}
        return res;
      });
      ipcMain.handle('delete-expense', async (event, id) => {
        const res = db.deleteExpense(id);
        try { if (mainWindow) {
          const s = cashRegister.getActiveSession();
          mainWindow.webContents.send('cash-data-updated', { type: 'expense_deleted', id, sessionId: s ? s.id : null });
        } } catch(e){}
        return res;
      });
      
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
            
            renderPdfHeader(doc, company, "COMPROBANTE DE EGRESO", `No. ${String(id).padStart(4, '0')}`, expense.created_at);
            
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

            // Punto 4: Si es Pago Proveedores, mostrar detalles
            if (expense.category === 'Pago Proveedores' && expense.details) {
                try {
                    const details = JSON.parse(expense.details);
                    y += 10; // Espacio antes del título de los detalles
                    doc.font("Helvetica-Bold").text("Detalles del Pago a Proveedor:", 50, y); // Imprime el título en la posición 'y'
                    // Avanza 'y' manualmente después del título (aprox. 15 unidades para el tamaño de fuente)
                    y += 15; 

                    let currentDetailY = y; // 'y' ahora es la posición correcta para la primera línea de detalles

                    // Columna izquierda de detalles
                    doc.font("Helvetica").fontSize(9);
                    doc.text(`Proveedor: ${details.supplier_name}`, 50, currentDetailY);
                    doc.text(`Orden de Compra #: ${details.po_number || details.po_id}`, 50, currentDetailY + 12);
                    doc.text(`Factura Proveedor #: ${details.supplier_invoice_number || 'N/A'}`, 50, currentDetailY + 24);
                    doc.font("Helvetica-Bold").text(`Total Factura: ${formatCOP(details.total_po_amount)}`, 50, currentDetailY + 36);
                    
                    // Columna derecha de detalles financieros
                    doc.font("Helvetica").text(`Saldo Anterior: ${formatCOP(details.balance_before_payment || (details.total_po_amount))}`, 300, currentDetailY);
                    doc.text(`Retención: ${details.retention_amount > 0 ? formatCOP(details.retention_amount) : '$0'}`, 300, currentDetailY + 12);
                    doc.font("Helvetica-Bold").text(`Monto Pagado: ${formatCOP(details.payment_amount)}`, 300, currentDetailY + 24);
                    doc.text(`Saldo Pendiente: ${formatCOP(details.outstanding_balance_after_payment)}`, 300, currentDetailY + 36);
                    
                    y = currentDetailY + 50; // Ajustar la posición Y para el siguiente contenido

                    if (details.payment_notes) { // Si hay notas, las mostramos
                      doc.font("Helvetica-Bold").text("Notas del Pago:", 50, y); // Etiqueta
                      doc.font("Helvetica").text(details.payment_notes, 50, y + 12, { width: 500 }); // Contenido
                      y += 25; // Espacio después de las notas
                    }
                    doc.moveDown(2); // Espacio adicional después de los detalles
                } catch (e) { console.error("Error parseando detalles de egreso de pago a proveedor:", e); }
            }

            // Punto 4: Si es devolución, mostrar detalles de productos
            if (expense.category === 'Devolución' && expense.details) {
                try {
                    const details = JSON.parse(expense.details);
                    y += 10;
                    doc.font("Helvetica-Bold").text(`Detalle de Devolución (Factura: ${details.invoice_number})`, labelX, y);
                    doc.font("Helvetica-Bold").text(`Cliente: ${details.client_name}`, labelX, y + 15);
                    y += 35;
                    
                    y = drawTableHeaders(doc, y, [
                        { text: "Producto", x: 50, width: 250 },
                        { text: "Cant.", x: 300, width: 50, align: "right" },
                        { text: "V. Unit", x: 360, width: 90, align: "right" },
                        { text: "Subtotal", x: 460, width: 90, align: "right" }
                    ]);
                    
                    doc.font("Helvetica").fontSize(9);
                    details.items.forEach(it => {
                        doc.text(it.product_name, 50, y);
                        doc.text(it.quantity.toString(), 300, y, { align: "right", width: 50 });
                        doc.text(formatCOP(it.price), 360, y, { align: "right", width: 90 });
                        doc.text(formatCOP(it.subtotal), 460, y, { align: "right", width: 90 });
                        y += 15;
                    });
                } catch (e) { console.error("Error parseando detalles de egreso:", e); }
            }

            y += 10;
            drawLine(doc, y);

            // Espacio para firma
            y += 80;
            doc.moveTo(50, y).lineTo(250, y).stroke();
            doc.fillColor("black").text("Recibió", 50, y + 5);
            
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
          const openServices = db.db.prepare("SELECT COUNT(*) as c FROM services WHERE status = 'Abierto'").get().c;

          return {
            openServices,
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
              let totalPrevious = 0;

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

                // Calcular abonos previos para esta venta
                const currentTransfer = sale.transfer_payment || 0;
                const currentCredit = sale.outstanding_balance || 0;
                const currentPrevious = Math.max(0, saleTotal - realCash - currentTransfer - currentCredit);
                totalPrevious += currentPrevious;

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
              if (totalPrevious > 0) {
                doc.text(`Abonos/Pagos Previos: ${formatCOP(totalPrevious)}`);
              }
              
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
            if (it.serial_number) { // Aseguramos que el serial se imprima en negro fuerte
                doc.fontSize(8).fillColor("#000000").text(`Serial: ${it.serial_number}`, 80, doc.y);
                doc.fontSize(10).fillColor("#000000"); // Restaurar formato
            }
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
          let currentY = doc.y + 20; // Inicializar currentY después de los totales y con un espacio
          
          // Obtener referencia de transferencia si existe
          let transferRef = "";
          try {
             const payments = db.db.prepare("SELECT * FROM sale_payments WHERE sale_id = ?").all(id);
             const tPayment = payments.find(p => p.method === "transfer");
             if (tPayment && tPayment.reference) transferRef = tPayment.reference;
          } catch(e) {}

          const cash = sale.cash_payment || 0;
          const transfer = sale.transfer_payment || 0;
          const abonosPrevios = (sale.paid_amount || 0) - (cash + transfer);
          const isCredit = sale.sale_type === "credit";
          
          doc.fontSize(11).font("Helvetica");
          // currentY ya está definido y posicionado después de los totales.
          // Lo usaremos como punto de partida y lo actualizaremos.

          const labelX = 350; // Posición X para las etiquetas (ej. "Abonos previos:")
          const valueX = 450; // Posición X para los valores (alineados a la derecha)
          const valueWidth = 100; // Ancho para los valores alineados a la derecha
          const lineHeight = 16; // Altura estándar de línea para los detalles de pago

          if (isCredit) {
              if (sale.paid_amount > 0) { // Si hay abonos previos
                  doc.text(`Abonos previos:`, labelX, currentY);
                  doc.text(formatCOP(sale.paid_amount), valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
                  doc.text(`Saldo pendiente a crédito:`, labelX, currentY);
                  doc.text(formatCOP(sale.outstanding_balance), valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
              } else { // Si no hay abonos previos
                  doc.text(`Venta a crédito:`, labelX, currentY);
                  doc.text(formatCOP(sale.total_amount), valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
              }

              if (sale.due_date) { // Si hay fecha de vencimiento, siempre en negrita
                  doc.font("Helvetica-Bold").text(`Vencimiento:`, labelX, currentY);
                  doc.text(sale.due_date, valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
              }
          } else {
              if (abonosPrevios > 0) {
                  doc.text(`Abonos previos:`, labelX, currentY);
                  doc.text(formatCOP(abonosPrevios), valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
              }
              if (cash > 0 && transfer > 0) {
                  doc.text(`Pago en efectivo:`, labelX, currentY);
                  doc.text(formatCOP(cash), valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
                  doc.text(`Transferencia ${transferRef ? `(${transferRef})` : ""}:`, labelX, currentY);
                  doc.text(formatCOP(transfer), valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
              } else if (cash > 0) {
                  doc.text(`Pago en efectivo:`, labelX, currentY);
                  doc.text(formatCOP(cash), valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
              } else if (transfer > 0) { // Solo transferencia
                  doc.text(`Transferencia ${transferRef ? `(${transferRef})` : ""}:`, labelX, currentY);
                  doc.text(formatCOP(transfer), valueX, currentY, { align: "right", width: valueWidth });
                  currentY += lineHeight;
              } else if (abonosPrevios > 0) {
                  // Este caso es para cuando hay abonosPrevios pero no pagos en efectivo/transferencia en esta transacción de venta.
                  // Típicamente significa que el servicio fue pagado por adelantado.
                  doc.font("Helvetica-Bold").fontSize(8).text("SERVICIO PAGADO POR ANTICIPADO", labelX, currentY, { align: "right", width: valueX + valueWidth - labelX });
                  currentY += lineHeight;
              }
          }

          const change = (sale.paid_amount || 0) - total;
          
          if (change > 0 && !isCredit) { // Solo mostrar cambio si es un valor positivo y no es crédito
            doc.text(`Cambio entregado:`, labelX, currentY);
            doc.text(formatCOP(change), valueX, currentY, { align: "right", width: valueWidth });
            currentY += lineHeight;
          }

          // 🔹 Notas / Observaciones al final del PDF
          // Añadir un espacio vertical antes de las notas
          currentY += 20; 
          let notesY = currentY;
          if (sale.notes) {
              if (notesY > 750) { doc.addPage(); notesY = 50; }
              doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444").text("NOTAS / OBSERVACIONES:", 50, notesY);
              notesY += 12;
              doc.font("Helvetica").fontSize(9).fillColor("#000000").text(sale.notes, 50, notesY, { width: 500, align: 'justify' });
              currentY = notesY + doc.heightOfString(sale.notes, { width: 500 });
          }

          // Marca de agua "ANULADA" si la venta está anulada
          if (sale.status === 'annulled') {
            doc.save(); // Guardar estado actual del documento
            doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] });
            doc.font("Helvetica-Bold").fontSize(80).fillColor('red').opacity(0.3).text('ANULADA', 0, doc.page.height / 2 - 40, { align: 'center' });
            doc.restore(); // Restaurar estado del documento
            doc.fillColor("black").opacity(1); // Restaurar color y opacidad para el resto del contenido
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
      ipcMain.handle("export-sale-receipt-pdf", async (event, { id, receivedBy, observations }) => {
        try {
          // Si se enviaron observaciones, actualizarlas en la BD primero
          if (observations !== undefined) {
            db.updateSaleNotes(id, observations);
          }

          const sale = db.getSaleById(id); // Obtener venta actualizada
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

            // 🔹 Notas / Observaciones al final del PDF
            y += includeIva ? 70 : 40; // Espacio después de los totales
            if (quote.notes) {
                if (y > 750) { doc.addPage(); y = 50; }
                doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444").text("NOTAS / OBSERVACIONES:", 50, y);
                y += 12;
                doc.font("Helvetica").fontSize(9).fillColor("#000000").text(quote.notes, 50, y, { width: 500, align: 'justify' });
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

      const discount = order.discount_amount || 0;
      const finalTotal = order.total_amount - discount;

      if (order.include_iva) {
        const subtotal = order.total_amount / 1.19;
        const iva = order.total_amount - subtotal;

        doc.font("Helvetica").fontSize(10);
        doc.text(`Subtotal: ${formatCOP(subtotal)}`, 400, y + 10, { align: "right", width: 160 });
        doc.text(`IVA (19%): ${formatCOP(iva)}`, 400, y + 25, { align: "right", width: 160 });
        
        if (discount > 0) {
            doc.text(`Descuento: -${formatCOP(discount)}`, 400, y + 40, { align: "right", width: 160 });
        }
        doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(finalTotal)}`, 400, y + (discount > 0 ? 55 : 40), { align: "right", width: 160 });
      } else {
        if (discount > 0) {
            doc.font("Helvetica").fontSize(10).text(`Descuento: -${formatCOP(discount)}`, 400, y + 10, { align: "right", width: 160 });
        }
        doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: ${formatCOP(finalTotal)}`, 400, y + (discount > 0 ? 25 : 20), { align: "right", width: 160 });
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

  async function exportCashRegisterReportPDF(sessionId) {
    try {
      const session = cashRegister.getCashRegisterSessions().find(s => s.id === sessionId);
      if (!session) return { success: false, message: "Sesión de caja no encontrada." };

      const company = db.getCompanySettings() || {};
      const movementsDetailed = cashRegister.getCashMovementsDetailed(sessionId);
      const reconciliationDetails = cashRegister.getReconciliationDetails(sessionId);

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "Guardar Reporte de Cierre de Caja",
        defaultPath: `Cierre_Caja_${session.id}_${session.closed_at_iso || new Date().toISOString().slice(0, 10)}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (canceled || !filePath) return { success: false, message: "Exportación cancelada." };

      const doc = new PDFDocument({ margin: 36, size: "A4" });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      renderPdfHeader(doc, company, "REPORTE DE CIERRE DE CAJA", `Sesión #${session.id}`, session.closed_at_iso || new Date().toLocaleString());

      let y = doc.y + 8;
      let pageCount = 1;
      const bottomLimit = doc.page.height - doc.page.margins.bottom - 40;
      let limitReached = false;

      function ensureSpace(h) {
        if (limitReached) return false;
        if (y + h > bottomLimit) {
          if (pageCount >= 3) { limitReached = true; return false; }
          doc.addPage();
          pageCount++;
          y = doc.page.margins.top;
        }
        return true;
      }

      // SECCIÓN 1 — INFORMACIÓN GENERAL
      doc.fontSize(10).font("Helvetica-Bold").text("1. Información General", 50, y);
      doc.fontSize(8).font("Helvetica");
      y += 10;
      doc.text(`Cajero: ${session.user_name || 'N/A'}`, 50, y);
      doc.text(`Fecha Apertura: ${new Date(session.opened_at_iso).toLocaleString()}`, 300, y);
      y += 12;
      doc.text(`Fecha Cierre: ${session.closed_at_iso ? new Date(session.closed_at_iso).toLocaleString() : 'Caja Abierta'}`, 50, y);
      doc.text(`Estado: ${session.status === 'open' ? 'Abierta' : 'Cerrada'}`, 300, y);
      y += 12;

      // SECCIÓN 2 — SALDO INICIAL
      if (!ensureSpace(60)) { doc.text('... (Detalles truncados)'); return { success: true, filePath }; }
      doc.fontSize(10).font("Helvetica-Bold").text("2. Saldo Inicial", 50, y);
      doc.fontSize(8).font("Helvetica");
      y += 10;
      doc.text(`Base Inicial: ${formatCOP(session.opening_balance)}`, 50, y);
      y += 12;
      doc.text(`Observaciones: ${session.opening_notes || 'N/A'}`, 50, y);
      y += 12;

      // Construir las mismas agregaciones que usa la UI para evitar discrepancias
      const sums = {
        in_cash: 0, in_transfer: 0,
        out_cash: 0, out_transfer: 0,
        sales_cash: 0, sales_transfer: 0,
        credit_cash: 0, credit_transfer: 0,
        service_cash: 0, service_transfer: 0,
        manual_in: 0, manual_out: 0,
        expense_cash: 0, expense_transfer: 0,
        purchase_cash: 0, purchase_transfer: 0,
        refund_cash: 0, refund_transfer: 0
      };

      movementsDetailed.forEach(m => {
        const amount = m.total_amount || 0;
        const st = (m.sub_type || '').toString();
        const isTransfer = /transfer/i.test(st) || st === 'transfer';
        const isCash = /cash/i.test(st) || (!/transfer/i.test(st) && /cash/i.test(st));

        if (m.type === 'in') {
          if (/sale/i.test(st)) {
            if (isTransfer) { sums.in_transfer += amount; sums.sales_transfer += amount; }
            else { sums.in_cash += amount; sums.sales_cash += amount; }
          } else if (/credit/i.test(st)) {
            if (isTransfer) { sums.in_transfer += amount; sums.credit_transfer += amount; }
            else { sums.in_cash += amount; sums.credit_cash += amount; }
          } else if (/service/i.test(st)) {
            if (isTransfer) { sums.in_transfer += amount; sums.service_transfer += amount; }
            else { sums.in_cash += amount; sums.service_cash += amount; }
          } else if (/manual_in|manual/i.test(st)) {
            sums.in_cash += amount; sums.manual_in += amount;
          } else {
            if (isTransfer) sums.in_transfer += amount; else sums.in_cash += amount;
          }
        } else if (m.type === 'out') {
          if (/expense/i.test(st)) {
            if (isTransfer) { sums.out_transfer += amount; sums.expense_transfer += amount; }
            else { sums.out_cash += amount; sums.expense_cash += amount; }
          } else if (/purchase/i.test(st)) {
            if (isTransfer) { sums.out_transfer += amount; sums.purchase_transfer += amount; }
            else { sums.out_cash += amount; sums.purchase_cash += amount; }
          } else if (/manual_out|manual/i.test(st)) {
            sums.out_cash += amount; sums.manual_out += amount;
          } else if (/refund/i.test(st)) {
            if (isTransfer) { sums.out_transfer += amount; sums.refund_transfer += amount; }
            else { sums.out_cash += amount; sums.refund_cash += amount; }
          } else {
            if (isTransfer) sums.out_transfer += amount; else sums.out_cash += amount;
          }
        }
      });

      // SECCIÓN 3 — RESUMEN DE INGRESOS
      ensureSpace(100);
      doc.fontSize(10).font("Helvetica-Bold").text("3. Resumen de Ingresos", 50, y);
      doc.fontSize(8).font("Helvetica"); y += 12;

      const drawTableLine = (label, cash, bank) => {
        doc.text(label, 50, y);
        doc.text(formatCOP(cash), 200, y, { width: 80, align: 'right' });
        doc.text(formatCOP(bank), 300, y, { width: 80, align: 'right' });
        doc.text(formatCOP(cash + bank), 400, y, { width: 100, align: 'right' });
        y += 10;
      };

      doc.font("Helvetica-Bold");
      doc.text("Concepto", 50, y); doc.text("Efectivo", 200, y, { width: 80, align: 'right' }); doc.text("Transferencia", 300, y, { width: 80, align: 'right' }); doc.text("Subtotal", 400, y, { width: 100, align: 'right' });
      y += 12; doc.font("Helvetica");

      drawTableLine("Ventas", sums.sales_cash, sums.sales_transfer);
      drawTableLine("Abonos Créditos", sums.credit_cash, sums.credit_transfer);
      drawTableLine("Abonos Servicios", sums.service_cash, sums.service_transfer);
      drawTableLine("Manuales / Otros", sums.manual_in, 0);
      
      y += 2; doc.rect(50, y, 450, 0.5).stroke(); y += 5;
      doc.font("Helvetica-Bold");
      drawTableLine("TOTAL INGRESOS", sums.in_cash, sums.in_transfer);
      y += 15;

      // SECCIÓN 4 — RESUMEN DE EGRESOS
      ensureSpace(60);
      doc.fontSize(10).font("Helvetica-Bold").text("4. Resumen de Egresos", 50, y);
      doc.fontSize(8).font("Helvetica"); y += 12;

      drawTableLine("Gastos Generales", sums.expense_cash, sums.expense_transfer);
      drawTableLine("Pagos Proveedores", sums.purchase_cash, sums.purchase_transfer);
      drawTableLine("Devoluciones / Manual", sums.refund_cash + sums.manual_out, sums.refund_transfer);

      y += 2; doc.rect(50, y, 450, 0.5).stroke(); y += 5;
      doc.font("Helvetica-Bold");
      drawTableLine("TOTAL EGRESOS", sums.out_cash, sums.out_transfer);
      y += 15;

      // SECCIÓN 5 — ARQUEO DE CAJA
      ensureSpace(110);
      doc.fontSize(10).font("Helvetica-Bold").text("5. Arqueo de Caja (Efectivo)", 50, y);
      doc.fontSize(8).font("Helvetica");
      y += 15;
      const computedExpected = (session.opening_balance || 0) + (sums.in_cash || 0) - (sums.out_cash || 0);
      const countedCash = (reconciliationDetails && reconciliationDetails.length > 0) ? reconciliationDetails.reduce((s, d) => s + (d.amount || 0), 0) : (session.closing_balance || 0);
      doc.text(`Efectivo Esperado: ${formatCOP(computedExpected)}`, 50, y);
      y += 12; // Mover hacia abajo para la siguiente línea
      doc.text(`Efectivo Contado: ${formatCOP(countedCash)}`, 50, y);
      
      const diff = countedCash - computedExpected;
      y += 12; // Mover hacia abajo antes de imprimir la diferencia
      doc.fillColor("black").text(`Diferencia: `, 50, y, { continued: true });
      
      if (diff === 0) {
        doc.text("0 (cuadre perfecto)");
      } else if (diff < 0) {
        doc.fillColor("red").text(`${formatCOP(diff)}`);
      } else {
        doc.fillColor("green").text(`${formatCOP(diff)}`);
      }
      doc.fillColor("black"); // Resetear color a negro para el texto subsiguiente
      y += 15; // Mover hacia abajo después de la diferencia, con un poco más de espacio
      if (reconciliationDetails && reconciliationDetails.length > 0) {
        doc.font("Helvetica-Bold").text("Detalle de Conteo:", 60, y);
        y += 10;
        reconciliationDetails.forEach(d => {
          doc.font("Helvetica").text(`- ${formatCOP(d.denomination)} x ${d.count} = ${formatCOP(d.amount)}`, 70, y);
          y += 10;
        });
        y += 8;
      }

      // SECCIÓN 6 — RESUMEN DE SALDOS
      ensureSpace(80);
      doc.fontSize(10).font("Helvetica-Bold").text("6. Resumen de Saldos Finales", 50, y);
      doc.fontSize(8).font("Helvetica");
      y += 15;
      doc.text(`(+) Base Inicial Efectivo: ${formatCOP(session.opening_balance)}`, 50, y);
      y += 12;
      doc.text(`(+) Total Ingresos Efectivo: ${formatCOP(sums.in_cash)}`, 50, y);
      y += 12;
      doc.text(`(-) Total Egresos Efectivo: ${formatCOP(sums.out_cash)}`, 50, y);
      y += 12;
      doc.font("Helvetica-Bold").text(`= SALDO EFECTIVO ESPERADO: ${formatCOP(computedExpected)}`, 50, y);
      
      y += 14;
      doc.font("Helvetica-Bold").text(`RESUMEN BANCO (TRANSFERENCIAS):`, 50, y);
      y += 12;
      doc.font("Helvetica").text(`Ingresos Banco: ${formatCOP(sums.in_transfer)}`, 50, y);
      doc.text(`Egresos Banco: ${formatCOP(sums.out_transfer)}`, 200, y);
      doc.text(`Saldo Neto Banco: ${formatCOP(sums.in_transfer - sums.out_transfer)}`, 350, y);

      y += 20;

      // SECCIÓN 7 — OBSERVACIONES
      ensureSpace(60);
      doc.fontSize(10).font("Helvetica-Bold").text("7. Observaciones del Cierre", 50, y);
      doc.fontSize(8).font("Helvetica");
      y += 15;
      doc.text(session.closing_notes || 'N/A', 50, y, { width: 500 });
      y += 20;

      if (limitReached) {
        doc.fillColor('red').fontSize(8).text('*** REPORTE RESUMIDO POR LÍMITE DE PÁGINAS ***', 50, y);
        y += 12;
      }

      // SECCIÓN 8 — AUDITORÍA
      ensureSpace(40);
      doc.fontSize(10).font("Helvetica-Bold").text("8. Auditoría", 50, y);
      doc.fontSize(8).font("Helvetica");
      y += 15;
      doc.text(`Usuario Apertura: ${session.user_name || 'N/A'}`, 50, y);
      doc.text(`Usuario Cierre: ${session.closed_by_user_name || 'N/A'}`, 300, y);
      y += 25;

      // Firmas
      doc.moveDown(1);
      const signatureY = doc.y;
      doc.strokeColor("#000").lineWidth(1);
      
      doc.moveTo(50, signatureY).lineTo(200, signatureY).stroke();
      doc.fontSize(8).font("Helvetica").text("Firma Cajero", 50, signatureY + 5, { width: 150, align: "center" });
      
      doc.moveTo(350, signatureY).lineTo(500, signatureY).stroke();
      doc.text("Firma Administrador", 350, signatureY + 5, { width: 150, align: "center" });

      doc.end();
      await new Promise((res, rej) => { stream.on("finish", res); stream.on("error", rej); });
      return { success: true, filePath };
    } catch (err) {
      console.error("Error exporting cash register report PDF:", err);
      return { success: false, message: "Error al exportar reporte de cierre de caja: " + (err.message || String(err)) };
    }
  }
 