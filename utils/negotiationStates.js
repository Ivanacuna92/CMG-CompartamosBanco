// utils/negotiationStates.js
// Estados de la Escalera de Negociación CPI-IA

export const S = {
  // Prioridad 1: Regularización
  P1_OFFER_REGULARIZA:   "p1_offer_regulariza",
  P1_INSIST:             "p1_insist",
  P1_OFFER_DAYS:         "p1_offer_days",
  P1_SCHEDULE_DATE:      "p1_schedule_date",
  P1_OFFER_INSTALLMENTS: "p1_offer_installments",
  P1_INSTALLMENT_CHOICE: "p1_installment_choice",

  // Prioridad 2: Liquidación con Quita
  P2_OFFER_QUITA:        "p2_offer_quita",
  P2_OFFER_INSTALLMENTS: "p2_offer_installments",
  P2_INSTALLMENT_CHOICE: "p2_installment_choice",
  P2_INSIST_NEGATIVA:    "p2_insist_negativa",

  // Prioridad 3: Intención (Mensualidad)
  P3_OFFER_MENSUALIDAD:  "p3_offer_mensualidad",
  P3_OFFER_DAYS:         "p3_offer_days",
  P3_SCHEDULE_DATE:      "p3_schedule_date",

  // Estados compartidos / terminales
  PAYMENT_INSTRUCTIONS:  "payment_instructions",
  P2_PAYMENT_DOCS:       "p2_payment_docs",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  FINAL_REFERRAL:        "final_referral",
  COMPLETED:             "completed",
};
