// =====================================================
// REFUND SERVICE (PHASE 56)
//
// Sends money back to the customer's wallet when:
//   - items / an order are CANCELLED   -> refundForCancellation
//   - the admin APPROVES a return      -> refundForReturn
//
// THE RULE THAT PREVENTS DOUBLE REFUNDS
//   Every order stores  refundedAmount  = "how much we already sent back".
//   A refund is always:   what should be refunded  -  refundedAmount.
//   So if the same code runs twice, the second time the answer is 0
//   and nothing is credited.
//
// HOW THE MONEY IS CLAIMED
//   1. Work out the amount that is still due.
//   2. "Claim" it: add it to refundedAmount, but ONLY if refundedAmount
//      is still the number we read (an atomic update). If another request
//      got there first, our claim fails and we calculate again.
//   3. Credit the wallet. The transaction carries a unique key built from
//      the order and the "before" amount, so MongoDB itself refuses a
//      second credit with the same key.
//   4. If step 3 fails, the claim is undone.
//
// WHEN IS THERE MONEY TO REFUND?
//   Only when the customer really paid (paymentStatus = Paid):
//     - Online / Wallet orders: paid when the order was placed.
//     - Cash on Delivery: paid only at delivery. A COD order that is
//       cancelled BEFORE delivery has taken no money, so nothing is refunded.
// =====================================================

const Order = require("../models/orderModel");

const { creditWallet } = require("./walletService");

const { round2, calculateActiveAmounts } = require("../helpers/orderAmounts");

const {
    PAYMENT_METHOD,
    PAYMENT_STATUS
} = require("../config/orderConstants");

const { WALLET_TX_REASON } = require("../config/walletConstants");

const MAX_ATTEMPTS = 3;

const KIND = {
    CANCEL: "CANCEL",
    RETURN: "RETURN"
};

const alreadyRefunded = (order) => round2(order.refundedAmount || 0);


// How much is still due after a CANCELLATION?
//   paid in total  -  what the customer still "keeps" (active items)  -  already refunded
const dueForCancellation = (order) => {

    // A COD order cannot have been paid before it is delivered.
    if (order.paymentMethod === PAYMENT_METHOD.COD) {
        return 0;
    }

    const stillKept = calculateActiveAmounts(order).finalTotal;

    return round2(order.finalTotal - stillKept - alreadyRefunded(order));
};

// How much is due after an APPROVED RETURN? Everything the customer still paid for.
const dueForReturn = (order) => {

    const stillKept = calculateActiveAmounts(order).finalTotal;

    // Online / Wallet: they paid finalTotal. COD: they paid the active total at delivery.
    const paid = order.paymentMethod === PAYMENT_METHOD.COD
        ? stillKept
        : order.finalTotal;

    // Never refund more than the items that are still active are worth.
    return round2(Math.min(paid - alreadyRefunded(order), stillKept));
};

// "refundedAmount equals X" - old orders do not have the field at all,
// and { $in: [0, null] } also matches a missing field.
const refundedEquals = (value) =>
    value === 0 ? { $in: [0, null] } : value;

const refundOrder = async (orderDbId, kind) => {

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {

        const order = await Order.findById(orderDbId).lean();

        if (!order || order.paymentStatus !== PAYMENT_STATUS.PAID) {
            return { refunded: 0 };
        }

        const due = kind === KIND.CANCEL
            ? dueForCancellation(order)
            : dueForReturn(order);

        if (due <= 0) {
            return { refunded: 0 };
        }

        const before = alreadyRefunded(order);

        // Step 2: claim the money. Fails if another request changed
        // refundedAmount in the meantime.
        const claim = await Order.updateOne(
            { _id: order._id, refundedAmount: refundedEquals(before) },
            { $inc: { refundedAmount: due } }
        );

        if (claim.modifiedCount !== 1) {
            continue; // read the order again and recalculate
        }

        // Step 3: put the money in the wallet.
        try {

            const result = await creditWallet(order.user, {
                amount: due,
                reason: kind === KIND.CANCEL
                    ? WALLET_TX_REASON.REFUND_CANCEL
                    : WALLET_TX_REASON.REFUND_RETURN,
                description: kind === KIND.CANCEL
                    ? `Refund for cancelled order ${order.orderId}`
                    : `Refund for returned order ${order.orderId}`,
                orderId: order.orderId,
                referenceKey: `REFUND:${kind}:${order.orderId}:${before}`
            });

            if (!result.credited) {

                // This exact credit already exists - do not count it twice.
                await Order.updateOne(
                    { _id: order._id },
                    { $inc: { refundedAmount: -due } }
                );

                return { refunded: 0 };
            }

            return { refunded: due, balance: result.balance };

        } catch (error) {

            // Step 4: the wallet was not credited, so undo the claim.
            try {
                await Order.updateOne(
                    { _id: order._id },
                    { $inc: { refundedAmount: -due } }
                );
            } catch (undoError) {
                console.error(
                    `Refund claim undo failed for order ${order.orderId}:`,
                    undoError
                );
            }

            throw error;
        }
    }

    // Too many simultaneous changes. Nothing was credited.
    throw new Error("Could not settle the refund. Please try again.");
};

const refundForCancellation = (orderDbId) => refundOrder(orderDbId, KIND.CANCEL);

const refundForReturn = (orderDbId) => refundOrder(orderDbId, KIND.RETURN);

module.exports = {
    refundForCancellation,
    refundForReturn,
    dueForCancellation,
    dueForReturn
};
