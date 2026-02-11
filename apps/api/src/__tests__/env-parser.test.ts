import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBooleanEnv, getStringEnv, getNumberEnv } from '../utils/env-parser';

describe('getBooleanEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar true quando env="true" (plaintext)', () => {
    process.env.TEST_VAR = 'true';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(true);
  });

  it('deve retornar false quando env="false" (plaintext)', () => {
    process.env.TEST_VAR = 'false';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(false);
  });

  it('deve retornar true quando env=\'{"TEST_VAR":"true"}\' (JSON string)', () => {
    process.env.TEST_VAR = '{"TEST_VAR":"true"}';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(true);
  });

  it('deve retornar false quando env=\'{"TEST_VAR":"false"}\' (JSON string)', () => {
    process.env.TEST_VAR = '{"TEST_VAR":"false"}';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(false);
  });

  it('deve retornar false quando env é undefined', () => {
    delete process.env.TEST_VAR;
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(false);
  });

  it('deve retornar defaultValue quando env é undefined', () => {
    delete process.env.TEST_VAR;
    
    const result = getBooleanEnv('TEST_VAR', true);
    
    expect(result).toBe(true);
  });

  it('deve retornar false quando env é string vazia', () => {
    process.env.TEST_VAR = '';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(false);
  });

  it('deve ignorar case para "true" (plaintext)', () => {
    process.env.TEST_VAR = 'TRUE';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(true);
  });

  it('deve ignorar case para "false" (plaintext)', () => {
    process.env.TEST_VAR = 'FALSE';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(false);
  });

  it('deve ignorar espaços em branco (plaintext)', () => {
    process.env.TEST_VAR = '  true  ';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(true);
  });

  it('deve retornar false quando JSON é inválido e tentar parse direto', () => {
    process.env.TEST_VAR = '{"TEST_VAR":invalid}';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(false);
  });

  it('deve retornar false quando JSON não contém a chave', () => {
    process.env.TEST_VAR = '{"OTHER_VAR":"true"}';
    
    const result = getBooleanEnv('TEST_VAR');
    
    expect(result).toBe(false);
  });
});

describe('getStringEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar valor quando env é plaintext', () => {
    process.env.TEST_VAR = 'hello';
    
    const result = getStringEnv('TEST_VAR');
    
    expect(result).toBe('hello');
  });

  it('deve retornar valor quando env é JSON string', () => {
    process.env.TEST_VAR = '{"TEST_VAR":"world"}';
    
    const result = getStringEnv('TEST_VAR');
    
    expect(result).toBe('world');
  });

  it('deve retornar defaultValue quando env é undefined', () => {
    delete process.env.TEST_VAR;
    
    const result = getStringEnv('TEST_VAR', 'default');
    
    expect(result).toBe('default');
  });
});

describe('getNumberEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar número quando env é plaintext', () => {
    process.env.TEST_VAR = '123';
    
    const result = getNumberEnv('TEST_VAR');
    
    expect(result).toBe(123);
  });

  it('deve retornar número quando env é JSON string', () => {
    process.env.TEST_VAR = '{"TEST_VAR":"456"}';
    
    const result = getNumberEnv('TEST_VAR');
    
    expect(result).toBe(456);
  });

  it('deve retornar defaultValue quando env é undefined', () => {
    delete process.env.TEST_VAR;
    
    const result = getNumberEnv('TEST_VAR', 999);
    
    expect(result).toBe(999);
  });

  it('deve retornar defaultValue quando env é inválido', () => {
    process.env.TEST_VAR = 'invalid';
    
    const result = getNumberEnv('TEST_VAR', 999);
    
    expect(result).toBe(999);
  });
});
