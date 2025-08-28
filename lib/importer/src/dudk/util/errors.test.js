const { ErrorMessages } = require('./errors');

// Example error messages for testing
const messages = {
  FieldRequired: 'Field ${field} is required for type ${type}.',
  IncorrectType: 'Field ${field} has incorrect type: expected ${type}, got ${value}.',
  EmptyRow: 'Row is empty.',
};

describe('ErrorMessages', () => {
  test('stores provided key/values as properties', () => {
    const em = new ErrorMessages(messages);
    expect(em.FieldRequired).toBe(messages.FieldRequired);
    expect(em.IncorrectType).toBe(messages.IncorrectType);
    expect(em.EmptyRow).toBe(messages.EmptyRow);
  });

  test('lookup interpolates error properties and fieldname', () => {
    const em = new ErrorMessages(messages);
    const error = { variant: 'FieldRequired', type: 'string', value: undefined };
    const result = em.lookup(error, 'username');
    expect(result).toBe('Field username is required for type string.');
  });

  test('lookup interpolates multiple error properties', () => {
    const em = new ErrorMessages(messages);
    const error = { variant: 'IncorrectType', type: 'number', value: 'abc' };
    const result = em.lookup(error, 'age');
    expect(result).toBe('Field age has incorrect type: expected number, got abc.');
  });

  test('lookup returns message for variant with no interpolation', () => {
    const em = new ErrorMessages(messages);
    const error = { variant: 'EmptyRow' };
    const result = em.lookup(error, 'anyfield');
    expect(result).toBe('Row is empty.');
  });

  test('lookup returns undefined for unknown variant', () => {
    const em = new ErrorMessages(messages);
    const error = { variant: 'NotDefined' };
    const result = em.lookup(error, 'field');
    expect(result).toBeUndefined();
  });

  test('lookup leaves unknown placeholders unchanged', () => {
    const em = new ErrorMessages({
      Custom: 'Field ${field} and ${unknown}.'
    });
    const error = { variant: 'Custom', type: 'string' };
    const result = em.lookup(error, 'testfield');
    expect(result).toBe('Field testfield and ${unknown}.');
  });
});
