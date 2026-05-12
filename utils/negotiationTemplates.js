// utils/negotiationTemplates.js
// Mensajes template para la Escalera de Negociación CPI-IA
// Basados en el manual de Negociación de Crédito Personal Compartamos Banco

import { S } from "./negotiationStates.js";
import { getTodayMX } from "./dateUtils.js";

/**
 * Formatea un monto numérico a formato monetario mexicano
 */
export function formatMoney(amount) {
  return parseFloat(amount || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Genera instrucciones de pago estándar
 */
function paymentMethods(cuenta, clabe) {
  return (
    `El pago lo debes de realizar directamente en las sucursales de Compartamos Banco ` +
    `a los 10 dígitos de tu número de crédito *${cuenta}* o a través de cualquier banca ` +
    `móvil como pago SPEI a la cuenta CLABE *${clabe}*.\n\n` +
    `Importante reportar tu comprobante de pago por este medio o al teléfono *5635519617* ` +
    `para evitar penalizaciones y detener inmediatamente actos de cobranza.`
  );
}

/**
 * Genera instrucciones de pago para liquidación con quita (requiere documentos)
 */
function paymentMethodsDocs(cuenta, clabe) {
  return (
    `El pago lo debes de realizar directamente en las sucursales de Compartamos Banco ` +
    `a los 10 dígitos de tu número de crédito *${cuenta}* o a través de cualquier banca ` +
    `móvil como pago SPEI a la cuenta CLABE *${clabe}*.\n\n` +
    `Con este pago liquidas tu deuda en convenio de pago menor, se actualiza tu buró de ` +
    `crédito y Compartamos Banco te hace entrega de tu carta de no adeudo.\n\n` +
    `Importante reportar los documentos requeridos: *Convenio de pago firmado* (lo recibes el día ` +
    `de mañana), tu *comprobante de pago* e *INE por ambos lados* en imágenes legibles vía ` +
    `WhatsApp al teléfono *5635519617* para poder concluir la liquidación de tu deuda.`
  );
}

/**
 * Retorna el template de mensaje para un estado dado de la escalera
 * @param {string} state - Estado actual de la negociación
 * @param {object} registro - Datos del cliente
 * @param {object} extra - Datos adicionales (fecha agendada, plan de parcialidades, etc.)
 * @returns {string} Mensaje a enviar al usuario
 */
export function getTemplate(state, registro, extra = {}) {
  const {
    nombre,
    cuenta,
    total,
    clabe,
    dia_pago,
    regulariza,
    quita_max,
    mensualidad,
  } = registro;

  const totalFmt = formatMoney(total);
  const regularizaFmt = formatMoney(regulariza);
  const quitaMaxFmt = formatMoney(quita_max);
  const mensualidadFmt = formatMoney(mensualidad);

  // Regla "antes del día X del mes" solo aplica si ese día aún no ha pasado.
  // Para clientes ya atrasados el único tope real son los 2 días hábiles.
  const diaPagoNum = parseInt(dia_pago);
  const dateHint =
    diaPagoNum && getTodayMX().getDate() < diaPagoNum
      ? `día hábil, antes del día *${dia_pago}* del mes`
      : `día hábil, dentro de los próximos 2 días hábiles`;

  const templates = {
    // ========================================
    // PRIORIDAD 1: REGULARIZACIÓN
    // ========================================

    [S.P1_OFFER_REGULARIZA]:
      `El apoyo que puedo brindarte debido al atraso en el pago de tu crédito personal es ` +
      `ponerte al corriente, sin recargo de intereses moratorios, pagando solamente la cantidad ` +
      `de *$${regularizaFmt} MXN*. ` +
      `¿Este monto lo puedes realizar el día de hoy para detener accionamientos de cobro?`,

    [S.P1_INSIST]:
      `Entiendo lo que mencionas, sin embargo, es importante que tengas presente que cada día ` +
      `que dejes de pagar tu deuda sigue incrementando y tu calificación en buró de crédito se ` +
      `afecta cada vez más. Te recomiendo realizar el esfuerzo para conseguir este monto, te ` +
      `podemos dar *hasta 2 días* para reunirlo. ¿De esta forma te será posible?`,

    [S.P1_OFFER_DAYS]:
      `Entiendo tu situación. Te podemos dar *hasta 2 días hábiles* para reunir el monto de ` +
      `*$${regularizaFmt} MXN*. ¿En qué fecha podrías realizar el pago? ` +
      `(debe ser ${dateHint}).`,

    [S.P1_SCHEDULE_DATE]:
      `Necesito que me confirmes la fecha exacta en que realizarás tu pago de ` +
      `*$${regularizaFmt} MXN* (debe ser día hábil).`,

    [S.P1_OFFER_INSTALLMENTS]:
      `Entiendo tu situación. Te ofrezco dividir los *$${regularizaFmt} MXN* en parcialidades ` +
      `dentro del mes en curso:\n\n` +
      `1️⃣ *Plan Semanal*: 3 pagos cada 7 días\n` +
      `2️⃣ *Plan Quincenal*: 2 pagos cada 10 días\n\n` +
      `¿Cuál prefieres?`,

    [S.P1_INSTALLMENT_CHOICE]:
      `Por favor selecciona tu plan de pagos:\n\n` +
      `1️⃣ *Plan Semanal*: 3 pagos cada 7 días\n` +
      `2️⃣ *Plan Quincenal*: 2 pagos cada 10 días`,

    // ========================================
    // PRIORIDAD 2: LIQUIDACIÓN CON QUITA
    // ========================================

    [S.P2_OFFER_QUITA]:
      `Considerando la situación financiera que atraviesas, tenemos el beneficio exclusivo para ti ` +
      `de *liquidar definitivamente* esta deuda con el mejor descuento pagando únicamente ` +
      `*$${quitaMaxFmt} MXN*. ` +
      `¿Te interesa liberarte de esta deuda definitivamente realizando pago de este monto ` +
      `el día de hoy para detener definitivamente accionamientos de cobro?`,

    [S.P2_OFFER_INSTALLMENTS]:
      `Puedo ofrecerte pagar los *$${quitaMaxFmt} MXN* en parcialidades dentro del mes en curso:\n\n` +
      `1️⃣ *Plan Semanal*: 3 pagos cada 7 días\n` +
      `2️⃣ *Plan Quincenal*: 2 pagos cada 10 días\n\n` +
      `¿Cuál opción te conviene más?`,

    [S.P2_INSTALLMENT_CHOICE]:
      `Por favor selecciona tu plan de pagos:\n\n` +
      `1️⃣ *Plan Semanal*: 3 pagos cada 7 días\n` +
      `2️⃣ *Plan Quincenal*: 2 pagos cada 10 días`,

    [S.P2_INSIST_NEGATIVA]:
      `Comprendo lo complicado de la situación actual, sin embargo, debes tener presente que ` +
      `de no aprovechar las facilidades de pago que se te proporcionan, el sistema dictaminará ` +
      `*HOY* tu deuda en *Negativa de Pago* por lo que no solo pierdes estos beneficios, sino que ` +
      `además estás sujeto al recargo del *100% de los intereses moratorios* ocasionados. ` +
      `¿Estás seguro que realizando un esfuerzo no puedes tomar este descuento?`,

    // ========================================
    // PRIORIDAD 3: INTENCIÓN (MENSUALIDAD)
    // ========================================

    [S.P3_OFFER_MENSUALIDAD]:
      `Lamento que en este momento no te sea posible ponerte al corriente ni liquidar tu deuda ` +
      `con descuento, pero antes de que tu expediente sea trasladado a otras instancias de cobro ` +
      `realiza hoy pago mínimo por la cantidad de *$${mensualidadFmt} MXN*, para garantizar que ` +
      `tu deuda no se considere en Negativa y sea trasladada para cobro a través de tu pagaré firmado. ` +
      `¿Podemos comprometer el pago de este monto para el día de hoy?`,

    [S.P3_OFFER_DAYS]:
      `Te recomiendo realizar el esfuerzo para conseguir este monto, te podemos dar ` +
      `*hasta 2 días* para reunirlo. ¿De esta forma te será posible?`,

    [S.P3_SCHEDULE_DATE]:
      `Necesito que me confirmes la fecha exacta en que realizarás tu pago de ` +
      `*$${mensualidadFmt} MXN* (debe ser día hábil del mes en curso).`,

    // ========================================
    // ESTADOS COMPARTIDOS
    // ========================================

    [S.PAYMENT_INSTRUCTIONS]:
      `Perfecto. ${paymentMethods(cuenta, clabe)}\n\n` +
      `Con este pago te pones al corriente y evitas generar más intereses, así como la comisión ` +
      `mensual por el pago tardío.`,

    [S.P2_PAYMENT_DOCS]:
      `Perfecto. ${paymentMethodsDocs(cuenta, clabe)}`,

    [S.AWAITING_CONFIRMATION]:
      `Quedo pendiente de tu comprobante de pago. Recuerda enviarlo al WhatsApp *5635519617* ` +
      `para detener inmediatamente actos de cobranza. ¿Hay algo más en que pueda ayudarte?`,

    [S.FINAL_REFERRAL]:
      `Lamento no poder ayudarte, pero es urgente que para buscar otras opciones de solución ` +
      `contactes de inmediato a un ejecutivo especialista de crédito en el teléfono: *5595470785* o ` +
      `vía WhatsApp al número: *5635519617*.\n\n` +
      `Si cambias de opinión vuelve a platicar conmigo en un plazo no mayor a *24 horas*, para ` +
      `poder ayudarte sin que pierdas los beneficios. Recuerda que las llamadas y mensajes no ` +
      `cesarán a referencia y familiares, evita un proceso extrajudicial en domicilio por evasión de pago.`,

    [S.COMPLETED]:
      `Gracias por tu atención, ${nombre}. Que tengas buen día.`,
  };

  return templates[state] || "";
}

/**
 * Genera texto con el calendario de parcialidades
 * @param {Array} schedule - Array de { number, dateFormatted, amount }
 * @param {string} cuenta - Número de crédito
 * @param {string} clabe - CLABE interbancaria
 * @returns {string}
 */
export function formatInstallmentMessage(schedule, cuenta, clabe) {
  const lines = schedule
    .map(
      (p) =>
        `  Pago ${p.number}: *$${formatMoney(p.amount)} MXN* - ${p.dateFormatted}`
    )
    .join("\n");

  return (
    `Tu plan de pagos queda así:\n\n${lines}\n\n` +
    `Los pagos los debes de realizar directamente en las sucursales de Compartamos Banco ` +
    `a los 10 dígitos de tu número de crédito *${cuenta}* o a través de cualquier banca ` +
    `móvil como pago SPEI a la cuenta CLABE *${clabe}*.\n\n` +
    `Recuerda realizar tu primer pago en la fecha indicada. Al aplicarlo y ` +
    `reportarlo en 1 día hábil se generará tu convenio para que mantengas seguimiento al proceso.\n\n` +
    `Importante reportar tu comprobante de pago al teléfono *5635519617* para evitar penalizaciones ` +
    `y detener inmediatamente actos de cobranza.`
  );
}

/**
 * Genera mensaje de confirmación de fecha agendada
 * @param {string} dateFormatted - Fecha formateada en español
 * @param {string} amount - Monto formateado
 * @param {string} cuenta - Número de crédito
 * @param {string} clabe - CLABE
 * @returns {string}
 */
export function formatScheduledPaymentMessage(dateFormatted, amount, cuenta, clabe) {
  return (
    `Perfecto, agendamos tu pago para el *${dateFormatted}* por *$${amount} MXN*.\n\n` +
    `El pago lo debes de realizar directamente en las sucursales de Compartamos Banco ` +
    `a los 10 dígitos de tu número de crédito *${cuenta}* o a través de cualquier banca ` +
    `móvil como pago SPEI a la cuenta CLABE *${clabe}*.\n\n` +
    `Con este pago te pones al corriente y evitas generar más intereses, así como la comisión ` +
    `mensual por el pago tardío.\n\n` +
    `Importante reportar tu comprobante de pago por este medio o al teléfono *5635519617* ` +
    `para evitar penalizaciones y detener inmediatamente actos de cobranza.`
  );
}
