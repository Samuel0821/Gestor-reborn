const { contextBridge, ipcRenderer } = require("electron");

let remoteToken = null;
const apiUrlArgument = process.argv.find(argument => argument.startsWith("--gestorfx-api-url="));
let apiUrl = process.env.GESTORFX_API_URL || (apiUrlArgument ? apiUrlArgument.slice("--gestorfx-api-url=".length) : "");
const localOnlyChannels = new Set(["select-file", "get-printers", "preview-invoice", "print-invoice"]);
try { remoteToken = sessionStorage.getItem("gestorfx_api_session"); } catch (_) {}

async function invoke(channel, ...args) {
  if (!apiUrl || localOnlyChannels.has(channel)) return ipcRenderer.invoke(channel, ...args);
  if (channel === "update-company-settings" && args[0] && args[0].logo_path && !/^data:image\//i.test(args[0].logo_path)) {
    const upload = await ipcRenderer.invoke("read-file-for-upload", args[0].logo_path);
    args[0] = { ...args[0], logo_upload: upload };
  }
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/rpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(remoteToken ? { Authorization: `Bearer ${remoteToken}` } : {}),
    },
    body: JSON.stringify({ channel, args }),
  });
  const payload = await response.json();
  if (response.status === 401) {
    remoteToken = null;
    try { sessionStorage.removeItem("gestorfx_api_session"); } catch (_) {}
  }
  if (!response.ok) throw new Error(payload.error || "No se pudo conectar con el servidor.");
  if (payload.fileDownload) {
    const saved = await ipcRenderer.invoke("save-remote-export", payload.fileDownload);
    if (!saved.success) {
      payload.result = { ...(payload.result || {}), success: false, message: saved.message || "Exportación cancelada.", filePath: null };
    } else if (payload.result && typeof payload.result === "object") {
      payload.result.filePath = saved.filePath;
    }
  }
  if (channel === "login") {
    remoteToken = payload.sessionToken || null;
    try {
      if (remoteToken) sessionStorage.setItem("gestorfx_api_session", remoteToken);
      else sessionStorage.removeItem("gestorfx_api_session");
    } catch (_) {}
    return payload.result;
  }
  return payload.result;
}

contextBridge.exposeInMainWorld("api", {
  exportLowStockPDF: () => invoke("export-low-stock-pdf"),
  getLowStockProducts: () => invoke("get-low-stock-products"),
  approveQuote: (quoteId) => invoke("approve-quote", quoteId),
  exportInventoryPDF: () => invoke("export-inventory-pdf"),
  exportInventoryExcel: () => invoke("export-inventory-excel"),
  exportSalesReportPDF: (salesReport, companyInfo, filename) =>
  invoke("export-sales-report-pdf", { salesReport, companyInfo, filename }),

  // clients
  getClients: () => invoke("get-clients"),
  getClientById: (id) => invoke("get-client-by-id", id),
  saveClient: (data) => invoke("save-client", data),
  updateClient: (data) => invoke("update-client", data),
  deleteClient: (id) => invoke("delete-client", id),

  // products
  getProducts: () => invoke("get-products"),
  getProductById: (id) => invoke("get-product-by-id", id),
  addProduct: (data) => invoke("add-product", data),
  updateProduct: (data) => invoke("update-product", data),
  deleteProduct: (id) => invoke("delete-product", id),
  getCategories: () => invoke("get-categories"),
  getInventory: () => invoke("get-inventory"),
  getInventoryMovements: (productId, limit = 100) => invoke("get-inventory-movements", productId, limit),
  getInventoryLots: (productId) => invoke("get-inventory-lots", productId),
  getExpirationAlerts: (days = 30, status = 'all') => invoke("get-expiration-alerts", { days, status }),
  getProductFormConfig: () => invoke("get-product-form-config"),
  getBusinessModuleConfig: () => invoke("get-business-module-config"),

  // suppliers
  getSuppliers: () => invoke("get-suppliers"),
  getSupplierById: (id) => invoke("get-supplier-by-id", id),
  saveSupplier: (data) => invoke("save-supplier", data),
  updateSupplier: (data) => invoke("update-supplier", data),
  deleteSupplier: (id) => invoke("delete-supplier", id),
  exportSuppliersExcel: () => invoke("export-suppliers-excel"),
  exportSuppliersPDF: () => invoke("export-suppliers-pdf"),
  getSuppliersCount: () => invoke("get-suppliers-count"),

  // sales
  createSale: (data) => invoke("create-sale", data),
  getSales: (limit, offset, clientId, searchTerm, statusFilter) => invoke("get-sales", limit, offset, clientId, searchTerm, statusFilter),
  getSaleById: (id) => invoke("get-sale-by-id", id),
  getSaleItems: (id) => invoke("get-sale-items", id),
  annulSale: (id) => invoke("annul-sale", id), // Nuevo manejador para anular
  deleteSale: (id) => invoke("delete-sale", id),
  updateSale: (data) => invoke("update-sale", data),
  deleteSaleItem: (id) => invoke("delete-sale-item", id),
  getLastInvoiceNumber: () => invoke("get-last-invoice-number"),
  setInvoiceNumber: (id, invoiceNumber) =>
    invoke("set-invoice-number", { id, invoiceNumber }),
  exportInvoicePDF: (id, includeIva) =>
    invoke("export-invoice-pdf", { id, includeIva }),
  exportSaleReceiptPDF: (id, receivedBy, observations) =>
    invoke("export-sale-receipt-pdf", { id, receivedBy, observations }),

  // credits
  getCredits: (searchTerm = "", onlyPending = true, limit = -1, offset = 0) => invoke("get-credits", searchTerm, onlyPending, limit, offset),
  addCreditPayment: (saleId, amount, method, reference) => invoke("add-credit-payment", saleId, amount, method, reference),
  getSalePayments: (saleId) => invoke("get-sale-payments", saleId),
  exportPaymentReceiptPDF: (paymentId, type) => invoke("export-payment-receipt-pdf", { paymentId, type }),
  previewPaymentReceiptPDF: (paymentId, type) => invoke("export-payment-receipt-pdf", { paymentId, type, preview: true }),
  getPaymentReceiptPreview: (paymentId, type) => invoke("get-payment-receipt-preview", { paymentId, type }),
  markCreditAsPaid: (saleId, method, reference) => invoke("mark-credit-as-paid", saleId, method, reference),

  // Purchase Orders
  createPurchaseOrder: (data) => invoke("create-purchase-order", data),
  getPurchaseOrders: () => invoke("get-purchase-orders"),
  getPurchaseOrderById: (id) => invoke("get-purchase-order-by-id", id),
  updatePurchaseOrder: (data) => invoke("update-purchase-order", data),
  exportPurchaseOrderPDF: (id) => invoke("export-purchase-order-pdf", id),
  receivePurchaseOrder: (id) => invoke("receive-purchase-order", id),
  deletePurchaseOrder: (id) => invoke("delete-purchase-order", id),
  getPurchaseOrdersCount: () => invoke("get-purchase-orders-count"),
  
  // --- GESTIÓN DE PAGOS A PROVEEDORES (NUEVO) ---
  updatePurchaseInvoiceNumber: (data) => invoke("update-purchase-invoice-number", data),
  addPurchasePayment: (data) => invoke("add-purchase-payment", data),
  getPurchasePayments: (orderId) => invoke("get-purchase-payments", orderId),
  getRetentionsReport: (filters) => invoke("get-retentions-report", filters),
  getDuePurchaseOrders: () => invoke("get-due-purchase-orders"),

  // quotes
  createQuote: (data) => invoke("create-quote", data),
  getQuotes: (clientId, searchTerm) => invoke("get-quotes", clientId, searchTerm),
  getQuoteById: (id) => invoke("get-quote-by-id", id),
  getQuoteItems: (id) => invoke("get-quote-items", id),
  deleteQuote: (id) => invoke("delete-quote", id),
  getLastQuoteNumber: () => invoke("get-last-quote-number"),
  setQuoteNumber: (id, quoteNumber) =>
    invoke("set-quote-number", { id, quoteNumber }),
  exportQuotePDF: (id, quote_number, includeIva = false) =>
    invoke("export-quote-pdf", { id, quote_number, includeIva }),
  createSaleFromQuote: (data) => 
    invoke("create-sale-from-quote", data),
  updateQuoteDetails: (data) => 
    invoke("update-quote-details", data),

  // services
  getServices: (limit, offset, status, executionStatus, searchTerm = "") => invoke("get-services", limit, offset, status, executionStatus, searchTerm),
  getServiceById: (id) => invoke("get-service-by-id", id),
  createService: (data) => invoke("create-service", data),
  updateService: (data) => invoke("update-service", data),
  deleteService: (id) => invoke("delete-service", id),
  updateServiceStatus: (id, status) => invoke("update-service-status", { id, status }),
  cancelService: (id) => invoke("cancel-service", id),
  addServicePayment: (data) => invoke("add-service-payment", data),
  getServicePayments: (serviceId) => invoke("get-service-payments", serviceId),
  markServicePerformed: (id) => invoke("mark-service-performed", id),
  getPendingScheduledServices: () => invoke("get-pending-scheduled-services"),
  getOpenServicesList: () => invoke("get-open-services-list"),

  // users
  login: (creds) => invoke("login", creds),
  getUsers: () => invoke("get-users"),
  createUser: (data) => invoke("create-user", data),
  updateUser: (data) => invoke("update-user", data),
  deleteUser: (id) => invoke("delete-user", id),

  // support
  sendSupportTicket: (data) => invoke("send-support-ticket", data),

  // settings
  getCompanySettings: () => invoke("get-company-settings"),
  getBusinessTypes: () => invoke("get-business-types"),
  updateBusinessType: (businessTypeId) => invoke("update-business-type", businessTypeId),
  getInstallationState: () => invoke("get-installation-state"),
  saveInitialSetup: (data) => invoke("save-initial-setup", data),
  getLicenseState: () => invoke("get-license-state"),
  activateLicense: (data) => invoke("activate-license", data),
  updateCompanySettings: (data) => invoke("update-company-settings", data),

  // dashboard
  getDashboardData: () => invoke("get-dashboard-data"),
  getSalesLastDays: (days) => invoke("get-sales-last-days", days),
  getAdvancedDashboardStats: () => invoke("get-advanced-dashboard-stats"),
  getRecentActivity: () => invoke("get-recent-activity"),

  // reset
  resetDatabase: () => invoke("reset-database"),

  // reports
  getSalesReport: (params) => invoke("get-sales-report", params),
  exportSalesReportPDF: (params) => invoke("export-sales-report-pdf", params),

  // expenses
  getExpenses: (startDate, endDate) => invoke('get-expenses', startDate, endDate),
  getExpenseById: (id) => invoke('get-expense-by-id', id),
  exportExpensePDF: (id) => invoke('export-expense-pdf', id),
  exportExpensesReportPDF: (startDate, endDate) => invoke('export-expenses-report-pdf', { startDate, endDate }),
  saveExpense: (expense) => invoke('save-expense', expense),
  updateExpense: (expense) => invoke('update-expense', expense),
  deleteExpense: (id) => invoke('delete-expense', id),

  // Auditoría
  getAuditLogs: (params) => invoke("get-audit-logs", params),
  logAction: (data) => invoke("log-action", data),

  //Impresión
  getPrinters: () => invoke("get-printers"),
  printInvoice: (data) => invoke("print-invoice", data),
  previewInvoice: (data) => invoke("preview-invoice", data),
  getCompanyLogo: () => invoke("get-company-logo"),

  // Caja registradora (Cash Register Module)
  openCashRegister: (data) => invoke("open-cash-register", data),
  getActiveCashSession: () => invoke("get-active-cash-session"),
  // legacy alias used by some scripts/tests
  getActiveSession: () => invoke("get-active-cash-session"),
  addCashMovementManual: (data) => invoke("add-cash-movement-manual", data),
  closeCashRegister: (data) => invoke("close-cash-register", data),
  getCashRegisterSessions: () => invoke("get-cash-register-sessions"),
  getCashMovements: (sessionId) => invoke("get-cash-movements", sessionId),
  getCashMovementsDetailed: (sessionId) => invoke("get-cash-movements-detailed", sessionId),
  getSalesForSession: (sessionId) => invoke("get-sales-for-session", sessionId),
  getExpensesForSession: (sessionId) => invoke("get-expenses-for-session", sessionId),
  getPurchasePaymentsForSession: (sessionId) => invoke("get-purchase-payments-for-session", sessionId),
  getServicePaymentsForSession: (sessionId) => invoke("get-service-payments-for-session", sessionId),
  getCreditPaymentsForSession: (sessionId) => invoke("get-credit-payments-for-session", sessionId),
  saveReconciliationDetails: (data) => invoke("save-reconciliation-details", data),
  getReconciliationDetails: (sessionId) => invoke("get-reconciliation-details", sessionId),
  exportCashRegisterReportPDF: (sessionId) => invoke("export-cash-register-report-pdf", sessionId),
  // Event: notify renderers when cash-related data changes elsewhere
  onCashDataUpdated: (callback) => ipcRenderer.on('cash-data-updated', (event, data) => callback(data)),
});
