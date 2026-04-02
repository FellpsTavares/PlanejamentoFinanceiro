import api from './api';

const downloadPdf = async (url, filename, params = {}) => {
  const response = await api.get(url, { responseType: 'blob', params });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};

const fetchPdfBlob = async (url, params = {}) => {
  const response = await api.get(url, { responseType: 'blob', params });
  return response.data;
};

export const reportsService = {
  downloadFinancePdf: async (params = {}) => downloadPdf('/reports/finance-pdf/', 'relatorio_financeiro.pdf', params),
  downloadTransportPdf: async (params = {}) => downloadPdf('/reports/transport-pdf/', 'relatorio_transportadora.pdf', params),
  downloadInvestmentsPdf: async (params = {}) => downloadPdf('/reports/investments-pdf/', 'relatorio_investimentos.pdf', params),
  fetchFinancePdf: async (params = {}) => fetchPdfBlob('/reports/finance-pdf/', params),
  fetchTransportPdf: async (params = {}) => fetchPdfBlob('/reports/transport-pdf/', params),
  fetchInvestmentsPdf: async (params = {}) => fetchPdfBlob('/reports/investments-pdf/', params),
};
