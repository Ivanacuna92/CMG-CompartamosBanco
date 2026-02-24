// utils/dateUtils.js
// Utilidades de fechas para la escalera de negociación

// Días festivos bancarios de México 2026
const BANK_HOLIDAYS_2026 = [
  "2026-01-01", // Año Nuevo
  "2026-02-02", // Día de la Constitución
  "2026-03-16", // Natalicio de Benito Juárez
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-09-16", // Día de la Independencia
  "2026-11-02", // Día de Muertos
  "2026-11-16", // Revolución Mexicana
  "2026-12-25", // Navidad
];

const ALL_HOLIDAYS = new Set(BANK_HOLIDAYS_2026);

/**
 * Convierte una fecha a string YYYY-MM-DD en zona horaria de México
 */
function toDateStr(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Verifica si una fecha es día hábil (Lun-Vie, no festivo bancario)
 */
export function isBusinessDay(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  return !ALL_HOLIDAYS.has(toDateStr(d));
}

/**
 * Obtiene el siguiente día hábil a partir de una fecha
 */
export function getNextBusinessDay(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Obtiene la fecha de hoy en zona horaria de México
 */
export function getTodayMX() {
  const now = new Date();
  const mx = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  mx.setHours(12, 0, 0, 0);
  return mx;
}

/**
 * Formatea una fecha a formato legible en español
 */
export function formatDateES(date) {
  const d = new Date(date);
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Valida si una fecha de pago propuesta es válida
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @param {string} diaPago - Día límite del mes (ej: "15")
 * @param {number} maxBusinessDays - Máximo de días hábiles permitidos (default 2)
 * @returns {{ valid: boolean, reason?: string }}
 */
export function isValidPaymentDate(dateStr, diaPago, maxBusinessDays = 2) {
  const proposed = new Date(dateStr + "T12:00:00");
  const today = getTodayMX();
  today.setHours(0, 0, 0, 0);

  if (isNaN(proposed.getTime())) {
    return { valid: false, reason: "la fecha no es válida" };
  }

  if (proposed < today) {
    return { valid: false, reason: "esa fecha ya pasó" };
  }

  if (!isBusinessDay(proposed)) {
    const next = getNextBusinessDay(proposed);
    return {
      valid: false,
      reason: `ese día no es hábil, el siguiente día hábil es ${formatDateES(next)}`,
    };
  }

  // Verificar que no rebase el día de pago del mes en curso
  const diaPagoNum = parseInt(diaPago);
  if (diaPagoNum && proposed.getDate() > diaPagoNum && proposed.getMonth() === today.getMonth()) {
    return {
      valid: false,
      reason: `el pago debe realizarse antes del día ${diaPago} del mes`,
    };
  }

  // Verificar que esté dentro del plazo de días hábiles
  let businessDayCount = 0;
  const check = new Date(today);
  check.setHours(12, 0, 0, 0);
  while (check <= proposed) {
    if (isBusinessDay(check)) businessDayCount++;
    check.setDate(check.getDate() + 1);
  }
  if (businessDayCount > maxBusinessDays + 1) {
    return {
      valid: false,
      reason: `el plazo máximo es de ${maxBusinessDays} días hábiles`,
    };
  }

  return { valid: true };
}

/**
 * Calcula el calendario de parcialidades
 * @param {number} totalAmount - Monto total a dividir
 * @param {"weekly"|"biweekly"} planType - Tipo de plan
 * @param {Date} startDate - Fecha de inicio
 * @param {string} diaPago - Día límite del mes
 * @returns {Array<{ number: number, date: string, dateFormatted: string, amount: number }>}
 */
export function calculateInstallmentDates(totalAmount, planType, startDate, diaPago) {
  const numPayments = planType === "weekly" ? 3 : 2;
  const daysBetween = planType === "weekly" ? 7 : 10;
  const paymentBase = Math.floor((totalAmount / numPayments) * 100) / 100;

  const payments = [];
  let currentDate = getNextBusinessDay(new Date(startDate));

  for (let i = 0; i < numPayments; i++) {
    if (i > 0) {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + daysBetween);
      currentDate = getNextBusinessDay(currentDate);
    }

    // Último pago absorbe el residuo
    const amount =
      i === numPayments - 1
        ? Math.round((totalAmount - paymentBase * (numPayments - 1)) * 100) / 100
        : paymentBase;

    payments.push({
      number: i + 1,
      date: toDateStr(currentDate),
      dateFormatted: formatDateES(currentDate),
      amount,
    });
  }

  return payments;
}
