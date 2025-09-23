const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
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

  // sales
  createSale: (data) => ipcRenderer.invoke("create-sale", data),
  getSales: () => ipcRenderer.invoke("get-sales"),
  getSaleById: (id) => ipcRenderer.invoke("get-sale-by-id", id),
  getSaleItems: (id) => ipcRenderer.invoke("get-sale-items", id),
  deleteSale: (id) => ipcRenderer.invoke("delete-sale", id),
  deleteSaleItem: (id) => ipcRenderer.invoke("delete-sale-item", id),
  getLastInvoiceNumber: () => ipcRenderer.invoke("get-last-invoice-number"),
  setInvoiceNumber: (id, invoiceNumber) =>
    ipcRenderer.invoke("set-invoice-number", { id, invoiceNumber }),
  exportInvoicePDF: (id, includeIva) =>
    ipcRenderer.invoke("export-invoice-pdf", { id, includeIva }),

  // credits ⚠️ <-- AGREGAR ESTO
getCredits: (searchTerm = "") => ipcRenderer.invoke("get-credits", searchTerm),
addCreditPayment: (saleId, amount) => ipcRenderer.invoke("add-credit-payment", saleId, amount),
markCreditAsPaid: (saleId) => ipcRenderer.invoke("mark-credit-as-paid", saleId),

  // quotes
  createQuote: (data) => ipcRenderer.invoke("create-quote", data),
  getQuotes: () => ipcRenderer.invoke("get-quotes"),
  getQuoteById: (id) => ipcRenderer.invoke("get-quote-by-id", id),
  getQuoteItems: (id) => ipcRenderer.invoke("get-quote-items", id),
  deleteQuote: (id) => ipcRenderer.invoke("delete-quote", id),
  getLastQuoteNumber: () => ipcRenderer.invoke("get-last-quote-number"),
  setQuoteNumber: (id, quoteNumber) =>
    ipcRenderer.invoke("set-quote-number", { id, quoteNumber }),
  exportQuotePDF: (id, quote_number, includeIva = false) =>
    ipcRenderer.invoke("export-quote-pdf", { id, quote_number, includeIva }),

  // settings
  getCompanySettings: () => ipcRenderer.invoke("get-company-settings"),
  updateCompanySettings: (data) => ipcRenderer.invoke("update-company-settings", data),

  // dashboard
  getDashboardData: () => ipcRenderer.invoke("get-dashboard-data"),

  // reset
  resetDatabase: () => ipcRenderer.invoke("reset-database"),

  // reports
  getSalesReport: (params) => ipcRenderer.invoke("get-sales-report", params),
  exportSalesReportPDF: (params) => ipcRenderer.invoke("export-sales-report-pdf", params),

  //Impresión
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printInvoice: (data) => ipcRenderer.invoke("print-invoice", data),
  previewInvoice: (data) => ipcRenderer.invoke("preview-invoice", data),
  getCompanyLogo: () => ipcRenderer.invoke("get-company-logo")
});
