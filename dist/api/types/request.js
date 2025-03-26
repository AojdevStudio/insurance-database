export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export function getPaginationParams(req) {
    const page = Math.max(parseInt(req.query.page || String(DEFAULT_PAGE), 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || String(DEFAULT_LIMIT), 10), 1), MAX_LIMIT);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}
//# sourceMappingURL=request.js.map