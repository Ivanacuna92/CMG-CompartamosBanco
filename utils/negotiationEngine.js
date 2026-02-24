// utils/negotiationEngine.js
// Motor de la Escalera de Negociación CPI-IA

import { S } from "./negotiationStates.js";
import { classifyUserIntent, generateContextualAnswer } from "./openaiClient.js";
import {
  getTemplate,
  formatMoney,
  formatInstallmentMessage,
  formatScheduledPaymentMessage,
} from "./negotiationTemplates.js";
import {
  isValidPaymentDate,
  calculateInstallmentDates,
  formatDateES,
  getTodayMX,
} from "./dateUtils.js";

// ============================================================
// Tabla de transiciones: { estado_actual: { intent -> siguiente_estado } }
// ============================================================
const TRANSITIONS = {
  // --- Prioridad 1: Regularización ---
  [S.P1_OFFER_REGULARIZA]: {
    accept:    S.PAYMENT_INSTRUCTIONS,
    reject:    S.P1_INSIST,
    objection: S.P1_INSIST,
  },
  [S.P1_INSIST]: {
    accept:        S.P1_OFFER_DAYS,
    reject:        S.P1_OFFER_INSTALLMENTS,
    objection:     S.P1_OFFER_INSTALLMENTS,
    schedule_date: S.P1_OFFER_DAYS,
  },
  [S.P1_OFFER_DAYS]: {
    schedule_date: S.P1_SCHEDULE_DATE,
    accept:        S.P1_SCHEDULE_DATE,
    reject:        S.P1_OFFER_INSTALLMENTS,
    objection:     S.P1_OFFER_INSTALLMENTS,
  },
  [S.P1_SCHEDULE_DATE]: {
    schedule_date: "_handle_date",
    accept:        "_handle_date",
    reject:        S.P1_OFFER_INSTALLMENTS,
  },
  [S.P1_OFFER_INSTALLMENTS]: {
    accept:              S.P1_INSTALLMENT_CHOICE,
    installment_weekly:  "_handle_installment",
    installment_biweekly: "_handle_installment",
    reject:              S.P2_OFFER_QUITA,
    objection:           S.P2_OFFER_QUITA,
  },
  [S.P1_INSTALLMENT_CHOICE]: {
    installment_weekly:  "_handle_installment",
    installment_biweekly: "_handle_installment",
    accept:              S.P1_INSTALLMENT_CHOICE, // re-preguntar
    reject:              S.P2_OFFER_QUITA,
  },

  // --- Prioridad 2: Liquidación con Quita ---
  [S.P2_OFFER_QUITA]: {
    accept:    S.P2_PAYMENT_DOCS,
    reject:    S.P2_OFFER_INSTALLMENTS,
    objection: S.P2_OFFER_INSTALLMENTS,
  },
  [S.P2_OFFER_INSTALLMENTS]: {
    accept:              S.P2_INSTALLMENT_CHOICE,
    installment_weekly:  "_handle_installment",
    installment_biweekly: "_handle_installment",
    reject:              S.P2_INSIST_NEGATIVA,
    objection:           S.P2_INSIST_NEGATIVA,
  },
  [S.P2_INSTALLMENT_CHOICE]: {
    installment_weekly:  "_handle_installment",
    installment_biweekly: "_handle_installment",
    accept:              S.P2_INSTALLMENT_CHOICE,
    reject:              S.P2_INSIST_NEGATIVA,
  },
  [S.P2_INSIST_NEGATIVA]: {
    accept:    S.P2_PAYMENT_DOCS,
    reject:    S.P3_OFFER_MENSUALIDAD,
    objection: S.P3_OFFER_MENSUALIDAD,
  },

  // --- Prioridad 3: Intención (Mensualidad) ---
  [S.P3_OFFER_MENSUALIDAD]: {
    accept:    S.PAYMENT_INSTRUCTIONS,
    reject:    S.P3_OFFER_DAYS,
    objection: S.P3_OFFER_DAYS,
  },
  [S.P3_OFFER_DAYS]: {
    accept:        S.P3_SCHEDULE_DATE,
    schedule_date: S.P3_SCHEDULE_DATE,
    reject:        S.FINAL_REFERRAL,
    objection:     S.FINAL_REFERRAL,
  },
  [S.P3_SCHEDULE_DATE]: {
    schedule_date: "_handle_date",
    accept:        "_handle_date",
    reject:        S.FINAL_REFERRAL,
  },

  // --- Estados terminales ---
  [S.PAYMENT_INSTRUCTIONS]: {
    accept:       S.AWAITING_CONFIRMATION,
    already_paid: S.AWAITING_CONFIRMATION,
    greeting:     S.AWAITING_CONFIRMATION,
  },
  [S.P2_PAYMENT_DOCS]: {
    accept:       S.AWAITING_CONFIRMATION,
    already_paid: S.AWAITING_CONFIRMATION,
    greeting:     S.AWAITING_CONFIRMATION,
  },
  [S.AWAITING_CONFIRMATION]: {
    already_paid: S.COMPLETED,
    accept:       S.COMPLETED,
    greeting:     S.COMPLETED,
  },
  [S.FINAL_REFERRAL]: {
    accept: S.P1_OFFER_REGULARIZA, // si recapacita, reiniciar
  },
};

/**
 * Determina el estado inicial basándose en los datos disponibles del registro.
 * Si un campo es 0 o vacío, salta la prioridad correspondiente.
 */
export function getInitialState(registro) {
  if (registro.regulariza > 0) return S.P1_OFFER_REGULARIZA;
  if (registro.quita_max > 0) return S.P2_OFFER_QUITA;
  if (registro.mensualidad > 0) return S.P3_OFFER_MENSUALIDAD;
  return S.FINAL_REFERRAL;
}

/**
 * Determina el monto relevante según el estado actual de la negociación
 */
function resolveCurrentAmount(state, registro) {
  if (state.startsWith("p1_")) return registro.regulariza;
  if (state.startsWith("p2_")) return registro.quita_max;
  if (state.startsWith("p3_")) return registro.mensualidad;
  return registro.total;
}

/**
 * Aplica lógica de skip: si el siguiente estado no tiene datos, salta al siguiente nivel
 */
function applySkipLogic(nextState, registro) {
  if (nextState === S.P2_OFFER_QUITA && registro.quita_max <= 0) {
    if (registro.mensualidad > 0) return S.P3_OFFER_MENSUALIDAD;
    return S.FINAL_REFERRAL;
  }
  if (nextState === S.P3_OFFER_MENSUALIDAD && registro.mensualidad <= 0) {
    return S.FINAL_REFERRAL;
  }
  return nextState;
}

/**
 * Inicializa el objeto de negociación en la sesión
 */
export function initNegotiation(registro) {
  const initialState = getInitialState(registro);
  return {
    state: initialState,
    history: [],
    scheduledDate: null,
    installmentPlan: null,
    lastTransition: Date.now(),
  };
}

/**
 * Procesa un paso de la escalera de negociación
 * @param {object} session - Sesión completa del usuario
 * @param {string} userMessage - Mensaje del usuario
 * @returns {string} Mensaje de respuesta
 */
export async function processNegotiationStep(session, userMessage) {
  const neg = session.negotiation;
  const currentState = neg.state;
  const registro = session.registro;

  // 1. Clasificar intención del usuario
  const classification = await classifyUserIntent(userMessage, currentState, registro);
  const { intent, extracted_date, confidence } = classification;

  // 2. Registrar en historial
  neg.history.push({
    state: currentState,
    userMessage,
    intent,
    confidence,
    timestamp: Date.now(),
  });

  // 3. Manejo global: "ya pagué" desde cualquier estado
  if (intent === "already_paid") {
    neg.state = S.AWAITING_CONFIRMATION;
    return getTemplate(S.AWAITING_CONFIRMATION, registro);
  }

  // 4. Manejo global: saludo/despedida en estados terminales
  if (intent === "greeting" && (currentState === S.AWAITING_CONFIRMATION || currentState === S.COMPLETED)) {
    neg.state = S.COMPLETED;
    return getTemplate(S.COMPLETED, registro);
  }

  // 5. Manejo de preguntas: IA responde + re-presenta oferta
  if (intent === "question") {
    const answer = await generateContextualAnswer(userMessage, currentState, registro);
    const currentOffer = getTemplate(currentState, registro);
    return `${answer}\n\nRetomando: ${currentOffer}`;
  }

  // 6. Manejo de off_topic o baja confianza
  if (intent === "off_topic" || confidence < 0.5) {
    const currentOffer = getTemplate(currentState, registro);
    return `Entiendo, pero es importante que revisemos tu situación. ${currentOffer}`;
  }

  // 7. Buscar transición en la tabla
  const stateTransitions = TRANSITIONS[currentState];
  if (!stateTransitions) {
    console.warn(`⚠️ [negotiationEngine] Estado sin transiciones: ${currentState}`);
    neg.state = S.P1_OFFER_REGULARIZA;
    return getTemplate(S.P1_OFFER_REGULARIZA, registro);
  }

  let nextState = stateTransitions[intent];

  // Si no hay transición para este intent, re-presentar oferta actual
  if (!nextState) {
    return getTemplate(currentState, registro);
  }

  // 8. Manejar estados especiales

  // 8a. Manejo de fechas
  if (nextState === "_handle_date") {
    return handleDateScheduling(neg, registro, extracted_date, currentState);
  }

  // 8b. Manejo de parcialidades
  if (nextState === "_handle_installment") {
    const planType = intent === "installment_weekly" ? "weekly" : "biweekly";
    return handleInstallmentSelection(neg, registro, planType, currentState);
  }

  // 9. Aplicar lógica de skip
  nextState = applySkipLogic(nextState, registro);

  // 10. Transicionar
  neg.state = nextState;
  neg.lastTransition = Date.now();

  console.log(`📍 [negotiationEngine] ${currentState} → ${nextState} (intent: ${intent})`);

  return getTemplate(nextState, registro);
}

/**
 * Maneja la selección de fecha para agendar pago
 */
function handleDateScheduling(neg, registro, extractedDate, currentState) {
  if (!extractedDate) {
    // No se pudo extraer fecha, pedir de nuevo
    const amount = resolveCurrentAmount(currentState, registro);
    return (
      `Necesito que me indiques la fecha exacta en que realizarás tu pago de ` +
      `*$${formatMoney(amount)} MXN* (debe ser día hábil del mes en curso).`
    );
  }

  // Validar fecha (máximo 2 días hábiles, consistente con lo comunicado al cliente)
  const validation = isValidPaymentDate(extractedDate, registro.dia_pago, 2);
  if (!validation.valid) {
    return (
      `Esa fecha no es válida: ${validation.reason}. ` +
      `Por favor indica otra fecha (día hábil, antes del día ${registro.dia_pago} del mes).`
    );
  }

  // Fecha válida: guardar y mostrar instrucciones
  neg.scheduledDate = extractedDate;
  const amount = resolveCurrentAmount(currentState, registro);

  // Determinar estado destino según prioridad
  if (currentState.startsWith("p2_")) {
    neg.state = S.P2_PAYMENT_DOCS;
  } else {
    neg.state = S.PAYMENT_INSTRUCTIONS;
  }
  neg.lastTransition = Date.now();

  return formatScheduledPaymentMessage(
    formatDateES(new Date(extractedDate + "T12:00:00")),
    formatMoney(amount),
    registro.cuenta,
    registro.clabe
  );
}

/**
 * Maneja la selección de plan de parcialidades
 */
function handleInstallmentSelection(neg, registro, planType, currentState) {
  const amount = resolveCurrentAmount(currentState, registro);
  const today = getTodayMX();
  const schedule = calculateInstallmentDates(amount, planType, today, registro.dia_pago);

  neg.installmentPlan = { planType, schedule };

  // Determinar estado destino según prioridad
  if (currentState.startsWith("p2_")) {
    neg.state = S.P2_PAYMENT_DOCS;
  } else {
    neg.state = S.PAYMENT_INSTRUCTIONS;
  }
  neg.lastTransition = Date.now();

  return formatInstallmentMessage(schedule, registro.cuenta, registro.clabe);
}
