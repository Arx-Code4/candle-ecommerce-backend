import {
  listAdminOrdersQuerySchema,
  updateOrderStatusSchema,
} from '../../src/schemas/admin-order.schema.js';

describe('admin-order.schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAdminOrdersQuerySchema', () => {
    it('accepts valid status enum values', () => {
      expect(() =>
        listAdminOrdersQuerySchema.parse({ query: { status: 'PROCESSING' } }),
      ).not.toThrow();
      expect(() =>
        listAdminOrdersQuerySchema.parse({ query: { status: 'SHIPPED' } }),
      ).not.toThrow();
    });

    it('rejects an invalid status value', () => {
      expect(() => listAdminOrdersQuerySchema.parse({ query: { status: 'DELIVERED' } })).toThrow();
    });

    it('coerces page/limit', () => {
      const result = listAdminOrdersQuerySchema.parse({ query: { page: '2', limit: '50' } });

      expect(result.query.page).toBe(2);
      expect(result.query.limit).toBe(50);
    });

    it('defaults page/limit when omitted', () => {
      const result = listAdminOrdersQuerySchema.parse({ query: {} });

      expect(result.query.page).toBe(1);
      expect(result.query.limit).toBe(20);
    });
  });

  describe('updateOrderStatusSchema', () => {
    it('only accepts "SHIPPED"', () => {
      expect(() => updateOrderStatusSchema.parse({ body: { status: 'SHIPPED' } })).not.toThrow();
    });

    it('rejects "PROCESSING" as a target value', () => {
      expect(() => updateOrderStatusSchema.parse({ body: { status: 'PROCESSING' } })).toThrow();
    });

    it('rejects an arbitrary string', () => {
      expect(() => updateOrderStatusSchema.parse({ body: { status: 'CANCELLED' } })).toThrow();
    });
  });
});
