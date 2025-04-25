// utils/helpers.js
export function accountInquiryDetected(message) {
    return /cuenta|pago|dinero|apgos|promesa|contrato/i.test(message);
  }
  