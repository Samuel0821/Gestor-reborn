const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  exportLowStockPDF: () => ipcRenderer.invoke("export-low-stock-pdf"),
  getLowStockProducts: () => ipcRenderer.invoke("get-low-stock-products"),
  approveQuote: (quoteId) => ipcRenderer.invoke("approve-quote", quoteId),
  exportInventoryPDF: () => ipcRenderer.invoke("export-inventory-pdf"),
  exportInventoryExcel: () => ipcRenderer.invoke("export-inventory-excel"),
  exportSalesReportPDF: (salesReport, companyInfo, filename) =>
  ipcRenderer.invoke("export-sales-report-pdf", { salesReport, companyInfo, filename }),

  // clients
  getClients: () => ipcRenderer.invoke("get-clients"),
  getClientById: (id) => ipcRenderer.invoke("get-client-by-id", id),
  saveClient: (data) => ipcRenderer.invoke("save-client", data),
  updateClient: (data) => ipcRenderer.invoke("update-client", data),
  deleteClient: (id) => ipcRenderer.invoke("delete-client", id),

  // products
  getProducts: () => ipcRenderer.invoke("get-products"),
  getProductById: (id) => ipcRenderer.invoke("get-product-by-id", id),
  addProduct: (data) => ipcRenderer.invoke("add-product", data),
  updateProduct: (data) => ipcRenderer.invoke("update-product", data),
  deleteProduct: (id) => ipcRenderer.invoke("delete-product", id),
  getCategories: () => ipcRenderer.invoke("get-categories"),
  getInventory: () => ipcRenderer.invoke("get-inventory"),

  // suppliers
  getSuppliers: () => ipcRenderer.invoke("get-suppliers"),
  getSupplierById: (id) => ipcRenderer.invoke("get-supplier-by-id", id),
  saveSupplier: (data) => ipcRenderer.invoke("save-supplier", data),
  updateSupplier: (data) => ipcRenderer.invoke("update-supplier", data),
  deleteSupplier: (id) => ipcRenderer.invoke("delete-supplier", id),
  exportSuppliersExcel: () => ipcRenderer.invoke("export-suppliers-excel"),
  exportSuppliersPDF: () => ipcRenderer.invoke("export-suppliers-pdf"),
  getSuppliersCount: () => ipcRenderer.invoke("get-suppliers-count"),

  // sales
  createSale: (data) => ipcRenderer.invoke("create-sale", data),
  getSales: (limit, offset, clientId) => ipcRenderer.invoke("get-sales", limit, offset, clientId),
  getSaleById: (id) => ipcRenderer.invoke("get-sale-by-id", id),
  getSaleItems: (id) => ipcRenderer.invoke("get-sale-items", id),
  deleteSale: (id) => ipcRenderer.invoke("delete-sale", id),
  updateSale: (data) => ipcRenderer.invoke("update-sale", data),
  deleteSaleItem: (id) => ipcRenderer.invoke("delete-sale-item", id),
  getLastInvoiceNumber: () => ipcRenderer.invoke("get-last-invoice-number"),
  setInvoiceNumber: (id, invoiceNumber) =>
    ipcRenderer.invoke("set-invoice-number", { id, invoiceNumber }),
  exportInvoicePDF: (id, includeIva) =>
    ipcRenderer.invoke("export-invoice-pdf", { id, includeIva }),
  exportSaleReceiptPDF: (id, receivedBy) =>
    ipcRenderer.invoke("export-sale-receipt-pdf", { id, receivedBy }),

  // credits ⚠️ <-- AGREGAR ESTO
getCredits: (searchTerm = "") => ipcRenderer.invoke("get-credits", searchTerm),
addCreditPayment: (saleId, amount, method, reference) => ipcRenderer.invoke("add-credit-payment", saleId, amount, method, reference),
markCreditAsPaid: (saleId, method, reference) => ipcRenderer.invoke("mark-credit-as-paid", saleId, method, reference),

  // Purchase Orders
  createPurchaseOrder: (data) => ipcRenderer.invoke("create-purchase-order", data),
  getPurchaseOrders: () => ipcRenderer.invoke("get-purchase-orders"),
  getPurchaseOrderById: (id) => ipcRenderer.invoke("get-purchase-order-by-id", id),
  updatePurchaseOrder: (data) => ipcRenderer.invoke("update-purchase-order", data),
  exportPurchaseOrderPDF: (id) => ipcRenderer.invoke("export-purchase-order-pdf", id),
  receivePurchaseOrder: (id) => ipcRenderer.invoke("receive-purchase-order", id),
  deletePurchaseOrder: (id) => ipcRenderer.invoke("delete-purchase-order", id),
  getPurchaseOrdersCount: () => ipcRenderer.invoke("get-purchase-orders-count"),
  
  // --- GESTIÓN DE PAGOS A PROVEEDORES (NUEVO) ---
  updatePurchaseInvoiceNumber: (id, invoiceNumber) => ipcRenderer.invoke("update-purchase-invoice-number", { id, invoiceNumber }),
  addPurchasePayment: (data) => ipcRenderer.invoke("add-purchase-payment", data),
  getPurchasePayments: (orderId) => ipcRenderer.invoke("get-purchase-payments", orderId),
  getRetentionsReport: (filters) => ipcRenderer.invoke("get-retentions-report", filters),
  getDuePurchaseOrders: () => ipcRenderer.invoke("get-due-purchase-orders"),

  // quotes
  createQuote: (data) => ipcRenderer.invoke("create-quote", data),
  getQuotes: (clientId) => ipcRenderer.invoke("get-quotes", clientId),
  getQuoteById: (id) => ipcRenderer.invoke("get-quote-by-id", id),
  getQuoteItems: (id) => ipcRenderer.invoke("get-quote-items", id),
  deleteQuote: (id) => ipcRenderer.invoke("delete-quote", id),
  getLastQuoteNumber: () => ipcRenderer.invoke("get-last-quote-number"),
  setQuoteNumber: (id, quoteNumber) =>
    ipcRenderer.invoke("set-quote-number", { id, quoteNumber }),
  exportQuotePDF: (id, quote_number, includeIva = false) =>
    ipcRenderer.invoke("export-quote-pdf", { id, quote_number, includeIva }),
  createSaleFromQuote: (data) => 
    ipcRenderer.invoke("create-sale-from-quote", data),
  updateQuoteDetails: (data) => 
    ipcRenderer.invoke("update-quote-details", data),

  // services
  getServices: () => ipcRenderer.invoke("get-services"),
  getServiceById: (id) => ipcRenderer.invoke("get-service-by-id", id),
  createService: (data) => ipcRenderer.invoke("create-service", data),
  updateService: (data) => ipcRenderer.invoke("update-service", data),
  deleteService: (id) => ipcRenderer.invoke("delete-service", id),

  // users
  login: (creds) => ipcRenderer.invoke("login", creds),
  getUsers: () => ipcRenderer.invoke("get-users"),
  createUser: (data) => ipcRenderer.invoke("create-user", data),
  updateUser: (data) => ipcRenderer.invoke("update-user", data),
  deleteUser: (id) => ipcRenderer.invoke("delete-user", id),

  // support
  sendSupportTicket: (data) => ipcRenderer.invoke("send-support-ticket", data),

  // settings
  getCompanySettings: () => ipcRenderer.invoke("get-company-settings"),
  updateCompanySettings: (data) => ipcRenderer.invoke("update-company-settings", data),

  // dashboard
  getDashboardData: () => ipcRenderer.invoke("get-dashboard-data"),
  getSalesLastDays: (days) => ipcRenderer.invoke("get-sales-last-days", days),
  getAdvancedDashboardStats: () => ipcRenderer.invoke("get-advanced-dashboard-stats"),
  getRecentActivity: () => ipcRenderer.invoke("get-recent-activity"),

  // reset
  resetDatabase: () => ipcRenderer.invoke("reset-database"),

  // reports
  getSalesReport: (params) => ipcRenderer.invoke("get-sales-report", params),
  exportSalesReportPDF: (params) => ipcRenderer.invoke("export-sales-report-pdf", params),

  // expenses
  getExpenses: (startDate, endDate) => ipcRenderer.invoke('get-expenses', startDate, endDate),
  getExpenseById: (id) => ipcRenderer.invoke('get-expense-by-id', id),
  exportExpensePDF: (id) => ipcRenderer.invoke('export-expense-pdf', id),
  exportExpensesReportPDF: (startDate, endDate) => ipcRenderer.invoke('export-expenses-report-pdf', { startDate, endDate }),
  saveExpense: (expense) => ipcRenderer.invoke('save-expense', expense),
  deleteExpense: (id) => ipcRenderer.invoke('delete-expense', id),

  // Auditoría
  getAuditLogs: (params) => ipcRenderer.invoke("get-audit-logs", params),
  logAction: (data) => ipcRenderer.invoke("log-action", data),

  //Impresión
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printInvoice: (data) => ipcRenderer.invoke("print-invoice", data),
  previewInvoice: (data) => ipcRenderer.invoke("preview-invoice", data),
  getCompanyLogo: () => ipcRenderer.invoke("get-company-logo"),

// Caja registradora
openCashRegister: (openingBalance) => 
    ipcRenderer.invoke("open-cash-register", openingBalance),

  getActiveCashSession: () => 
    ipcRenderer.invoke("get-active-cash-session"),

  addCashMovement: (sessionId, type, amount, description) => 
    ipcRenderer.invoke("add-cash-movement", { sessionId, type, amount, description }),

  closeCashRegister: (realClosingBalance) => 
    ipcRenderer.invoke("close-cash-register", realClosingBalance),

  getCashRegisterSessions: () => 
    ipcRenderer.invoke("get-cash-register-sessions"),

  getCashMovements: (sessionId) => 
    ipcRenderer.invoke("get-cash-movements", sessionId),
});
