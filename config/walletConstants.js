// =====================================================
// WALLET CONSTANTS (PHASE 56)
// One place for every wallet rule, so the service, the
// controller and the views never disagree.
// =====================================================

// CREDIT = money comes INTO the wallet (refund, top-up)
// DEBIT  = money goes OUT of the wallet (paying for an order)
const WALLET_TX_TYPE = {
    CREDIT: "CREDIT",
    DEBIT: "DEBIT"
};

// Why the money moved. Shown to the user as the description.
const WALLET_TX_REASON = {
    REFUND_CANCEL: "REFUND_CANCEL",
    REFUND_RETURN: "REFUND_RETURN",
    ORDER_PAYMENT: "ORDER_PAYMENT",
    PAYMENT_REVERSAL: "PAYMENT_REVERSAL",
    ADD_MONEY: "ADD_MONEY"
};

const WALLET_TX_REASON_LABEL = {
    REFUND_CANCEL: "Refund for cancelled order",
    REFUND_RETURN: "Refund for returned order",
    ORDER_PAYMENT: "Payment for order",
    PAYMENT_REVERSAL: "Payment reversed (order could not be placed)",
    ADD_MONEY: "Money added to wallet"
};

// A top-up is "Pending" until Razorpay's payment is verified on the server.
// Pending / Failed top-ups are never shown in the user's history.
const WALLET_TX_STATUS = {
    PENDING: "Pending",
    COMPLETED: "Completed",
    FAILED: "Failed"
};

const WALLET_TX_PER_PAGE = 8;

// "Add Money" rules (whole rupees only).
const WALLET_TOPUP_MIN = 100;
const WALLET_TOPUP_MAX = 50000;
const WALLET_TOPUP_QUICK_AMOUNTS = [500, 1000, 1500, 2000, 2500, 5000];
const WALLET_DESCRIPTION_MAX_LENGTH = 100;

module.exports = {
    WALLET_TX_TYPE,
    WALLET_TX_REASON,
    WALLET_TX_REASON_LABEL,
    WALLET_TX_STATUS,
    WALLET_TX_PER_PAGE,
    WALLET_TOPUP_MIN,
    WALLET_TOPUP_MAX,
    WALLET_TOPUP_QUICK_AMOUNTS,
    WALLET_DESCRIPTION_MAX_LENGTH
};
