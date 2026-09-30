// =====================================================
// PAGINATION / SEARCH HELPERS (PHASE 51)
//
// Small shared helpers used by the My Orders page now and
// by the admin orders page later (Phase 52).
// =====================================================

// Makes user-typed text safe to use inside a MongoDB regex
// (so typing "(" or "." can't break or abuse the search).
const escapeRegex = (text) =>
    String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


// [1, "...", 4, 5, 6, "...", 12] style page list.
const buildPageNumbers = (currentPage, totalPages) => {

    const pages = [];

    if (totalPages <= 7) {

        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }

        return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
        pages.push("...");
    }

    const rangeStart = Math.max(2, currentPage - 1);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 1);

    for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i);
    }

    if (currentPage < totalPages - 2) {
        pages.push("...");
    }

    pages.push(totalPages);

    return pages;
};

module.exports = { escapeRegex, buildPageNumbers };