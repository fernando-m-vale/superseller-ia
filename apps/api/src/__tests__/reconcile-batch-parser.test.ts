import { describe, it, expect } from 'vitest';

/**
 * Testes unitários para o parser do batch API /items?ids=... do Mercado Livre
 * 
 * O batch API retorna um array onde cada elemento tem:
 * - code: HTTP status code (200, 403, 404, etc)
 * - body: Se code=200, é o objeto do item. Se code!=200, é o objeto de erro.
 * 
 * Os resultados vêm na mesma ordem dos IDs enviados.
 */

describe('ML Batch Items API Parser', () => {
  it('deve parsear corretamente item com code=200 e status=active', () => {
    const mockResponse = [
      {
        code: 200,
        body: {
          id: 'MLB4167251409',
          status: 'active',
          title: 'Produto Teste',
          price: 100,
        },
      },
    ];

    const itemIds = ['MLB4167251409'];
    const statusMap = new Map();
    const errorMap = new Map();

    for (let i = 0; i < mockResponse.length; i++) {
      const itemResponse = mockResponse[i];
      const itemCode = itemResponse.code;
      const requestedItemId = itemIds[i];

      if (itemCode === 200) {
        const itemBody = itemResponse.body;
        statusMap.set(requestedItemId, {
          status: itemBody.status,
          httpStatus: itemCode,
        });
      } else {
        const errorBody = itemResponse.body as any;
        errorMap.set(requestedItemId, {
          code: itemCode,
          errorCode: errorBody?.code,
          blockedBy: errorBody?.blocked_by,
          message: errorBody?.message,
        });
      }
    }

    expect(statusMap.has('MLB4167251409')).toBe(true);
    expect(statusMap.get('MLB4167251409').status).toBe('active');
    expect(statusMap.get('MLB4167251409').httpStatus).toBe(200);
    expect(errorMap.has('MLB4167251409')).toBe(false);
  });

  it('deve parsear corretamente erro 403 PolicyAgent', () => {
    const mockResponse = [
      {
        code: 403,
        body: {
          message: 'At least one policy returned UNAUTHORIZED.',
          code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',
          status: 403,
          blocked_by: 'PolicyAgent',
        },
      },
    ];

    const itemIds = ['MLB4167251409'];
    const statusMap = new Map();
    const errorMap = new Map();

    for (let i = 0; i < mockResponse.length; i++) {
      const itemResponse = mockResponse[i];
      const itemCode = itemResponse.code;
      const requestedItemId = itemIds[i];

      if (itemCode === 200) {
        const itemBody = itemResponse.body;
        statusMap.set(requestedItemId, {
          status: itemBody.status,
          httpStatus: itemCode,
        });
      } else {
        const errorBody = itemResponse.body as any;
        errorMap.set(requestedItemId, {
          code: itemCode,
          errorCode: errorBody?.code,
          blockedBy: errorBody?.blocked_by,
          message: errorBody?.message,
        });
      }
    }

    expect(statusMap.has('MLB4167251409')).toBe(false);
    expect(errorMap.has('MLB4167251409')).toBe(true);
    expect(errorMap.get('MLB4167251409').code).toBe(403);
    expect(errorMap.get('MLB4167251409').errorCode).toBe('PA_UNAUTHORIZED_RESULT_FROM_POLICIES');
    expect(errorMap.get('MLB4167251409').blockedBy).toBe('PolicyAgent');
    expect(errorMap.get('MLB4167251409').message).toBe('At least one policy returned UNAUTHORIZED.');
  });

  it('deve parsear corretamente erro 404 (item não encontrado)', () => {
    const mockResponse = [
      {
        code: 404,
        body: {
          message: 'Item not found',
          error: 'not_found',
          status: 404,
        },
      },
    ];

    const itemIds = ['MLB9999999999'];
    const statusMap = new Map();
    const errorMap = new Map();

    for (let i = 0; i < mockResponse.length; i++) {
      const itemResponse = mockResponse[i];
      const itemCode = itemResponse.code;
      const requestedItemId = itemIds[i];

      if (itemCode === 200) {
        const itemBody = itemResponse.body;
        statusMap.set(requestedItemId, {
          status: itemBody.status,
          httpStatus: itemCode,
        });
      } else {
        const errorBody = itemResponse.body as any;
        errorMap.set(requestedItemId, {
          code: itemCode,
          errorCode: errorBody?.code || errorBody?.error,
          blockedBy: errorBody?.blocked_by,
          message: errorBody?.message,
        });
      }
    }

    expect(statusMap.has('MLB9999999999')).toBe(false);
    expect(errorMap.has('MLB9999999999')).toBe(true);
    expect(errorMap.get('MLB9999999999').code).toBe(404);
    expect(errorMap.get('MLB9999999999').errorCode).toBe('not_found');
  });

  it('deve parsear corretamente batch misto (200 + 403 + 404)', () => {
    const mockResponse = [
      {
        code: 200,
        body: {
          id: 'MLB1111111111',
          status: 'active',
          title: 'Produto 1',
        },
      },
      {
        code: 403,
        body: {
          message: 'At least one policy returned UNAUTHORIZED.',
          code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',
          status: 403,
          blocked_by: 'PolicyAgent',
        },
      },
      {
        code: 404,
        body: {
          message: 'Item not found',
          error: 'not_found',
          status: 404,
        },
      },
    ];

    const itemIds = ['MLB1111111111', 'MLB4167251409', 'MLB9999999999'];
    const statusMap = new Map();
    const errorMap = new Map();

    for (let i = 0; i < mockResponse.length; i++) {
      const itemResponse = mockResponse[i];
      const itemCode = itemResponse.code;
      const requestedItemId = itemIds[i];

      if (itemCode === 200) {
        const itemBody = itemResponse.body;
        statusMap.set(requestedItemId, {
          status: itemBody.status,
          httpStatus: itemCode,
        });
      } else {
        const errorBody = itemResponse.body as any;
        errorMap.set(requestedItemId, {
          code: itemCode,
          errorCode: errorBody?.code || errorBody?.error,
          blockedBy: errorBody?.blocked_by,
          message: errorBody?.message,
        });
      }
    }

    // Verificar item 200
    expect(statusMap.has('MLB1111111111')).toBe(true);
    expect(statusMap.get('MLB1111111111').status).toBe('active');

    // Verificar item 403 PolicyAgent
    expect(errorMap.has('MLB4167251409')).toBe(true);
    expect(errorMap.get('MLB4167251409').code).toBe(403);
    expect(errorMap.get('MLB4167251409').errorCode).toBe('PA_UNAUTHORIZED_RESULT_FROM_POLICIES');
    expect(errorMap.get('MLB4167251409').blockedBy).toBe('PolicyAgent');

    // Verificar item 404
    expect(errorMap.has('MLB9999999999')).toBe(true);
    expect(errorMap.get('MLB9999999999').code).toBe(404);
    expect(errorMap.get('MLB9999999999').errorCode).toBe('not_found');
  });
});
