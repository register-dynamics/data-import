const Enum = require('./enum');

describe('Enum', () => {
  const Color = Enum.define({
    RED: ['hex'],
    GREEN: ['hex'],
    BLUE: ['hex'],
  });

  test('creates variants with named properties', () => {
    const red = Color.RED({ hex: '#FF0000' });
    expect(red.variant).toBe('RED');
    expect(red.hex).toBe('#FF0000');
    expect(red.toString()).toBe('RED');
  });

  // Note: In JavaScript, assigning to a frozen object's property does not always throw an error,
  // even in strict mode or under Jest. Instead, the assignment fails silently and the value does not change.
  // This test checks that the property value remains unchanged and that the object is frozen.
  test('variants are immutable', () => {
    const green = Color.GREEN({ hex: '#00FF00' });
    green.hex = '#FFFFFF';
    expect(green.hex).toBe('#00FF00');
    expect(Object.isFrozen(green)).toBe(true);
  });

  test('pattern matching works for each variant', () => {
    const blue = Color.BLUE({ hex: '#0000FF' });
    const result = blue.match({
      RED: ({ hex }) => `Red: ${hex}`,
      GREEN: ({ hex }) => `Green: ${hex}`,
      BLUE: ({ hex }) => `Blue: ${hex}`,
      _: () => 'Unknown',
    });
    expect(result).toBe('Blue: #0000FF');
  });

  test('pattern matching falls back to _ for unknown variant', () => {
    const Custom = new Enum('YELLOW', { hex: '#FFFF00' });
    const result = Custom.match({
      _: ({ hex }) => `Other: ${hex}`,
    });
    expect(result).toBe('Other: #FFFF00');
  });

  test('throws if no match handler is found', () => {
    const red = Color.RED({ hex: '#FF0000' });
    expect(() => red.match({ GREEN: () => {} })).toThrow(/No match handler/);
  });

  test('define attaches fields array', () => {
    expect(Color.RED.fields).toEqual(['hex']);
  });

  test('can create enums with multiple fields', () => {
    const Shape = Enum.define({
      CIRCLE: ['radius'],
      RECT: ['width', 'height'],
    });
    const circle = Shape.CIRCLE({ radius: 5 });
    const rect = Shape.RECT({ width: 2, height: 3 });
    expect(circle.radius).toBe(5);
    expect(rect.width).toBe(2);
    expect(rect.height).toBe(3);
  });
});
